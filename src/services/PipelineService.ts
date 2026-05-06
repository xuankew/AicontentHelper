import type { App } from "obsidian";
import { Platform, TFile } from "obsidian";
import type {
	ArticleMeta,
	GzhWritingPipelineSettings,
	MokaCardPlatform,
	NativeMokaDeck,
} from "../types";
import { STAGE_FILES } from "../templates/fileTemplates";
import { isoNow } from "../templates/metaTemplate";
import { joinVaultPath, normalizeVaultPath } from "../utils/path";
import { splitReviewOutput } from "../utils/review";
import {
	ArticleProjectService,
	assertApiKeyConfigured,
	pickActiveModel,
} from "./ArticleProjectService";
import { FileService } from "./FileService";
import { LLMService } from "./LLMService";
import { PromptService } from "./PromptService";
import { StateService } from "./StateService";
import { ImageGenerationService } from "./ImageGenerationService";
import { PublishOrchestrator } from "./PublishOrchestrator";
import { VideoRenderService } from "./VideoRenderService";
import { MokaCardRenderService } from "./MokaCardRenderService";
import { confirmOverwrite } from "../ui/ConfirmModal";
import { showErrorNotice, showSuccessNotice } from "../ui/NoticeHelper";
import { WorkingModal, type WorkingModalOptions } from "../ui/LoadingModal";
import {
	MOKA_LAYOUT,
	PUBLISH_LAYOUT,
	VIDEO_LAYOUT,
} from "../constants/publishPaths";

export class PipelineService {
	private readonly files: FileService;
	private readonly state: StateService;
	private readonly projects: ArticleProjectService;
	private readonly llm: LLMService;
	private readonly prompts: PromptService;
	private readonly imgGen: ImageGenerationService;
	private readonly publishFlows: PublishOrchestrator;
	private readonly video: VideoRenderService;

	constructor(
		private readonly app: App,
		private readonly getSettings: () => GzhWritingPipelineSettings,
		private readonly pluginManifestId: string,
	) {
		this.files = new FileService(app.vault);
		this.state = new StateService(app.vault, getSettings);
		this.projects = new ArticleProjectService(this.files, getSettings);
		this.llm = new LLMService(getSettings);
		this.prompts = new PromptService();
		this.imgGen = new ImageGenerationService(app, this.files, getSettings);
		this.publishFlows = new PublishOrchestrator(
			app,
			this.files,
			this.llm,
			this.imgGen,
			getSettings,
			(root, meta) => this.persistMeta(root, meta),
			pluginManifestId,
		);
		this.video = new VideoRenderService(
			app,
			getSettings,
			pluginManifestId,
		);
	}

	/** 审稿完成：发布到微信公众号草稿（桌面端 · 内置微信 draft API）。 */
	async publishToWechatOfficial(): Promise<void> {
		if (!Platform.isDesktopApp) {
			showErrorNotice("「发布到公众号」仅支持 Obsidian 桌面端。");
			return;
		}

		const active = this.app.workspace.getActiveFile();
		if (!active) {
			showErrorNotice("请先打开一个仓库文件。");
			return;
		}

		const working = new WorkingModal(this.app, {
			title: "发布到公众号",
			message: "正在准备项目、生图并调用微信 API…",
		});
		try {
			const projectRoot = await this.state.resolvePublishedProjectRoot(
				active.path,
			);
			const meta = projectRoot
				? await this.state.readMeta(projectRoot)
				: null;
			if (!projectRoot || !meta) {
				throw new Error("当前不在公众号文章项目中。");
			}
			if (meta.status !== "reviewed") {
				throw new Error("请先完成审稿，生成 04-final.md 后再发布。");
			}
			const finalPath = joinVaultPath(projectRoot, STAGE_FILES.final);
			if (!(await this.files.pathExists(finalPath))) {
				throw new Error("请先完成审稿，生成 04-final.md 后再发布。");
			}

			const settings = this.getSettings();
			this.assertProviderReady(settings);
			assertApiKeyConfigured(settings);

			await this.publishFlows.publishOfficialAccountFlow(
				projectRoot,
				meta,
				working,
			);
			console.info(
				"[GZH 公众号草稿]",
				"整条发布流水线已成功完成（含微信官方 draft API）；若后台未见草稿请查看 publish/wechat-result.json 与控制台",
				{ projectRootVault: projectRoot },
			);
			showSuccessNotice(
				`已生成 publish/ 产物并写入公众号草稿（API）。插图诊断：${PUBLISH_LAYOUT.gzhPublishTraceLastMarkdown}（在当前文章工程根下）。详见 publish/wechat-result.json、meta.json。`,
			);
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			console.error("[GZH 公众号草稿]", "整条发布链路异常（含封面 / 配图 / 上传任一步骤）:", e);
			showErrorNotice(msg);
		} finally {
			working.close();
		}
	}

