export type {
	MokaCardExportPixelRatio,
	MokaCardTemplateId,
	MokaPaletteId,
	MokaTemplateFamily,
} from "./settings/mokaCardPresets";

import type {
	MokaCardExportPixelRatio,
	MokaCardTemplateId,
	MokaPaletteId,
	MokaTemplateFamily,
} from "./settings/mokaCardPresets";
import type { WechatSimpleCoverBgId } from "./services/WechatSimpleCoverService";

export type ArticleStatus =
	| "source_created"
	| "outlined"
	| "drafted"
	| "humanized"
	| "reviewed";

export interface LLMProviderConfig {
	apiKey: string;
	baseUrl: string;
	model: string;
}

export type WechatPublishMethod = "api";

/** 小红书 / 公众号 Native 卡组平台（拆分语气与板式提示不同） */
export type MokaCardPlatform = "xhs" | "wechat";

export type ImagePresetProvider =
	| "doubao_volc"
	| "zhipu_glm"
	| "gpt_image"
	| "custom";

/** 作图画布：按发布场景拆分 size，对应 HTTP `images/generations` 的 WxH（以各网关文档为准）。 */
export type ImageCanvasPurpose =
	| "wechat_cover"
	| "wechat_illustration"
	| "xhs_cover"
	| "xhs_body";

export interface GzhWritingPipelineSettings {
	provider: "openai" | "deepseek" | "doubao";

	openai: LLMProviderConfig;
	deepseek: LLMProviderConfig;
	doubao: LLMProviderConfig;

	publishedDirName: string;
	createPublishedUnderSourceDir: boolean;
	fixedPublishedDirPath: string;

	authorProfilePrompt: string;
	writingStylePrompt: string;

	outlinePrompt: string;
	draftPrompt: string;
	humanizePrompt: string;
	reviewPrompt: string;

	modelTemperature: number;
	maxTokens: number;

	confirmBeforeOverwrite: boolean;
	keepHistoryVersions: boolean;
	enableDebugLog: boolean;

	wechatPublishMethod: WechatPublishMethod;
	wechatTheme: string;
	wechatColor: string;
	wechatAuthor: string;
	wechatAppId: string;
	wechatAppSecret: string;
	/**
	 * 公众号排版主题（Raphael Publish 主题 id，例如 `wechat`、`apple`、`claude`）。
	 * 留空时使用默认 `wechat`。
	 */
	wechatRaphaelThemeId: string;

	/** 为 true 时，发布前用简易模板生成 `assets/cover/cover.png`（不再调用文生图封面）。 */
	wechatSimpleCoverEnabled: boolean;
	/** 简易封面 5 种纯色背景之一 */
	wechatSimpleCoverBgId: WechatSimpleCoverBgId;
	/** 封面左上角标语；`|` 可拆成两行 */
	wechatSimpleCoverTagline: string;
	/**
	 * 简易封面左上角 logo：相对仓库根的路径（如 `attachments/logo.png`）。
	 * 留空则使用 `.obsidian/plugins/<id>/logo.png`。
	 */
	wechatSimpleCoverLogoVaultPath: string;

	/** imagePresetProvider === custom 时使用：完整作画 URL。 */
	imageGenerationsUrl: string;
	imageModel: string;
	imageSizeWechatCover: string;
	imageSizeWechatIllustration: string;
	imageSizeXhsCover: string;
	imageSizeXhsBody: string;

	imagePresetProvider: ImagePresetProvider;
	imageApiKeyDoubaoArk: string;
	imageApiKeyZhipuGlm: string;
	imageApiKeyGptImage: string;

	useLlmApiKeyForImages: boolean;
	imageApiKey: string;

	/** Native Moka DOM：菜单「图文卡片 · 小红书/公众号」未指定时的默认平台 */
	mokaCardsDefaultPlatform: MokaCardPlatform;
	/** Moka：小红书拆卡用到的模板（29 套之一） */
	mokaCardTemplateXhs: MokaCardTemplateId;
	mokaCardPaletteXhs: MokaPaletteId;
	/** Moka：公众号语气拆卡用到的模板与调色板（可与小红书不同） */
	mokaCardTemplateWechat: MokaCardTemplateId;
	mokaCardPaletteWechat: MokaPaletteId;
	/** 如 `1242x1660`；留空用内置小红书竖版预设 */
	mokaCardSizeWxH: string;
	/** PNG 导出 devicePixelRatio，建议 2–4 */
	mokaCardExportPixelRatio: MokaCardExportPixelRatio;
	/** 目标卡组页数 clamp（拆分提示会约束 4–10，默认约 6） */
	mokaCardSlideCount: number;
}

/** Moka 风格 JSON：`cover` / `content` / `end` 三联结构 */
export interface MokaDeckCoverSlide {
	kind: "cover";
	emoji: string;
	title: string;
	subtitle: string;
}

export interface MokaDeckContentSlide {
	kind: "content";
	heading: string;
	text: string;
	extra?: string;
}

export interface MokaDeckEndSlide {
	kind: "end";
	cta: string;
	sub: string;
	tags: string[];
}

export type MokaDeckSlide =
	| MokaDeckCoverSlide
	| MokaDeckContentSlide
	| MokaDeckEndSlide;

export interface NativeMokaDeck {
	platform: MokaCardPlatform;
	template: MokaCardTemplateId;
	palette: MokaPaletteId;
	slides: MokaDeckSlide[];
}

/** Optional publish/trace fields stored in meta.json */
export interface ArticlePublishMeta {
	wechat?: {
		lastRunAt?: string;
		success?: boolean;
		media_id?: string;
		raw?: Record<string, unknown>;
		error?: string;
	};
	/** Legacy：旧版 API 制图 image-cards */
	imageCardsLegacy?: {
		lastRunAt?: string;
		outlineVaultPath?: string;
		count?: number;
		error?: string;
	};
	/** Native Moka DOM 卡组 */
	mokaCards?: {
		lastRunAt?: string;
		deckVaultPath?: string;
		outlineVaultPath?: string;
		platform?: MokaCardPlatform;
		template?: MokaCardTemplateId;
		palette?: MokaPaletteId;
		slideCount?: number;
		pngPaths?: string[];
		error?: string;
	};
	coverPromptVaultPath?: string;
	coverGeneratedAt?: string;
	illustrationsGeneratedAt?: string;
}

export interface ArticleMeta {
	id: string;
	title: string;
	sourceFilePath: string;
	projectDirPath: string;
	status: ArticleStatus;
	createdAt: string;
	updatedAt: string;
	files: {
		source: string;
		outline?: string;
		draft?: string;
		humanized?: string;
		final?: string;
		reviewReport?: string;
	};
	provider?: string;
	model?: string;
	/** Tracks publish / card runs (optional; merged on save) */
	publish?: ArticlePublishMeta;
}

export interface GenerateOptions {
	temperature?: number;
	maxTokens?: number;
}

export interface LLMProvider {
	generate(prompt: string, options?: GenerateOptions): Promise<string>;
}

export type PipelineStep = "outline" | "draft" | "humanize" | "review";
