import { md, applyTheme, preprocessMarkdown } from "./raphaelPublish/markdown";
import { makeWeChatCompatibleSync } from "./raphaelPublish/wechatCompat";
import { THEMES, THEME_GROUPS } from "./raphaelPublish/themes";

export { THEME_GROUPS };
export type { Theme, ThemeGroup } from "./raphaelPublish/themes";

export interface RaphaelFormatOptions {
	/** Raphael theme id (`apple`, `claude`, `wechat`, ... ) */
	themeId: string;
	/**
	 * Optional: replace `<img src>` after rendering. Receives the original
	 * Markdown image URL (e.g. `../assets/illustrations/foo.png`) and should
	 * return the URL to embed (e.g. the WeChat-hosted CDN URL). Returning a
	 * falsy value keeps the original src.
	 */
	getReplacementImageSrc?: (originalSrc: string) => string | null | undefined;
}

export interface RaphaelFormatResult {
	html: string;
	themeId: string;
	themeName: string;
}

/**
 * Render Markdown into the WeChat-compatible inline-styled HTML produced by
 * the Raphael Publish renderer. Only synchronous transforms are used, so
 * callers must resolve image swaps (e.g. WeChat `media/uploadimg`) up front.
 */
export function formatMarkdownForWechat(
	markdown: string,
	options: RaphaelFormatOptions,
): RaphaelFormatResult {
	const preprocessed = preprocessMarkdown(markdown);
	const rawHtml = md.render(preprocessed);
	const themedHtml = applyTheme(rawHtml, options.themeId);
	const wechatHtml = makeWeChatCompatibleSync(themedHtml, {
		themeId: options.themeId,
		getReplacementSrc: options.getReplacementImageSrc,
	});

	const theme =
		THEMES.find((t) => t.id === options.themeId) ?? THEMES[0];
	return {
		html: wechatHtml,
		themeId: theme.id,
		themeName: theme.name,
	};
}

export function listRaphaelThemes(): { id: string; name: string }[] {
	return THEMES.map((t) => ({ id: t.id, name: t.name }));
}

export const DEFAULT_RAPHAEL_THEME_ID = "wechat";
