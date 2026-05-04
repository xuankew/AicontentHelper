/**
 * Structured counters for diagnosing missing WeChat draft body illustrations.
 */

const TRACE_LOG = "[GZH 配图追踪]";

export { TRACE_LOG };

/** Standard `![](path)` / `![alt](path)` with non-empty URL in parentheses. */
const MD_IMG_RE =
	/!\[[^\]]*]\(\s*([^)\s]+)(?:\s+"[^"]*")?\s*\)/g;

function mdImageSourcesFromMarkdown(md: string): string[] {
	const re = new RegExp(MD_IMG_RE.source, MD_IMG_RE.flags);
	const out: string[] = [];
	let m: RegExpExecArray | null;
	while ((m = re.exec(md))) {
		const s = m[1]?.trim();
		if (s) out.push(s);
	}
	return out;
}

export function countMarkdownImageLinks(md: string): number {
	return mdImageSourcesFromMarkdown(md).length;
}

export function listMarkdownImageSources(md: string): string[] {
	return mdImageSourcesFromMarkdown(md);
}

/** Rough count of `<img` tags after Raphael / WeChat compat. */
export function countImgTags(html: string): number {
	const re = /<img\b/gi;
	let n = 0;
	while (re.exec(html)) n += 1;
	return n;
}

/** Extract img src URLs (best-effort, attribute order tolerant). */
export function listImgSrcFromHtml(html: string): string[] {
	const srcs: string[] = [];
	const tagRe = /<img\b[^>]*>/gi;
	let tm: RegExpExecArray | null;
	while ((tm = tagRe.exec(html))) {
		const tag = tm[0] ?? "";
		const sm = /\bsrc\s*=\s*["']([^"']+)["']/i.exec(tag);
		if (sm?.[1]) srcs.push(sm[1]);
	}
	return srcs;
}

export function bodyAfterSimpleYamlFrontmatter(md: string): string {
	const m =
		/^---\s*\r?\n[\s\S]*?\r?\n---\s*\r?\n([\s\S]*)$/m.exec(md);
	return m?.[1] != null ? (m[1] ?? "").trim() : md.trim();
}

export function summarizeMarkdownBodyForTrace(md: string, label: string) {
	const srcs = listMarkdownImageSources(md);
	return {
		label,
		charLength: md.length,
		mdImageLinkCount: srcs.length,
		mdImageSrcsSample: srcs.slice(0, 12),
		hasPublishIllustrationPath: srcs.some((s) =>
			/\.\.\/assets\/illustrations\//.test(s),
		),
		hasGzhFigureProtocol:
			/gzh-figure:\/\/|```\s*gzh-figure\b/i.test(md),
	};
}

export function formatIllustrationTraceMarkdown(trace: Record<string, unknown>): string {
	const json = JSON.stringify(trace, null, 2);
	return [
		`# GZH 配图诊断（最后一次公众号发布流水）`,
		``,
		`- 控制台：打开开发者工具后在 **Console** 里搜索 \`${TRACE_LOG}\`。`,
		`- 文末为完整 JSON。`,
		``,
		`---`,
		``,
		`## 快速对照`,
		``,
		`| 字段 | 含义 |`,
		`| --- | --- |`,
		`| draft_02 | 扩写稿里是否写过 gzh-figure / Markdown 图片语法 |`,
		`| final_at_publish_start | 审稿终稿在读入时的占位符与插图链接 |`,
		`| illustration_branch | gzh_figure_resolve / llm_illustration_plan / skipped_has_asset_images |`,
		`| final_before_wechat_input | 写入 wechat-input 前的终稿快照 |`,
		`| wechat_render_phase | strip 后与 uploadimg 回填后 HTML；若仍有 ../ 本地路径则草稿里可能无图 |`,
		``,
		`## JSON`,
		``,
		"```json",
		json,
		"```",
		``,
	].join("\n");
}

export function logIllustrationTraceCompact(trace: Record<string, unknown>): void {
	console.info(
		TRACE_LOG,
		"摘要（详情见 Vault → publish/logs/gzh-publish-trace-last.md）",
		{
			when: trace.generatedAt,
			draft02: trace.draft_02,
			finalStart: trace.final_at_publish_start,
			branch: trace.illustration_branch,
			finalBeforeWechat: trace.final_before_wechat_input,
			htmlPhase: trace.wechat_render_phase,
		},
	);
}
