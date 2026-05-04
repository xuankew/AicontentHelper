import { App, TFile } from "obsidian";
import type {
	ArticleMeta,
	GzhWritingPipelineSettings,
	MokaCardPlatform,
} from "../types";
import type { FileService } from "./FileService";
import { assertApiKeyConfigured } from "./ArticleProjectService";
import { LLMService } from "./LLMService";
import { assertImagePipelineReady, ImageGenerationService } from "./ImageGenerationService";
import { pushWechatDraftFromVault } from "./WechatDraftService";
import { joinVaultPath } from "../utils/path";
import { STAGE_FILES } from "../templates/fileTemplates";
import { isoNow } from "../templates/metaTemplate";
import {
	coverWorkflowUserPrompt,
	articleIllustrationsUserPrompt,
	shortCoverTitlePrompt,
} from "../templates/wechatAssetPrompts";
import { nativeMokaSplitPrompt } from "../templates/mokaWorkflowPrompts";
import {
	buildWechatInputMarkdown,
	coverRelativeVaultFromWechatMd,
	excerptForDescription,
	extractCoverDisplayTitles,
	PUBLISH_LAYOUT,
} from "./MarkdownExportService";
import {
	DEFAULT_WECHAT_SIMPLE_COVER_TAGLINE,
	readVaultImageDataUrl,
	renderSimpleWechatCoverToPngBytes,
} from "./WechatSimpleCoverService";
import {
	extractYamlFencedBlock,
	extractYamlImagePrompt,
	stripCodeFencesJson,
} from "../utils/extractStructured";
import {
	assertPublishBodyIllustrationCountInPolicy,
	buildIllustrationOutlineFromSlots,
	countFigurePlaceholders,
	countPublishIllustrationMarkdownImages,
	markdownHasPublishIllustrationImages,
	resolveGzhFigureSlotsInMarkdown,
} from "../utils/gzhFigureSlots";
import type { WorkingModal } from "../ui/LoadingModal";
import { parseNativeMokaDeckFromLlm } from "../utils/mokaDeckParse";
import { MokaCardRenderService } from "./MokaCardRenderService";
import { MOKA_LAYOUT } from "../constants/publishPaths";
import {
	TRACE_LOG,
	bodyAfterSimpleYamlFrontmatter,
	formatIllustrationTraceMarkdown,
	logIllustrationTraceCompact,
	summarizeMarkdownBodyForTrace,
} from "../utils/gzhPublishIllustrationTrace";

const WECHAT_DRAFT_LOG = "[GZH 公众号草稿]";

export class PublishOrchestrator {
	constructor(
		private readonly app: App,
		private readonly files: FileService,
		private readonly llm: LLMService,
		private readonly img: ImageGenerationService,
		private readonly getSettings: () => GzhWritingPipelineSettings,
		private readonly persistMeta: (
			projectRoot: string,
			meta: ArticleMeta,
		) => Promise<void>,
		private readonly pluginManifestId: string,
	) {}