	/** 审稿完成：Moka DOM 卡组；`platform` 缺省则用设置里的默认平台。 */
	async generateImageCards(platform?: MokaCardPlatform): Promise<void> {
		if (!Platform.isDesktopApp) {
			showErrorNotice("「图文」仅支持 Obsidian 桌面端。");
			return;
		}

		const active = this.app.workspace.getActiveFile();
		if (!active) {
			showErrorNotice("请先打开一个仓库文件。");
			return;
		}

		const working = new WorkingModal(this.app, {
			title: "Moka 图文",
			message: "正在读取 04-final.md …",
		});
		try {
			const projectRoot = await this.state.resolvePublishedProjectRoot(
				active.path,
			);
			const meta = projectRoot
				? await this.state.readMeta(projectRoot)
				: null;
			if (!projectRoot || !meta) {
				throw new Error("当前不在公众号文章项目中。");
			}
			if (meta.status !== "reviewed") {
				throw new Error("请先完成审稿，生成 04-final.md 后再生成图文卡片。");
			}
			const finalPath = joinVaultPath(projectRoot, STAGE_FILES.final);
			if (!(await this.files.pathExists(finalPath))) {
				throw new Error("请先完成审稿，生成 04-final.md 后再生成图文卡片。");
			}

			const settings = this.getSettings();
			this.assertProviderReady(settings);
			assertApiKeyConfigured(settings);

			await this.publishFlows.mokaImageCardsFlow(
				projectRoot,
				meta,
				working,
				platform,
			);
			showSuccessNotice(
				"Native Moka 卡片已生成，已打开 outline。详见 assets/moka-cards/",
			);
		} catch (e) {
			showErrorNotice(e instanceof Error ? e.message : String(e));
		} finally {
			working.close();
		}
	}

