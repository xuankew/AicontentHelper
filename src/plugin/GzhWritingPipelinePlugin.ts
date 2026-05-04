import { Menu, Plugin } from "obsidian";
import {
	coerceCardPalette,
	coerceCardTemplate,
} from "../settings/mokaCardPresets";
import type { GzhWritingPipelineSettings } from "../types";
import { DEFAULT_SETTINGS } from "../settings/settings";
import { GZHSettingTab, type PipelinePluginLike } from "../settings/SettingTab";
import { coerceWechatSimpleCoverBgId } from "../services/WechatSimpleCoverService";
import { PipelineService } from "../services/PipelineService";
import { registerMarkdownEditorToolbar } from "../ui/EditorToolbar";

const LEGACY_SPLIT_SIZE_KEYS = [
	"imageSizeWechatCover",
	"imageSizeWechatIllustration",
	"imageSizeXhsCover",
	"imageSizeXhsBody",
] as const;

const GZH_FIGURE_DRAFT_APPENDIX = `

附图（正文**不少于 1 处、至多 3 处**，分散插在小节后）：请用 Markdown 伪链接占位，形如
\`![](gzh-figure://前缀-slug:具体画面描写，可用中文细化场景与光影)\`。前缀互不重复；\`![…]\` 内可写中文图注，可选 Obsidian \`|宽度\`。发布时会直接用冒号后的描写生图。

（仍可兼容旧版 \`\`\`gzh-figure\`\`\` 三键代码块占位，全文合计须在 1～3 处以内。）
`;

const GZH_FIGURE_PRESERVE_APPENDIX = `

须完整保留文中的 \`gzh-figure://\` 配图占位与普通 \`\`\`gzh-figure\`\`\` 代码块：勿删除、勿改写成普通外链或 PNG 路径。
`;

function needsFigurePlaceholderHint(prompt: string): boolean {
	const triple = "```";
	return (
		!prompt.includes("gzh-figure://") &&
		!prompt.includes(`${triple}gzh-figure`)
	);
}

function mergeStoredSettings(raw: unknown): GzhWritingPipelineSettings {
	const base: GzhWritingPipelineSettings = { ...DEFAULT_SETTINGS };
	if (!raw || typeof raw !== "object") {
		return base;
	}
	const plain = raw as Record<string, unknown>;
	const legacyFlatSize =
		typeof plain.imageSize === "string" ? plain.imageSize.trim() : "";
	const stripped: Record<string, unknown> = { ...plain };
	delete stripped.imageSize;

	const LEGACY_DROP = new Set<string>([
		"baoyuSkillsRootPath",
		"bunCommand",
		"imageGenerationMode",
		"baoyuImagineCommandTemplate",
		"coverBaoyuType",
		"coverBaoyuPalette",
		"coverBaoyuRendering",
		"coverBaoyuTextMode",
		"coverBaoyuMood",
		"illustratorBaoyuType",
		"illustratorBaoyuStyle",
		"illustratorBaoyuPalette",
		"xhsBaoyuStyle",
		"xhsBaoyuPalette",
		"xhsBaoyuLayout",
		"imageCompressQuality",
		"imageCompressKeepOriginal",
	]);
	for (const k of LEGACY_DROP) delete stripped[k];

	const d = stripped as Partial<GzhWritingPipelineSettings>;
	const merged: GzhWritingPipelineSettings = {
		...base,
		...d,
		openai: { ...base.openai, ...(d.openai ?? {}) },
		deepseek: { ...base.deepseek, ...(d.deepseek ?? {}) },
		doubao: { ...base.doubao, ...(d.doubao ?? {}) },
	};

	if (legacyFlatSize.length > 0) {
		const userTouchedSplit = LEGACY_SPLIT_SIZE_KEYS.some((k) => k in plain);
		if (!userTouchedSplit) {
			merged.imageSizeWechatCover = legacyFlatSize;
			merged.imageSizeWechatIllustration = legacyFlatSize;
			merged.imageSizeXhsCover = legacyFlatSize;
			merged.imageSizeXhsBody = legacyFlatSize;
		}
	}

	if (
		typeof plain.imageCardCount === "number" &&
		typeof plain.mokaCardSlideCount !== "number"
	) {
		const n = plain.imageCardCount as number;
		merged.mokaCardSlideCount = Math.min(10, Math.max(4, Math.floor(n)));
	}

	const legacyTpl = plain.mokaCardTemplate;
	const legacyPal = plain.mokaCardPalette;
	merged.mokaCardTemplateXhs = coerceCardTemplate(
		plain.mokaCardTemplateXhs ?? legacyTpl,
		merged.mokaCardTemplateXhs,
	);
	merged.mokaCardTemplateWechat = coerceCardTemplate(
		plain.mokaCardTemplateWechat ?? legacyTpl,
		merged.mokaCardTemplateWechat,
	);
	merged.mokaCardPaletteXhs = coerceCardPalette(
		plain.mokaCardPaletteXhs ?? legacyPal,
		merged.mokaCardPaletteXhs,
	);
	merged.mokaCardPaletteWechat = coerceCardPalette(
		plain.mokaCardPaletteWechat ?? legacyPal,
		merged.mokaCardPaletteWechat,
	);

	delete (merged as unknown as Record<string, unknown>).mokaCardTemplate;
	delete (merged as unknown as Record<string, unknown>).mokaCardPalette;

	const prOr = merged.mokaCardExportPixelRatio;
	if (prOr !== 2 && prOr !== 3 && prOr !== 4) {
		merged.mokaCardExportPixelRatio =
			base.mokaCardExportPixelRatio as GzhWritingPipelineSettings["mokaCardExportPixelRatio"];
	}

	merged.wechatSimpleCoverBgId = coerceWechatSimpleCoverBgId(
		String(merged.wechatSimpleCoverBgId ?? ""),
	);

	merged.draftPrompt = needsFigurePlaceholderHint(merged.draftPrompt)
		? `${merged.draftPrompt.trimEnd()}${GZH_FIGURE_DRAFT_APPENDIX}`
		: merged.draftPrompt;
	merged.humanizePrompt = needsFigurePlaceholderHint(merged.humanizePrompt)
		? `${merged.humanizePrompt.trimEnd()}${GZH_FIGURE_PRESERVE_APPENDIX}`
		: merged.humanizePrompt;
	merged.reviewPrompt = needsFigurePlaceholderHint(merged.reviewPrompt)
		? `${merged.reviewPrompt.trimEnd()}${GZH_FIGURE_PRESERVE_APPENDIX}`
		: merged.reviewPrompt;

	return merged;
}