	async publishOfficialAccountFlow(
		projectRoot: string,
		meta: ArticleMeta,
		modal: WorkingModal,
	): Promise<void> {
		assertImagePipelineReady(this.getSettings());
		assertApiKeyConfigured(this.getSettings());

		const trace: Record<string, unknown> = {
			generatedAt: isoNow(),
			projectRootVault: projectRoot,
			note:
				"本篇在流水 try/finally 末尾写入。若发布中途抛错也可查看；重点看 illustration_branch / wechat_render_phase。",
		};

		try {
			const settings = this.getSettings();
			console.info("[GZH 发布]", "开始公众号发布流水（内置微信 API）", {
				projectRootVault: projectRoot,
				imagePresetProvider: settings.imagePresetProvider,
			});

			trace.draft_02_path = STAGE_FILES.draft;
			try {
				const draftMd = await this.files.readTextFile(
					joinVaultPath(projectRoot, STAGE_FILES.draft),
				);
				trace.draft_02 = {
					readable: true,
					figurePlaceholderCount:
						countFigurePlaceholders(draftMd),
					...summarizeMarkdownBodyForTrace(
						draftMd,
						`扩写稿 ${STAGE_FILES.draft}`,
					),
				};
			} catch {
				trace.draft_02 = {
					readable: false,
					path: STAGE_FILES.draft,
					reason:
						"读不到或未生成扩写稿；若项目根不对或文件缺失则属正常",
				};
			}

			const finalPath = joinVaultPath(projectRoot, STAGE_FILES.final);
			let articleMd = await this.files.readTextFile(finalPath);
			const placeholdersBefore = countFigurePlaceholders(articleMd);
			trace.final_at_publish_start = {
				path: STAGE_FILES.final,
				figurePlaceholderCount: placeholdersBefore,
				markdownHasPublishIllPaths:
					markdownHasPublishIllustrationImages(articleMd),
				...summarizeMarkdownBodyForTrace(
					articleMd,
					"终稿初次读入（尚未执行 gzh-figure 或 LLM 插图）",
				),
			};
		await this.files.mkdirp(
			joinVaultPath(projectRoot, PUBLISH_LAYOUT.coverPromptsDir),
		);

		if (placeholdersBefore > 0) {
			modal.updateMessage({
				title: "发布到公众号",
				message: `正在根据文中配图占位（gzh-figure://）直接生图 ${placeholdersBefore} 张并写回终稿…`,
			});
			const resolved = await resolveGzhFigureSlotsInMarkdown({
				projectRoot,
				files: this.files,
				img: this.img,
				md: articleMd,
				onSlot: (i, total, base) => {
					modal.updateMessage({
						message: `配图 ${i}/${total}：${base}（HTTP 生图）…`,
					});
				},
			});
			articleMd = resolved.md;
			await this.files.writeTextFile(finalPath, articleMd);
			await this.files.writeTextFile(
				joinVaultPath(projectRoot, PUBLISH_LAYOUT.illustrationOutline),
				buildIllustrationOutlineFromSlots(resolved.items),
			);
		}

			const hadAssetFiguresBeforeLlmFallback =
				markdownHasPublishIllustrationImages(articleMd);

		const coverDisplay = extractCoverDisplayTitles(articleMd);
		const wechatArticleTitle =
			coverDisplay.title.trim() || meta.title.trim() || "未命名";

		if (settings.wechatSimpleCoverEnabled) {
			modal.updateMessage({
				title: "发布到公众号",
				message: "正在生成简易公众号封面图（LLM 精炼标题 + 纯色模板）…",
			});
			const firstPara = coverDisplay.subtitle.trim();
			let displayTitle = wechatArticleTitle;
			let displaySubtitle = firstPara;
			try {
				const llmTitleRaw = await this.llm.generate(
					shortCoverTitlePrompt(wechatArticleTitle, articleMd),
				);
				const parsed = parseLlmCoverTitles(llmTitleRaw);
				if (parsed.title) displayTitle = parsed.title;
				if (parsed.subtitle) displaySubtitle = parsed.subtitle;
			} catch {
				// LLM 失败时退回正文提取的标题/副标题
			}
			const logoVault = settings.wechatSimpleCoverLogoVaultPath?.trim();
			const vaultLogo = logoVault
				? await readVaultImageDataUrl(this.app, logoVault)
				: undefined;
			const coverBytes = await renderSimpleWechatCoverToPngBytes({
				app: this.app,
				pluginManifestId: this.pluginManifestId,
				title: displayTitle,
				subtitle: displaySubtitle,
				tagline:
					settings.wechatSimpleCoverTagline.trim() ||
					DEFAULT_WECHAT_SIMPLE_COVER_TAGLINE,
				bgId: settings.wechatSimpleCoverBgId,
				logoDataUrl: vaultLogo ?? undefined,
			});
			await this.files.writeBinaryFile(
				joinVaultPath(projectRoot, PUBLISH_LAYOUT.coverImage),
				coverBytes,
			);
			await this.files.writeTextFile(
				joinVaultPath(projectRoot, PUBLISH_LAYOUT.coverPromptFile),
				[
					"# 简易模板封面",
					"",
					"本封面由插件内联 HTML + html-to-image 生成（非文生图）。",
					`背景：${settings.wechatSimpleCoverBgId}`,
					"",
				].join("\n"),
			);
		} else {
			modal.updateMessage({
				title: "发布到公众号",
				message: "正在生成公众号封面图（分析 + 生图）…",
			});
			const coverPromptRaw = await this.llm.generate(
				coverWorkflowUserPrompt(settings, articleMd),
			);
			const fenced = extractYamlFencedBlock(coverPromptRaw);
			const promptText =
				extractYamlImagePrompt(fenced ?? coverPromptRaw) ??
				extractYamlImagePrompt(coverPromptRaw) ??
				fenced ??
				coverPromptRaw.trim();

			await this.files.writeTextFile(
				joinVaultPath(projectRoot, PUBLISH_LAYOUT.coverPromptFile),
				`${promptText}\n`,
			);
			await this.img.renderPromptToVaultImage({
				vaultPath: joinVaultPath(projectRoot, PUBLISH_LAYOUT.coverImage),
				prompt: promptText,
				purpose: "wechat_cover",
			});
		}

		if (placeholdersBefore === 0 &&
			!markdownHasPublishIllustrationImages(articleMd)) {
			modal.updateMessage({
				message:
					"终稿中没有 gzh-figure 配图占位，将使用少量模型辅助规划插图（备选）…",
			});
			const illRaw = await this.llm.generate(
				articleIllustrationsUserPrompt(settings, articleMd),
			);
			const ill = parseIllustrationsJson(illRaw);
			await this.files.mkdirp(
				joinVaultPath(projectRoot, PUBLISH_LAYOUT.illustrationsDir),
			);
			await this.files.mkdirp(
				joinVaultPath(projectRoot, PUBLISH_LAYOUT.illustrationPromptsDir),
			);
			await this.files.writeTextFile(
				joinVaultPath(projectRoot, PUBLISH_LAYOUT.illustrationOutline),
				ill.outline_md,
			);

			const inlineIllItems: Array<{
				fromPublish: string;
				caption: string;
				sectionAfter: string;
			}> = [];
			for (const it of ill.items) {
				const base = sanitizeBaseName(it.file_base);
				const promptPath = joinVaultPath(
					projectRoot,
					PUBLISH_LAYOUT.illustrationPromptsDir,
					`${base}.md`,
				);
				await this.files.writeTextFile(
					promptPath,
					`# ${it.caption_zh}\n\n${it.prompt_en}\n`,
				);
				const imgRel = joinVaultPath(
					PUBLISH_LAYOUT.illustrationsDir,
					`${base}.png`,
				);
				const vaultImg = joinVaultPath(projectRoot, imgRel);
				await this.img.renderPromptToVaultImage({
					vaultPath: vaultImg,
					prompt: `${it.prompt_en}\n\nKeep consistent with article mood; no text unless subtle labels.`,
					purpose: "wechat_illustration",
				});
				const fromPublish = `../${imgRel}`;
				inlineIllItems.push({
					fromPublish,
					caption: it.caption_zh,
					sectionAfter: it.section_after_zh,
				});
			}
			articleMd = insertIllustrationsInline(articleMd, inlineIllItems);
		} else if (placeholdersBefore > 0) {
			modal.updateMessage({
				message:
					"正文配图占位已按文中提示词直连生图，跳过「额外拆提示词规划」步骤。",
			});
		} else {
			modal.updateMessage({
				message:
					"正文已含 assets/illustrations 插图，且无 gzh-figure 占位，跳过备选插图规划。",
			});
		}

			trace.illustration_branch =
				placeholdersBefore > 0
					? "gzh_figure_resolve"
					: !hadAssetFiguresBeforeLlmFallback
						? "llm_illustration_plan"
						: "skipped_has_asset_images";
			trace.final_before_wechat_input = summarizeMarkdownBodyForTrace(
				articleMd,
				"写入 publish/wechat-input 前的终稿正文",
			);

			assertPublishBodyIllustrationCountInPolicy(articleMd);
			trace.publish_body_illustration_links_count =
				countPublishIllustrationMarkdownImages(articleMd);

		modal.updateMessage({ message: "正在生成 publish/wechat-input.md …" });
		await this.files.mkdirp(joinVaultPath(projectRoot, PUBLISH_LAYOUT.logsDir));
		const wechatMd = buildWechatInputMarkdown({
			finalBody: articleMd,
			meta,
			draftTitle: wechatArticleTitle,
			authorFromSettings: settings.wechatAuthor,
			coverVaultPathFromPublish: coverRelativeVaultFromWechatMd(),
			illustrationBlock: "",
		});
		await this.files.writeTextFile(
			joinVaultPath(projectRoot, PUBLISH_LAYOUT.wechatInput),
			wechatMd,
		);

			trace.publish_wechat_input_path = PUBLISH_LAYOUT.wechatInput;
			trace.wechat_input_body_preview =
				summarizeMarkdownBodyForTrace(
					bodyAfterSimpleYamlFrontmatter(wechatMd),
					"wechat-input 正文（已去 YAML）",
				);

		modal.updateMessage({
			message:
				"正在 Raphael 排版并上传到微信公众号草稿箱（官方 API）…",
		});
		console.info(WECHAT_DRAFT_LOG, "调用 pushWechatDraftFromVault", {
			projectRootVault: projectRoot,
			hasAppIdSecret: Boolean(
				settings.wechatAppId.trim() && settings.wechatAppSecret.trim(),
			),
		});

		let apiRes;
		try {
			apiRes = await pushWechatDraftFromVault({
				app: this.app,
				projectRootVault: projectRoot,
				settings,
			});
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			trace.wechat_draft_http_error = msg;
			console.error(WECHAT_DRAFT_LOG, "API 异常", e);
			const metaFail: ArticleMeta = {
				...meta,
				updatedAt: isoNow(),
				publish: {
					...(meta.publish ?? {}),
					wechat: {
						lastRunAt: isoNow(),
						success: false,
						error: msg.slice(0, 2000),
					},
				},
			};
			await this.persistMeta(projectRoot, metaFail);
			throw e;
		}

			trace.wechat_render_phase = apiRes.illustrationTrace;

		const resultPayload = JSON.stringify(
			{
				ok: apiRes.ok,
				media_id: apiRes.media_id,
				errmsg: apiRes.errmsg,
				raw: apiRes.raw,
			},
			null,
			2,
		);
		await this.files.writeTextFile(
			joinVaultPath(projectRoot, PUBLISH_LAYOUT.wechatResult),
			resultPayload + "\n",
		);

		if (!apiRes.ok || !apiRes.media_id) {
			trace.wechat_draft_media_rejected = {
				ok: apiRes.ok,
				errmsg: apiRes.errmsg,
				rawSnippet: JSON.stringify(apiRes.raw).slice(0, 500),
			};
			const metaFail: ArticleMeta = {
				...meta,
				updatedAt: isoNow(),
				publish: {
					...(meta.publish ?? {}),
					wechat: {
						lastRunAt: isoNow(),
						success: false,
						error: apiRes.errmsg ?? JSON.stringify(apiRes.raw).slice(0, 2000),
						raw: apiRes.raw,
					},
				},
			};
			await this.persistMeta(projectRoot, metaFail);
			throw new Error(
				`公众号草稿 API 未返回 media_id。详见 ${PUBLISH_LAYOUT.wechatResult} 与控制台 ${WECHAT_DRAFT_LOG}`,
			);
		}

		console.info(WECHAT_DRAFT_LOG, "草稿 media_id", {
			media_id: apiRes.media_id,
		});

		const metaOk: ArticleMeta = {
			...meta,
			updatedAt: isoNow(),
			publish: {
				...(meta.publish ?? {}),
				coverGeneratedAt: isoNow(),
				illustrationsGeneratedAt: isoNow(),
				coverPromptVaultPath: PUBLISH_LAYOUT.coverPromptFile,
				wechat: {
					lastRunAt: isoNow(),
					success: true,
					media_id: apiRes.media_id,
					raw: apiRes.raw,
				},
			},
		};
		await this.persistMeta(projectRoot, metaOk);
		} catch (flowErr: unknown) {
			trace.publish_outer_try_error =
				flowErr instanceof Error ? flowErr.message : String(flowErr);
			throw flowErr;
		} finally {
			try {
				await this.files.mkdirp(
					joinVaultPath(projectRoot, PUBLISH_LAYOUT.logsDir),
				);
				await this.files.writeTextFile(
					joinVaultPath(
						projectRoot,
						PUBLISH_LAYOUT.gzhPublishTraceLastMarkdown,
					),
					formatIllustrationTraceMarkdown(trace),
				);
				logIllustrationTraceCompact(trace);
			} catch (persistErr: unknown) {
				console.warn(
					TRACE_LOG,
					"写入配图诊断 Markdown 失败（不影响发布异常）",
					persistErr,
				);
			}
		}
	}