	/** 「视频」按钮：生成口播 + 三平台发布文案，并分别导出三条平台视频。 */
	async generateVideoFromXhsCards(): Promise<void> {
		if (!Platform.isDesktopApp) {
			showErrorNotice("「视频」仅支持 Obsidian 桌面端。");
			return;
		}

		const active = this.app.workspace.getActiveFile();
		if (!active) {
			showErrorNotice("请先打开一个仓库文件。");
			return;
		}

		const working = new WorkingModal(this.app, {
			title: "视频",
			message: "正在校验小红书图文产物…",
		});
		try {
			const projectRoot = await this.state.resolvePublishedProjectRoot(
				active.path,
			);
			const meta = projectRoot
				? await this.state.readMeta(projectRoot)
				: null;
			if (!projectRoot || !meta) {
				throw new Error("当前不在公众号文章项目中。");
			}
			if (meta.status !== "reviewed") {
				throw new Error("请先完成审稿，生成 04-final.md 后再生成视频。");
			}
			const finalPath = joinVaultPath(projectRoot, STAGE_FILES.final);
			if (!(await this.files.pathExists(finalPath))) {
				throw new Error("请先完成审稿，生成 04-final.md 后再生成视频。");
			}

			const xhs = meta.publish?.mokaCards;
			const cardsDirReady =
				xhs &&
				xhs.platform === "xhs" &&
				Array.isArray(xhs.pngPaths) &&
				xhs.pngPaths.length > 0;
			if (!cardsDirReady) {
				throw new Error("还未生成小红书图文");
			}

			const settings = this.getSettings();
			this.assertProviderReady(settings);
			assertApiKeyConfigured(settings);

			working.updateMessage({ message: "正在请求模型生成口播稿与三平台发布文案…" });
			const finalMd = await this.files.readTextFile(finalPath);
			const scriptPrompt = this.prompts.fill(settings.videoScriptPrompt, {
				authorProfilePrompt: settings.authorProfilePrompt,
				writingStylePrompt: settings.writingStylePrompt,
				finalContent: finalMd,
				sourceContent: "",
				outlineContent: "",
				draftContent: "",
				humanizedContent: "",
			});
			const rawBundle = await this.llm.generate(scriptPrompt);
			const bundle = parseVideoBundle(rawBundle);
			const voiceover = sanitizeVoiceoverText(bundle.voiceover);
			if (voiceover.length < 40) {
				throw new Error(
					"模型返回的口播稿过短，请检查 finalContent 与「口播稿提示词」。",
				);
			}

			const videoDir = joinVaultPath(projectRoot, VIDEO_LAYOUT.rootDir);
			await this.files.mkdirp(videoDir);

			const voiceoverVault = joinVaultPath(
				projectRoot,
				VIDEO_LAYOUT.voiceover,
			);
			await this.files.writeTextFile(
				voiceoverVault,
				`# 口播稿（约 30 秒，${voiceover.length} 字）\n\n${voiceover}\n`,
			);

			const accountInfo = settings.wechatAuthor.trim() || "@真实爸爸";

			const postsMd = joinVaultPath(projectRoot, VIDEO_LAYOUT.platformPostsMd);
			const postsJson = joinVaultPath(projectRoot, VIDEO_LAYOUT.platformPostsJson);
			await this.files.writeTextFile(postsMd, formatPlatformPostsMarkdown(bundle));
			await this.files.writeTextFile(
				postsJson,
				JSON.stringify(bundle, null, 2) + "\n",
			);

			const configVault = joinVaultPath(
				projectRoot,
				VIDEO_LAYOUT.configJson,
			);
			const configPayload = {
				generatedAt: isoNow(),
				platformTitles: {
					shipinhao: bundle.shipinhao.title,
					xiaohongshu: bundle.xiaohongshu.title,
					douyin: bundle.douyin.title,
				},
				accountInfo,
				ttsEngine: settings.videoTtsEngine,
				openSec: settings.videoOpenSec,
				endSec: settings.videoEndSec,
				cardsCount: xhs.pngPaths?.length ?? 0,
			};
			await this.files.writeTextFile(
				configVault,
				JSON.stringify(configPayload, null, 2) + "\n",
			);

			working.updateMessage({
				message:
					"正在用 Moka 模版导出视频用图片，并调用 ListenHub + FFmpeg 合成三平台视频，可能需要 1–3 分钟…",
			});

			const deckPath =
				xhs?.deckVaultPath || joinVaultPath(projectRoot, MOKA_LAYOUT.deckJson);
			if (!(await this.files.pathExists(deckPath))) {
				throw new Error("缺少 Moka deck.json，无法按模版重导视频图片。请先重新生成小红书图文。");
			}
			const deckRaw = await this.files.readTextFile(deckPath);
			const deck = JSON.parse(deckRaw) as NativeMokaDeck;
			const mokaRender = new MokaCardRenderService(this.files);
			const allCardPaths = await mokaRender.exportDeckToVault({
				projectRoot,
				deck,
				exportPixelRatio: settings.mokaCardExportPixelRatio,
				cardWxH: settings.mokaCardSizeWxH,
				outputRootDir: VIDEO_LAYOUT.mokaFramesDir,
			});
			const coverPath =
				allCardPaths.find((p) => /(?:^|\/)\d+-cover\.png$/i.test(p)) ||
				allCardPaths[0];
			const middlePaths = allCardPaths.filter(
				(p) =>
					p !== coverPath &&
					!/(?:^|\/)\d+-end\.png$/i.test(p),
			);
			const fallbackMiddle = middlePaths.length > 0 ? middlePaths : allCardPaths;

			let result;
			try {
				result = await this.video.render({
					outputDirVault: videoDir,
					coverPngVault: coverPath,
					middlePngVaultPaths: fallbackMiddle,
					voiceover,
					platformCopies: {
						xiaohongshu: {
							title: bundle.xiaohongshu.title,
							openingText: firstSentence(voiceover, bundle.xiaohongshu.body),
							endingText: lastSentence(voiceover, bundle.xiaohongshu.body),
						},
						douyin: {
							title: bundle.douyin.title,
							openingText: firstSentence(voiceover, bundle.douyin.body),
							endingText: lastSentence(voiceover, bundle.douyin.body),
						},
						shipinhao: {
							title: bundle.shipinhao.title,
							openingText: firstSentence(voiceover, bundle.shipinhao.body),
							endingText: lastSentence(voiceover, bundle.shipinhao.body),
						},
					},
					accountInfo,
				});
			} catch (renderErr) {
				const msg =
					renderErr instanceof Error
						? renderErr.message
						: String(renderErr);
				const metaFail: ArticleMeta = {
					...meta,
					updatedAt: isoNow(),
					publish: {
						...(meta.publish ?? {}),
						video: {
							lastRunAt: isoNow(),
							scriptVaultPath: voiceoverVault,
							configVaultPath: configVault,
							ttsEngine: settings.videoTtsEngine,
							error: msg.slice(0, 1500),
						},
					},
				};
				await this.persistMeta(projectRoot, metaFail);
				throw renderErr;
			}

			const metaOk: ArticleMeta = {
				...meta,
				updatedAt: isoNow(),
				publish: {
					...(meta.publish ?? {}),
					video: {
						lastRunAt: isoNow(),
						scriptVaultPath: voiceoverVault,
						configVaultPath: configVault,
						outputVaultPath: result.outputVaultPath,
						voiceSec: estimateVoiceoverSeconds(voiceover),
						ttsEngine: settings.videoTtsEngine,
					},
				},
			};
			await this.persistMeta(projectRoot, metaOk);

			showSuccessNotice(
				`视频已生成：${Object.values(result.outputs).join("、")}；文案见 ${VIDEO_LAYOUT.platformPostsMd}。`,
			);
		} catch (e) {
			showErrorNotice(e instanceof Error ? e.message : String(e));
		} finally {
			working.close();
		}
	}

