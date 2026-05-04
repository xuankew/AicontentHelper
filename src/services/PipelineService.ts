import type { App } from "obsidian";
import { Platform, TFile } from "obsidian";
import type {
	ArticleMeta,
	GzhWritingPipelineSettings,
	MokaCardPlatform,
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
import { confirmOverwrite } from "../ui/ConfirmModal";
import { showErrorNotice, showSuccessNotice } from "../ui/NoticeHelper";
import { WorkingModal, type WorkingModalOptions } from "../ui/LoadingModal";
import { PUBLISH_LAYOUT } from "../constants/publishPaths";

export class PipelineService {
	private readonly files: FileService;
	private readonly state: StateService;
	private readonly projects: ArticleProjectService;
	private readonly llm: LLMService;
	private readonly prompts: PromptService;
	private readonly imgGen: ImageGenerationService;
	private readonly publishFlows: PublishOrchestrator;

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