	async mokaImageCardsFlow(
		projectRoot: string,
		meta: ArticleMeta,
		modal: WorkingModal,
		platformOverride?: MokaCardPlatform,
	): Promise<void> {
		const settings = this.getSettings();
		assertApiKeyConfigured(settings);

		const platform: MokaCardPlatform =
			platformOverride ?? settings.mokaCardsDefaultPlatform;

		const template =
			platform === "xhs"
				? settings.mokaCardTemplateXhs
				: settings.mokaCardTemplateWechat;
		const palette =
			platform === "xhs"
				? settings.mokaCardPaletteXhs
				: settings.mokaCardPaletteWechat;

		console.info("[GZH Moka 卡片]", "开始 Native DOM 导出", {
			projectRootVault: projectRoot,
			platform,
			template,
			palette,
		});

		const finalPath = joinVaultPath(projectRoot, STAGE_FILES.final);
		const finalMd = await this.files.readTextFile(finalPath);

		modal.updateMessage({
			title: "图文卡片",
			message: "正在向模型请求 Moka 风格卡组 JSON…",
		});

		const splitPrompt = nativeMokaSplitPrompt(settings, platform, finalMd);
		const raw = await this.llm.generate(splitPrompt);
		const deck = parseNativeMokaDeckFromLlm({
			raw,
			fallbackPlatform: platform,
			fallbackTemplate: template,
			fallbackPalette: palette,
		});

		deck.platform = platform;
		deck.template = template;
		deck.palette = palette;

		const outlineMd = buildMokaOutlineMarkdown(deck);
		const render = new MokaCardRenderService(this.files);
		await this.files.mkdirp(joinVaultPath(projectRoot, MOKA_LAYOUT.rootDir));
		await render.persistDeckArtifacts({
			projectRoot,
			deck,
			outlineMd,
		});

		modal.updateMessage({ message: "正在用 html-to-image 导出 PNG…" });
		const pngPaths = await render.exportDeckToVault({
			projectRoot,
			deck,
			exportPixelRatio: settings.mokaCardExportPixelRatio,
			cardWxH: settings.mokaCardSizeWxH,
		});

		const deckVault = joinVaultPath(projectRoot, MOKA_LAYOUT.deckJson);
		const outlineVault = joinVaultPath(projectRoot, MOKA_LAYOUT.outlineMd);

		const metaNext: ArticleMeta = {
			...meta,
			updatedAt: isoNow(),
			publish: {
				...(meta.publish ?? {}),
				mokaCards: {
					lastRunAt: isoNow(),
					deckVaultPath: deckVault,
					outlineVaultPath: outlineVault,
					platform,
					template: deck.template,
					palette: deck.palette,
					slideCount: deck.slides.length,
					pngPaths,
				},
			},
		};
		await this.persistMeta(projectRoot, metaNext);

		const leaf = this.app.workspace.getLeaf(false);
		const f = this.app.vault.getAbstractFileByPath(outlineVault);
		if (f instanceof TFile) await leaf.openFile(f);
	}
}