export default class GzhWritingPipelinePlugin
	extends Plugin
	implements PipelinePluginLike
{
	settings!: GzhWritingPipelineSettings;

	pipeline!: PipelineService;

	private statusBarEl: HTMLElement | null = null;

	private statusBarInner: HTMLElement | null = null;

	async onload(): Promise<void> {
		await this.loadSettings();
		this.pipeline = new PipelineService(
			this.app,
			() => this.settings,
			this.manifest.id,
		);

		this.addSettingTab(new GZHSettingTab(this.app, this));

		this.registerPipelineCommands();

		registerMarkdownEditorToolbar(this, {
			outline: () => this.pipeline.outlineFromSourceCard(),
			draft: () => this.pipeline.draftFromOutline(),
			humanize: () => this.pipeline.humanizeFromDraft(),
			review: () => this.pipeline.reviewFromHumanized(),
			publishWechat: () =>
				void this.pipeline.publishToWechatOfficial(),
			imageCards: () =>
				void this.pipeline.generateImageCards(),
		});

		this.addRibbonIcon("file-text", "公众号写作流水线：点此展开菜单", (evt) => {
			this.buildPipelineMenu().showAtMouseEvent(evt);
		});

		this.statusBarEl = this.addStatusBarItem();
		this.statusBarInner = this.statusBarEl.createSpan();
		this.statusBarInner.addClass("gzh-pipeline-status-inner");
		this.statusBarEl.style.cursor = "pointer";
		this.statusBarEl.title =
			"公众号写作流水线：点击展开菜单 · 也可用命令面板（Ctrl/Cmd+P）搜索「GZH」";

		this.registerDomEvent(this.statusBarEl, "click", (evt: MouseEvent) => {
			this.buildPipelineMenu().showAtMouseEvent(evt);
		});

		const scheduleRefresh = () => void this.refreshStatusBarNow();
		this.registerEvent(this.app.workspace.on("file-open", scheduleRefresh));
		this.registerEvent(
			this.app.workspace.on("active-leaf-change", scheduleRefresh),
		);

		void this.refreshStatusBarNow();
	}

	async loadSettings(): Promise<void> {
		const raw = await this.loadData();
		this.settings = mergeStoredSettings(raw);
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}

	onunload(): void {
		// Obsidian will clean up status bar items on plugin unload.
	}

	private async refreshStatusBarNow(): Promise<void> {
		try {
			if (!this.statusBarInner || !this.pipeline) return;
			const ctx = await this.pipeline.refreshContextForActiveFile();
			this.statusBarInner.textContent = ctx.text;
		} catch {
			if (this.statusBarInner) {
				this.statusBarInner.textContent = "GZH: —";
			}
		}
	}

	private buildPipelineMenu(): Menu {
		const menu = new Menu();

		menu.addItem((item) =>
			item.setTitle("列提纲").onClick(() => {
				void this.pipeline.outlineFromSourceCard();
			}),
		);
		menu.addItem((item) =>
			item.setTitle("扩写").onClick(() => {
				void this.pipeline.draftFromOutline();
			}),
		);
		menu.addItem((item) =>
			item.setTitle("去 AI 味").onClick(() => {
				void this.pipeline.humanizeFromDraft();
			}),
		);
		menu.addItem((item) =>
			item.setTitle("审稿").onClick(() => {
				void this.pipeline.reviewFromHumanized();
			}),
		);

		menu.addSeparator();

		menu.addItem((item) =>
			item
				.setTitle("发布到公众号（微信 API 草稿）")
				.onClick(() => void this.pipeline.publishToWechatOfficial()),
		);
		menu.addItem((item) =>
			item
				.setTitle("Moka 图文 · 小红书（设置里可调模板配色）")
				.onClick(() => {
					void this.pipeline.generateImageCards("xhs");
				}),
		);
		menu.addItem((item) =>
			item
				.setTitle("Moka 图文 · 公众号（设置里可调模板配色）")
				.onClick(() => {
					void this.pipeline.generateImageCards("wechat");
				}),
		);

		menu.addSeparator();

		menu.addItem((item) =>
			item.setTitle("打开文章项目目录（打开入口文件）").onClick(() => {
				void this.pipeline.openProjectEntryFile();
			}),
		);

		menu.addItem((item) =>
			item.setTitle("打开审稿报告").onClick(() => {
				void this.pipeline.openReviewReport();
			}),
		);

		menu.addItem((item) =>
			item.setTitle("复制最终文章").onClick(() => {
				void this.pipeline.copyFinalArticle();
			}),
		);

		return menu;
	}

	private registerPipelineCommands(): void {
		const reg = (
			id: string,
			name: string,
			cb: () => void | Promise<void>,
		) => {
			this.addCommand({
				id,
				name,
				callback: () => void cb(),
			});
		};

		reg("gzh-outline", "GZH Pipeline: 列提纲", () =>
			this.pipeline.outlineFromSourceCard(),
		);
		reg("gzh-draft", "GZH Pipeline: 扩写", () =>
			this.pipeline.draftFromOutline(),
		);
		reg("gzh-humanize", "GZH Pipeline: 去 AI 味", () =>
			this.pipeline.humanizeFromDraft(),
		);
		reg("gzh-review", "GZH Pipeline: 审稿", () =>
			this.pipeline.reviewFromHumanized(),
		);
		reg("gzh-open-project-folder", "GZH Pipeline: 打开文章项目目录", () =>
			this.pipeline.openProjectEntryFile(),
		);
		reg("gzh-open-review-report", "GZH Pipeline: 打开审稿报告", () =>
			this.pipeline.openReviewReport(),
		);
		reg("gzh-copy-final", "GZH Pipeline: 复制最终文章", () =>
			this.pipeline.copyFinalArticle(),
		);
		reg(
			"gzh-publish-wechat",
			"GZH Pipeline: 发布到公众号（官方 API）",
			() => void this.pipeline.publishToWechatOfficial(),
		);
		reg(
			"gzh-image-cards",
			"GZH Pipeline: Moka 图文卡片（设置中的默认平台）",
			() => void this.pipeline.generateImageCards(),
		);
		reg(
			"gzh-image-cards-xhs",
			"GZH Pipeline: Moka 图文卡片（小红书 · 使用该侧模板配色）",
			() => void this.pipeline.generateImageCards("xhs"),
		);
		reg(
			"gzh-image-cards-wechat",
			"GZH Pipeline: Moka 图文卡片（公众号 · 使用该侧模板配色）",
			() => void this.pipeline.generateImageCards("wechat"),
		);
	}
}