	async outlineFromSourceCard(): Promise<void> {
		const sourceFile = this.app.workspace.getActiveFile();
		if (!(sourceFile instanceof TFile) || sourceFile.extension.toLowerCase() !== "md") {
			showErrorNotice("请先打开一篇 Markdown 文件。");
			return;
		}

		const working = new WorkingModal(this.app, {
			title: "列提纲",
			message: [
				"正在为当前笔记在 Published 下创建新项目目录（如尚未就绪），并把原文备份到 00-source.md。",
				"随后按「列提纲提示词」向模型请求提炼主线与结构框架等，成功后生成 01-outline.md。",
			].join("\n"),
		});
		try {
			const projectRoot = await this.state.resolvePublishedProjectRoot(
				sourceFile.path,
			);
			const meta = projectRoot
				? await this.state.readMeta(projectRoot)
				: null;
			this.state.assertCanRunStep({
				step: "outline",
				projectRoot,
				meta,
			});

			const settings = this.getSettings();
			this.assertProviderReady(settings);
			assertApiKeyConfigured(settings);

			const markdown = await this.app.vault.read(sourceFile);
			const title = this.projects.extractTitle(sourceFile.path, markdown);

			const publishedRoot = this.projects.getPublishedRootForSourceFile(
				sourceFile.path,
			);
			await this.files.mkdirp(publishedRoot);

			const projectDirPath = await this.projects.ensureUniqueProjectDir({
				publishedRoot,
				title,
			});

			const sourceTarget = joinVaultPath(projectDirPath, STAGE_FILES.source);
			if (await this.files.pathExists(sourceTarget)) {
				throw new Error("项目目录异常：00-source.md 已存在。");
			}
			await this.files.createTextFile(sourceTarget, markdown);

			let metaNext = this.projects.buildInitialMeta({
				title,
				sourceFilePath: sourceFile.path,
				projectDirPath,
			});
			await this.persistMeta(projectDirPath, metaNext);

			const prompt = this.prompts.fill(settings.outlinePrompt, {
				authorProfilePrompt: settings.authorProfilePrompt,
				writingStylePrompt: settings.writingStylePrompt,
				sourceContent: markdown,
				outlineContent: "",
				draftContent: "",
				humanizedContent: "",
			});

			working.updateMessage({
				title: "列提纲",
				message: [
					"目录与源码已就绪。",
					"正在向模型请求生成 01-outline.md（可能需要数十秒）…",
				].join("\n"),
			});
			const output = await this.llm.generate(prompt);

			await this.writeStageMarkdown({
				projectRoot: projectDirPath,
				relativePath: STAGE_FILES.outline,
				content: output,
				allowUserConfirmOverwrite: false,
			});

			metaNext = {
				...metaNext,
				status: "outlined",
				updatedAt: isoNow(),
				files: {
					...metaNext.files,
					outline: STAGE_FILES.outline,
				},
				provider: settings.provider,
				model: pickActiveModel(settings),
			};
			await this.persistMeta(projectDirPath, metaNext);

			await this.openMarkdown(joinVaultPath(projectDirPath, STAGE_FILES.outline));
			showSuccessNotice(`列提纲完成，已生成 ${STAGE_FILES.outline}。`);
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			showErrorNotice(msg);
		} finally {
			working.close();
		}
	}