function sanitizeBaseName(raw: string): string {
	let s = raw.trim().replace(/[/\\]/g, "-").replace(/\s+/g, "-").toLowerCase();
	if (!/^\d{2}-/.test(s)) s = `01-${s}`;
	return s.slice(0, 80).replace(/\.$/, "");
}

function parseIllustrationsJson(raw: string): {
	outline_md: string;
	items: Array<{
		file_base: string;
		prompt_en: string;
		caption_zh: string;
		section_after_zh: string;
	}>;
} {
	try {
		const j = JSON.parse(stripCodeFencesJson(raw)) as Record<string, unknown>;
		const outline_md =
			typeof j.outline_md === "string"
				? j.outline_md
				: "# Illustrations\n（模型未给出 outline markdown）";
		const itemsUnknown = Array.isArray(j.items) ? j.items : [];
		const items = itemsUnknown
			.filter(
				(row): row is Record<string, unknown> => !!row && typeof row === "object",
			)
			.map((row, idx) => ({
				file_base:
					String(row.file_base ?? `item-${idx + 1}`)
						.replace(/\.png$/i, "")
						.trim(),
				prompt_en: String(
					row.prompt_en ??
						"minimal editorial illustration flat vector",
				),
				caption_zh: String(
					row.caption_zh ?? `插图 ${idx + 1}`,
				).trim(),
				section_after_zh:
					typeof row.section_after_zh === "string"
						? row.section_after_zh.trim()
						: "",
			}));
		const safeItems = items.length ? items.slice(0, 3) : [
					{
						file_base: "01-default",
						prompt_en:
							"Soft editorial illustration, white background, calm colors, single metaphor object",
						caption_zh: "默认配图",
						section_after_zh: "",
					},
				];
		return { outline_md, items: safeItems };
	} catch {
		return {
			outline_md:
				"# Illustrations\n（JSON 解析失败，已回退单图）",
			items: [
				{
					file_base: "01-fallback",
					prompt_en:
						"Modern minimal editorial illustration for article, soft palette, clean vector",
					caption_zh: "备用配图",
					section_after_zh: "",
				},
			],
		};
	}
}

