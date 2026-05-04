/** Paths relative to article project root */

export const PUBLISH_LAYOUT = {
	wechatInput: "publish/wechat-input.md",
	wechatFormattedHtml: "publish/wechat-formatted.html",
	wechatResult: "publish/wechat-result.json",
	logsDir: "publish/logs",
	coverDir: "assets/cover",
	coverPromptsDir: "assets/cover/prompts",
	coverPromptFile: "assets/cover/prompts/01-cover.md",
	coverImage: "assets/cover/cover.png",
	illustrationsDir: "assets/illustrations",
	illustrationOutline: "assets/illustrations/outline.md",
	illustrationPromptsDir: "assets/illustrations/prompts",
	/** 旧版 API 小红书卡片目录（保留兼容） */
	imageCardsLegacyDir: "assets/image-cards",
	wechatCardsDir: "publish/cards",
	/** Last publish diagnostics for missing body images (overwrite each run). */
	gzhPublishTraceLastMarkdown: "publish/logs/gzh-publish-trace-last.md",
} as const;

/** 小红书 / Native Moka DOM 卡组输出 */
export const MOKA_LAYOUT = {
	rootDir: "assets/moka-cards",
	deckJson: "assets/moka-cards/deck.json",
	outlineMd: "assets/moka-cards/outline.md",
} as const;

/** Relative to publish/wechat-input.md */
export function coverRelativeFromWechatInput(): string {
	return `../${PUBLISH_LAYOUT.coverImage}`;
}