	async draftFromOutline(): Promise<void> {
		await this.runLlmStage({
			step: "draft",
			working: {
				title: "扩写",
				message: [
					"正在读取当前文章项目内的 01-outline.md。",
					"按「扩写提示词」向模型请求把提纲展开成公众号初稿，成功后写入 02-draft.md。",
				].join("\n"),
			},
			inputReader: async ({ projectRoot, settings }) => {
				const outlinePath = joinVaultPath(projectRoot, STAGE_FILES.outline);
				const outline = await this.files.readTextFile(outlinePath);
				return this.prompts.fill(settings.draftPrompt, {
					authorProfilePrompt: settings.authorProfilePrompt,
					writingStylePrompt: settings.writingStylePrompt,
					sourceContent: "",
					outlineContent: outline,
					draftContent: "",
					humanizedContent: "",
				});
			},
			outputRelativePath: STAGE_FILES.draft,
			patchMeta: (meta) => ({
				...meta,
				status: "drafted",
				files: { ...meta.files, draft: STAGE_FILES.draft },
			}),
			successNotice: `扩写完成，已生成 ${STAGE_FILES.draft}。`,
			openRelativePath: STAGE_FILES.draft,
		});
	}

	async humanizeFromDraft(): Promise<void> {
		await this.runLlmStage({
			step: "humanize",
			working: {
				title: "去 AI 味",
				message: [
					"正在读取 02-draft.md。",
					"按提示词请求模型压低套话／「AI 腔」、改成更口语化，成功后写入 03-humanized.md。",
				].join("\n"),
			},
			inputReader: async ({ projectRoot, settings }) => {
				const draftPath = joinVaultPath(projectRoot, STAGE_FILES.draft);
				const draft = await this.files.readTextFile(draftPath);
				return this.prompts.fill(settings.humanizePrompt, {
					authorProfilePrompt: settings.authorProfilePrompt,
					writingStylePrompt: settings.writingStylePrompt,
					sourceContent: "",
					outlineContent: "",
					draftContent: draft,
					humanizedContent: "",
				});
			},
			outputRelativePath: STAGE_FILES.humanized,
			patchMeta: (meta) => ({
				...meta,
				status: "humanized",
				files: { ...meta.files, humanized: STAGE_FILES.humanized },
			}),
			successNotice: `去 AI 味完成，已生成 ${STAGE_FILES.humanized}。`,
			openRelativePath: STAGE_FILES.humanized,
		});
	}

	async reviewFromHumanized(): Promise<void> {
		const active = this.app.workspace.getActiveFile();
		if (!active) {
			showErrorNotice("请先打开一个仓库文件。");
			return;
		}

		const working = new WorkingModal(this.app, {
			title: "审稿",
			message: [
				"正在读取 03-humanized.md。",
				"向模型请求「发布前校准稿」和「审稿报告」；模型须按分隔符输出，插件再分别写入 04-final.md 与 05-review-report.md。",
			].join("\n"),
		});
		try {
			const projectRoot = await this.state.resolvePublishedProjectRoot(
				active.path,
			);
			const meta = projectRoot
				? await this.state.readMeta(projectRoot)
				: null;
			this.state.assertCanRunStep({
				step: "review",
				projectRoot,
				meta,
			});
			if (!projectRoot || !meta) return;

			const settings = this.getSettings();
			this.assertProviderReady(settings);
			assertApiKeyConfigured(settings);

			const humanizedPath = joinVaultPath(
				projectRoot,
				STAGE_FILES.humanized,
			);
			const humanized = await this.files.readTextFile(humanizedPath);

			const prompt = this.prompts.fill(settings.reviewPrompt, {
				authorProfilePrompt: settings.authorProfilePrompt,
				writingStylePrompt: settings.writingStylePrompt,
				sourceContent: "",
				outlineContent: "",
				draftContent: "",
				humanizedContent: humanized,
			});

			const output = await this.llm.generate(prompt);
			const { final, report } = splitReviewOutput(output);

			const finalPath = joinVaultPath(projectRoot, STAGE_FILES.final);
			const reportPath = joinVaultPath(projectRoot, STAGE_FILES.reviewReport);

			let wroteFinal = false;
			try {
				await this.writeStageMarkdown({
					projectRoot,
					relativePath: STAGE_FILES.final,
					content: final,
					allowUserConfirmOverwrite: true,
				});
				wroteFinal = true;
				await this.writeStageMarkdown({
					projectRoot,
					relativePath: STAGE_FILES.reviewReport,
					content: report,
					allowUserConfirmOverwrite: true,
				});
			} catch (e) {
				if (wroteFinal) {
					await this.files.deleteIfExists(finalPath);
					await this.files.deleteIfExists(reportPath);
				}
				throw e;
			}

			const metaNext: ArticleMeta = {
				...meta,
				status: "reviewed",
				updatedAt: isoNow(),
				files: {
					...meta.files,
					final: STAGE_FILES.final,
					reviewReport: STAGE_FILES.reviewReport,
				},
				provider: settings.provider,
				model: pickActiveModel(settings),
			};
			await this.persistMeta(projectRoot, metaNext);

			await this.openMarkdown(finalPath);
			showSuccessNotice("审稿完成，已生成最终文章和审稿报告。");
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			showErrorNotice(msg);
		} finally {
			working.close();
		}
	}