function parseLlmCoverTitles(raw: string): {
	title: string;
	subtitle: string;
} {
	try {
		const s = stripCodeFencesJson(raw).trim();
		const j = JSON.parse(s) as Record<string, unknown>;
		return {
			title: typeof j.title === "string" ? j.title.trim().slice(0, 20) : "",
			subtitle:
				typeof j.subtitle === "string" ? j.subtitle.trim().slice(0, 60) : "",
		};
	} catch {
		const t = /["']title["']\s*:\s*["']([^"']{1,20})["']/.exec(raw);
		const s = /["']subtitle["']\s*:\s*["']([^"']{1,60})["']/.exec(raw);
		return {
			title: t ? t[1].trim() : "",
			subtitle: s ? s[1].trim() : "",
		};
	}
}

/**
 * Insert illustration images into the article body after the sections the LLM
 * specified. Falls back to appending at end for items with no matching section.
 */
function insertIllustrationsInline(
	md: string,
	items: Array<{ fromPublish: string; caption: string; sectionAfter: string }>,
): string {
	let result = md;
	const fallback: string[] = [];
	for (const item of items) {
		const imageMarkdown = `\n\n![${item.caption}](${item.fromPublish})`;
		const section = item.sectionAfter?.trim();
		if (!section) {
			fallback.push(imageMarkdown);
			continue;
		}
		const escaped = section.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
		const re = new RegExp(`(^#{1,3}\\s+${escaped}\\s*$)`, "m");
		const m = re.exec(result);
		if (!m) {
			fallback.push(imageMarkdown);
			continue;
		}
		const headingEnd = m.index + m[0].length;
		const nextHeading = result.slice(headingEnd).search(/^#{1,6}\s/m);
		const insertAt =
			nextHeading >= 0
				? headingEnd + nextHeading
				: result.length;
		result =
			result.slice(0, insertAt).trimEnd() +
			imageMarkdown +
			"\n\n" +
			result.slice(insertAt).trimStart();
	}
	if (fallback.length) {
		result = result.trimEnd() + fallback.join("\n\n") + "\n";
	}
	return result;
}

function buildMokaOutlineMarkdown(
	deck: import("../types").NativeMokaDeck,
): string {
	if (deck.platform === "xhs") {
		return buildXhsMokaOutlineMarkdown(deck);
	}
	const lines = [
		`# Moka Native 卡片 (${deck.platform})`,
		``,
		`- 模板: ${deck.template}`,
		`- 调色: ${deck.palette}`,
		``,
	];
	let i = 0;
	for (const s of deck.slides) {
		i += 1;
		if (s.kind === "cover") {
			lines.push(`## ${String(i).padStart(2, "0")} cover`);
			lines.push(`- emoji: ${s.emoji}`);
			lines.push(`- title: ${s.title}`);
			lines.push(`- subtitle: ${s.subtitle}`, ``);
		} else if (s.kind === "content") {
			lines.push(`## ${String(i).padStart(2, "0")} ${s.heading}`);
			lines.push(s.text.replace(/\r/g, ""));
			if (s.extra?.trim()) lines.push("", `补充：${s.extra}`);
			lines.push("");
		} else {
			lines.push(`## ${String(i).padStart(2, "0")} end`);
			lines.push(`- CTA: ${s.cta}`);
			lines.push(`- sub: ${s.sub}`);
			lines.push(`- tags: ${s.tags.join(" ")}`, ``);
		}
	}
	return lines.join("\n");
}

function buildXhsMokaOutlineMarkdown(
	deck: import("../types").NativeMokaDeck,
): string {
	const lines = [
		"# 小红书图文卡片 outline",
		"",
		"- 定位: 家庭教育 / 真实爸爸视角",
		"- 策略: 已要求模型在 3 个方向（情绪冲突 / 方法清晰 / 轻松共鸣）中选择最易收藏转发的一套",
		`- 模板: ${deck.template}`,
		`- 调色: ${deck.palette}`,
		`- 页数: ${deck.slides.length}`,
		"",
	];

	let i = 0;
	for (const s of deck.slides) {
		i += 1;
		if (s.kind === "cover") {
			lines.push(`## ${String(i).padStart(2, "0")} 封面标题`);
			lines.push(s.title);
			if (s.subtitle.trim()) lines.push(s.subtitle.trim());
			lines.push("");
			continue;
		}
		if (s.kind === "content") {
			lines.push(`## ${String(i).padStart(2, "0")} ${s.heading}`);
			lines.push(...splitMokaCardLines(s.text));
			if (s.extra?.trim()) {
				lines.push("", "补充/角标:");
				lines.push(...splitMokaCardLines(s.extra));
			}
			lines.push("");
			continue;
		}
		lines.push(`## ${String(i).padStart(2, "0")} 结尾页`);
		lines.push(s.cta);
		if (s.sub.trim()) lines.push(s.sub.trim());
		if (s.tags.length) lines.push("", s.tags.join(" "));
		lines.push("");
	}

	return lines.join("\n");
}

function splitMokaCardLines(text: string): string[] {
	return text
		.replace(/\r/g, "")
		.split("\n")
		.map((line) => line.trim())
		.filter(Boolean);
}
