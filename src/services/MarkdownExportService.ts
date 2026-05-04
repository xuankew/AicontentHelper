import type { ArticleMeta } from "../types";
import {
	PUBLISH_LAYOUT,
	coverRelativeFromWechatInput,
} from "../constants/publishPaths";
import { stringifySimpleFrontmatter } from "../utils/yamlSnippet";
import { joinVaultPath } from "../utils/path";

export function excerptForDescription(md: string, max = 200): string {
	const body = stripLeadingTitle(stripYamlFrontmatter(md));
	const compact = body.replace(/\s+/g, " ").trim();
	return compact.length <= max ? compact : `${compact.slice(0, max - 3)}…`;
}

/**
 * 简易公众号封面用：主标题取正文首行 `#`（文章标题），副标题取首段或首个 `##` 下一句的短摘录（无合适内容则空字符串）。
 */
export function extractCoverDisplayTitles(md: string): {
	title: string;
	subtitle: string;
} {
	const body = stripYamlFrontmatter(md).trim();
	const h1 = /^#\s+(.+)$/m.exec(body);
	const title = h1 ? h1[1].trim() : "";
	const afterH1 = h1 ? body.slice(h1.index + h1[0].length).trim() : body;
	const subtitle = polishCoverSubtitle(extractSubtitleAfterHeading(afterH1));
	return { title, subtitle };
}

function extractSubtitleAfterHeading(rest: string): string {
	const lines = rest.split(/\r?\n/);
	const para: string[] = [];
	for (const raw of lines) {
		const line = raw.trim();
		if (!line) {
			if (para.length) break;
			continue;
		}
		if (/^#{1,6}\s/.test(line)) {
			if (!para.length && /^##\s+/.test(line)) {
				return line.replace(/^##\s+/, "").trim();
			}
			break;
		}
		para.push(line);
		const joined = para.join(" ");
		if (joined.length > 320) break;
	}
	return para.join(" ").replace(/\s+/g, " ").trim();
}

function polishCoverSubtitle(raw: string): string {
	if (!raw) return "";
	let t = raw
		.replace(/\*\*([^*]+)\*\*/g, "$1")
		.replace(/\*([^*]+)\*/g, "$1")
		.replace(/`+/g, "")
		.replace(/\s+/g, " ")
		.trim();
	const minLen = 10;
	if (t.length < minLen) return "";
	const max = 88;
	if (t.length <= max) return t;
	const slice = t.slice(0, max);
	const zh = slice.lastIndexOf("。");
	const en = Math.max(
		slice.lastIndexOf("."),
		slice.lastIndexOf("，"),
		slice.lastIndexOf(","),
		slice.lastIndexOf("；"),
	);
	const cut = Math.max(zh, en);
	if (cut > 28) return slice.slice(0, cut + 1).trim();
	return `${slice.trim()}…`;
}

export function stripYamlFrontmatter(md: string): string {
	return md.replace(/^---\s*\r?\n[\s\S]*?\r?\n---\s*\r?\n?/, "");
}

function stripLeadingTitle(md: string): string {
	let t = md.trim();
	const h1 = /^#\s+[^\n]+\n+/.exec(t);
	if (h1) t = t.slice(h1[0].length);
	return t.trim();
}

export function buildWechatInputMarkdown(params: {
	finalBody: string;
	meta: ArticleMeta;
	authorFromSettings: string;
	coverVaultPathFromPublish: string;
	illustrationBlock: string;
	/** 与正文首行 `#` 一致；不传则用 meta.title */
	draftTitle?: string;
}): string {
	const title = (params.draftTitle ?? params.meta.title).trim();
	const author =
		params.authorFromSettings.trim() ||
		params.meta.title.slice(0, 8) ||
		"作者";
	const description = excerptForDescription(params.finalBody);
	const fm = stringifySimpleFrontmatter({
		title,
		author,
		description,
		coverImage: params.coverVaultPathFromPublish,
	});
	const body = mergeIllustrationsIntoArticle(
		params.finalBody,
		params.illustrationBlock,
	);
	return `${fm}${body}\n`;
}

function mergeIllustrationsIntoArticle(
	finalBody: string,
	illustrationBlock: string,
): string {
	const trimmed = illustrationBlock.trim();
	if (!trimmed.length) return `${finalBody.trim()}\n`;

	let body = finalBody.trimEnd();
	if (body.includes("<!-- gzh-illustrations -->")) {
		body = body.replace("<!-- gzh-illustrations -->", `\n${trimmed}\n`);
	} else {
		body = `${body}\n\n## 配图\n\n${trimmed}\n`;
	}
	return `${body}\n`;
}

export function coverRelativeVaultFromWechatMd(): string {
	return coverRelativeFromWechatInput();
}

export function publishLogsDirVault(projectRoot: string): string {
	return joinVaultPath(projectRoot, PUBLISH_LAYOUT.logsDir);
}

export { PUBLISH_LAYOUT };