	async openProjectEntryFile(): Promise<void> {
		try {
			const active = this.app.workspace.getActiveFile();
			if (!active) {
				throw new Error("请先打开一个仓库文件。");
			}
			const projectRoot = await this.state.resolvePublishedProjectRoot(
				active.path,
			);
			if (!projectRoot) {
				throw new Error("当前不在公众号文章项目中。");
			}
			await this.state.readMetaOrThrow(projectRoot);

			const candidates = [
				STAGE_FILES.outline,
				STAGE_FILES.draft,
				STAGE_FILES.humanized,
				STAGE_FILES.final,
				STAGE_FILES.source,
				STAGE_FILES.meta,
			];

			for (const rel of candidates) {
				const p = joinVaultPath(projectRoot, rel);
				if (await this.files.pathExists(p)) {
					await this.openPath(p);
					return;
				}
			}
			throw new Error("项目目录下没有可用文件。");
		} catch (e) {
			showErrorNotice(e instanceof Error ? e.message : String(e));
		}
	}

	async openReviewReport(): Promise<void> {
		try {
			const active = this.app.workspace.getActiveFile();
			if (!active) {
				throw new Error("请先打开一个仓库文件。");
			}
			const projectRoot = await this.state.resolvePublishedProjectRoot(
				active.path,
			);
			if (!projectRoot) {
				throw new Error("当前不在公众号文章项目中。");
			}
			const p = joinVaultPath(projectRoot, STAGE_FILES.reviewReport);
			if (!(await this.files.pathExists(p))) {
				throw new Error("审稿报告不存在，请先完成审稿。");
			}
			await this.openMarkdown(p);
		} catch (e) {
			showErrorNotice(e instanceof Error ? e.message : String(e));
		}
	}

	async copyFinalArticle(): Promise<void> {
		try {
			const active = this.app.workspace.getActiveFile();
			if (!active) {
				throw new Error("请先打开一个仓库文件。");
			}
			const projectRoot = await this.state.resolvePublishedProjectRoot(
				active.path,
			);
			if (!projectRoot) {
				throw new Error("当前不在公众号文章项目中。");
			}
			const p = joinVaultPath(projectRoot, STAGE_FILES.final);
			if (!(await this.files.pathExists(p))) {
				throw new Error("最终文章不存在，请先完成审稿。");
			}
			const txt = await this.files.readTextFile(p);
			await navigator.clipboard.writeText(txt);
			showSuccessNotice("已复制最终文章到剪贴板。");
		} catch (e) {
			showErrorNotice(e instanceof Error ? e.message : String(e));
		}
	}

	async refreshContextForActiveFile(): Promise<{ text: string }> {
		const af = this.app.workspace.getActiveFile();
		if (!af) return { text: "GZH: 未打开文件" };

		const projectRoot = await this.state.resolvePublishedProjectRoot(af.path);
		if (!projectRoot) {
			return { text: "GZH: 原始卡片模式（可列提纲）" };
		}

		const meta = await this.state.readMeta(projectRoot);
		if (!meta) {
			return { text: "GZH: 项目 meta 无效" };
		}
		return { text: `GZH: ${meta.status}` };
	}

