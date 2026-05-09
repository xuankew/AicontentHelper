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

/** 「视频」按钮：口播稿、渲染配置与最终 mp4 等产物 */
export const VIDEO_LAYOUT = {
	rootDir: "assets/video",
	/** Moka 重导至 `mokaFramesDir` 时使用的竖屏视频画布（独立于小红书预览尺寸设置） */
	mokaExportWxH: "1080x1920",
	mokaFramesDir: "assets/video/moka-frames",
	voiceover: "assets/video/voiceover.md",
	platformPostsMd: "assets/video/platform-posts.md",
	platformPostsJson: "assets/video/platform-posts.json",
	configJson: "assets/video/video_config.json",
	renderLog: "assets/video/render.log",
	output: "assets/video/xiaohongshu.mp4",
} as const;

/** Relative to publish/wechat-input.md */
export function coverRelativeFromWechatInput(): string {
	return `../${PUBLISH_LAYOUT.coverImage}`;
}