	private async runLlmStage(params: {
		step: "draft" | "humanize";
		working: WorkingModalOptions;
		inputReader: (ctx: {
			projectRoot: string;
			settings: GzhWritingPipelineSettings;
		}) => Promise<string>;
		outputRelativePath: string;
		patchMeta: (meta: ArticleMeta) => ArticleMeta;
		successNotice: string;
		openRelativePath: string;
	}): Promise<void> {
		const active = this.app.workspace.getActiveFile();
		if (!active) {
			showErrorNotice("请先打开一个仓库文件。");
			return;
		}

		const working = new WorkingModal(this.app, params.working);
		try {
			const projectRoot = await this.state.resolvePublishedProjectRoot(
				active.path,
			);
			const meta = projectRoot
				? await this.state.readMeta(projectRoot)
				: null;
			this.state.assertCanRunStep({
				step: params.step,
				projectRoot,
				meta,
			});
			if (!projectRoot || !meta) return;

			const settings = this.getSettings();
			this.assertProviderReady(settings);
			assertApiKeyConfigured(settings);

			const prompt = await params.inputReader({ projectRoot, settings });
			const output = await this.llm.generate(prompt);

			await this.writeStageMarkdown({
				projectRoot,
				relativePath: params.outputRelativePath,
				content: output,
				allowUserConfirmOverwrite: true,
			});

			const metaNext = {
				...params.patchMeta(meta),
				updatedAt: isoNow(),
				provider: settings.provider,
				model: pickActiveModel(settings),
			};
			await this.persistMeta(projectRoot, metaNext);

			await this.openMarkdown(
				joinVaultPath(projectRoot, params.openRelativePath),
			);
			showSuccessNotice(params.successNotice);
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			showErrorNotice(msg);
		} finally {
			working.close();
		}
	}

	private assertProviderReady(settings: GzhWritingPipelineSettings): void {
		const cfg = settings[settings.provider];
		if (!cfg.model.trim()) {
			throw new Error("请先在插件设置中配置模型名称。");
		}
		if (!cfg.baseUrl.trim()) {
			throw new Error("请先在插件设置中配置 Base URL。");
		}
	}

	private async persistMeta(
		projectRoot: string,
		meta: ArticleMeta,
	): Promise<void> {
		const path = joinVaultPath(projectRoot, STAGE_FILES.meta);
		await this.files.writeTextFile(path, JSON.stringify(meta, null, 2));
	}

	private async writeStageMarkdown(params: {
		projectRoot: string;
		relativePath: string;
		content: string;
		allowUserConfirmOverwrite: boolean;
	}): Promise<void> {
		const settings = this.getSettings();
		const dest = joinVaultPath(params.projectRoot, params.relativePath);
		const existing = this.app.vault.getAbstractFileByPath(dest);
		if (existing instanceof TFile) {
			if (settings.keepHistoryVersions) {
				await this.files.renameWithTimestampSuffix(existing);
			} else if (
				settings.confirmBeforeOverwrite &&
				params.allowUserConfirmOverwrite
			) {
				const ok = await confirmOverwrite(
					this.app,
					`目标文件已存在，是否覆盖？\n${dest}`,
				);
				if (!ok) {
					throw new Error("已取消：未覆盖既有文件。");
				}
			}
		}

		await this.files.writeTextFile(dest, params.content);
	}

	private async openMarkdown(path: string): Promise<void> {
		const norm = normalizeVaultPath(path);
		const f = this.app.vault.getAbstractFileByPath(norm);
		if (!(f instanceof TFile)) return;
		await this.app.workspace.getLeaf(false).openFile(f);
	}

	private async openPath(path: string): Promise<void> {
		await this.openMarkdown(normalizeVaultPath(path));
	}
}

/**
 * Strip markdown noise, the 【口播稿】 header (per default prompt), emoji digit boxes,
 * stray bracket annotations, and outer fences so we hand a clean spoken script to TTS.
 */
function sanitizeVoiceoverText(raw: string): string {
	let s = raw.replace(/^\s*```[a-zA-Z]*\s*/g, "").replace(/```\s*$/g, "");
	s = s.replace(/【口播稿】/g, "");
	s = s.replace(/^#+\s.*$/gm, "");
	s = s.replace(/\*\*/g, "").replace(/__/g, "");
	s = s.replace(/^[\-\*]\s+/gm, "");
	s = s.replace(/^\s*[0-9]+[\.、]\s+/gm, "");
	s = s.replace(/[\u200B-\u200D\uFEFF]/g, "");
	return s.replace(/\s+/g, " ").trim();
}

function splitIntoSentences(text: string): string[] {
	const out: string[] = [];
	const chunks = text.split(/(?<=[。！？!?])/);
	for (const chunk of chunks) {
		const t = chunk.trim();
		if (t.length > 0) out.push(t);
	}
	return out;
}

type PlatformPost = { title: string; body: string; tags: string[] };
type VideoBundle = {
	voiceover: string;
	shipinhao: PlatformPost;
	xiaohongshu: PlatformPost;
	douyin: PlatformPost;
};

function parseVideoBundle(raw: string): VideoBundle {
	const voiceover = blockAfter(raw, /【口播稿】/i);
	const shipTitle = blockAfter(raw, /视频号发布文案[\s\S]*?【标题】/i);
	const shipBody = blockAfter(raw, /视频号发布文案[\s\S]*?【正文】/i);
	const xhsTitle = blockAfter(raw, /小红书发布文案[\s\S]*?【标题】/i);
	const xhsBody = blockAfter(raw, /小红书发布文案[\s\S]*?【正文】/i);
	const xhsTags = splitTags(blockAfter(raw, /小红书发布文案[\s\S]*?【标签】/i));
	const dyTitle = blockAfter(raw, /抖音发布文案[\s\S]*?【标题】/i);
	const dyBody = blockAfter(raw, /抖音发布文案[\s\S]*?【正文】/i);
	const dyTags = splitTags(blockAfter(raw, /抖音发布文案[\s\S]*?【标签】/i));

	return {
		voiceover: voiceover || raw,
		shipinhao: {
			title: shipTitle || "孩子一拖再拖，先别急着催",
			body: shipBody || "今天分享一个我家亲测有效的小方法。",
			tags: [],
		},
		xiaohongshu: {
			title: xhsTitle || "别再只会催作业：一个真实爸爸的反思",
			body: xhsBody || "记录一个今晚就能试的小方法。",
			tags: xhsTags,
		},
		douyin: {
			title: dyTitle || "孩子写作业拖拉？问题可能不在孩子",
			body: dyBody || "3秒抓住核心问题，给你一个可落地的方法。",
			tags: dyTags,
		},
	};
}

function blockAfter(raw: string, marker: RegExp): string {
	const m = marker.exec(raw);
	if (!m) return "";
	const s = raw.slice(m.index + m[0].length);
	const end = s.search(/\n---\n|^##\s+\d+\.?/m);
	const out = (end >= 0 ? s.slice(0, end) : s).trim();
	return out.replace(/^[:：\s]+/, "").trim();
}

function splitTags(raw: string): string[] {
	if (!raw.trim()) return [];
	return raw
		.split(/[\n,，\s]+/)
		.map((x) => x.trim())
		.filter((x) => x.length > 0)
		.map((x) => (x.startsWith("#") ? x : `#${x}`))
		.slice(0, 10);
}

function formatPlatformPostsMarkdown(bundle: VideoBundle): string {
	return [
		"# 短视频平台发布文案",
		"",
		"## 1. 30秒视频口播稿",
		"",
		"【口播稿】",
		bundle.voiceover,
		"",
		"---",
		"",
		"## 2. 视频号发布文案",
		"",
		"【标题】",
		bundle.shipinhao.title,
		"",
		"【正文】",
		bundle.shipinhao.body,
		"",
		"---",
		"",
		"## 3. 小红书发布文案",
		"",
		"【标题】",
		bundle.xiaohongshu.title,
		"",
		"【正文】",
		bundle.xiaohongshu.body,
		"",
		"【标签】",
		bundle.xiaohongshu.tags.join(" "),
		"",
		"---",
		"",
		"## 4. 抖音发布文案",
		"",
		"【标题】",
		bundle.douyin.title,
		"",
		"【正文】",
		bundle.douyin.body,
		"",
		"【标签】",
		bundle.douyin.tags.join(" "),
		"",
	].join("\n");
}

function firstSentence(voiceover: string, fallbackBody: string): string {
	const lines = splitIntoSentences(voiceover);
	return lines[0] || splitIntoSentences(fallbackBody)[0] || voiceover.slice(0, 40);
}

function lastSentence(voiceover: string, fallbackBody: string): string {
	const lines = splitIntoSentences(voiceover);
	const fb = splitIntoSentences(fallbackBody);
	return (
		lines[lines.length - 1] ||
		fb[fb.length - 1] ||
		voiceover.slice(Math.max(0, voiceover.length - 40))
	);
}

function estimateVoiceoverSeconds(voiceover: string): number {
	// Rough Mandarin speech estimate: ~4.3 chars/sec.
	return Math.max(8, Math.round((voiceover.length / 4.3) * 10) / 10);
}
