import type { ImageGenerationService } from "../services/ImageGenerationService";
import type { FileService } from "../services/FileService";
import { joinVaultPath } from "./path";
import { PUBLISH_LAYOUT } from "../constants/publishPaths";

/** 正文插图：占位（fenced / gzh-figure://）与解析后的 assets 图片均在此区间 */
export const GZH_BODY_FIGURE_MIN = 1;
export const GZH_BODY_FIGURE_MAX = 3;

export interface GzhFigureSlotHit {
	start: number;
	end: number;
	inner: string;
}

export interface GzhFigureProtocolHit {
	start: number;
	end: number;
	/** `![ ... ]` 内原文，可能含 Obsidian `|宽度` */
	altRaw: string;
	file_base: string;
	/** URL 中带冒号后的描写片段（可中文 / 英文）；可做 URI 解码 */
	sceneDescription: string;
}

export interface ParsedGzhFigure {
	file_base: string;
	caption_zh: string;
	prompt_en: string;
}

/** 与发布流水线 `sanitizeBaseName` 对齐：小写、两位数字前缀、安全文件名 */
export function sanitizeFigureFileBase(raw: string): string {
	let s = raw.trim().replace(/[/\\]/g, "-").replace(/\s+/g, "-").toLowerCase();
	if (!/^\d{2}-/.test(s)) s = `01-${s}`;
	return s.slice(0, 80).replace(/\.$/, "");
}

export function findGzhFigureBlocks(md: string): GzhFigureSlotHit[] {
	const re = /```\s*gzh-figure\s*\r?\n([\s\S]*?)```/gi;
	const out: GzhFigureSlotHit[] = [];
	let m: RegExpExecArray | null;
	while ((m = re.exec(md))) {
		out.push({
			start: m.index,
			end: m.index + m[0].length,
			inner: m[1] ?? "",
		});
	}
	return out;
}

/**
 * 解析 `![...]` 整段 alt 内嵌的 `gzh-figure://…`（支持 `|x400` 等后缀；支持无冒号：`t1-主题-画面描写`）。
 */
export function parseGzhFigureAltPayload(alt: string): {
	file_base: string;
	scene: string;
} | null {
	const i = alt.indexOf("gzh-figure://");
	if (i < 0) return null;
	let payload = alt.slice(i + "gzh-figure://".length).trim();
	const pipe = payload.indexOf("|");
	if (pipe >= 0) payload = payload.slice(0, pipe).trim();

	if (payload.includes(":")) {
		const c = payload.indexOf(":");
		return {
			file_base: payload.slice(0, c).trim(),
			scene: payload.slice(c + 1).trim(),
		};
	}
	const parts = payload.split("-").map((p) => p.trim()).filter(Boolean);
	if (parts.length >= 3 && /^t?\d+$/i.test(parts[0]!)) {
		return {
			file_base: `${parts[0]}-${parts[1]}`,
			scene: parts.slice(2).join("-"),
		};
	}
	if (parts.length >= 2) {
		return {
			file_base: parts[0]!,
			scene: parts.slice(1).join("-"),
		};
	}
	if (parts.length === 1 && parts[0]) {
		return { file_base: parts[0], scene: "" };
	}
	return null;
}

/**
 * Markdown 配图占位：
 * - 推荐：`![](gzh-figure://slug:画面…)`
 * - 兼容：`![gzh-figure://t1-主题-画面…|x400]()`（伪链写在 alt、链轮询为空）
 */
export function findGzhFigureProtocolImages(md: string): GzhFigureProtocolHit[] {
	const out: GzhFigureProtocolHit[] = [];

	const reStandard =
		/!\[([^\]]*)]\(\s*gzh-figure:\/\/([^:)\s]+):([^)]+)\s*\)/gi;
	let m: RegExpExecArray | null;
	while ((m = reStandard.exec(md))) {
		out.push({
			start: m.index,
			end: m.index + m[0].length,
			altRaw: (m[1] ?? "").trim(),
			file_base: (m[2] ?? "").trim(),
			sceneDescription: decodeSceneFragment((m[3] ?? "").trim()),
		});
	}

	const reAltOnly = /!\[([^\]]*gzh-figure:\/\/[^\]]+)\]\(\s*\)/gi;
	while ((m = reAltOnly.exec(md))) {
		const altFull = (m[1] ?? "").trim();
		const parsed = parseGzhFigureAltPayload(altFull);
		if (!parsed || !parsed.file_base) continue;
		out.push({
			start: m.index,
			end: m.index + m[0].length,
			altRaw: altFull,
			file_base: parsed.file_base,
			sceneDescription: decodeSceneFragment(parsed.scene),
		});
	}

	out.sort((a, b) => a.start - b.start);
	return out;
}

/** 占位总数（发布前校验 / 跳转 LLM 分支用） */
export function countFigurePlaceholders(md: string): number {
	return (
		findGzhFigureBlocks(md).length + findGzhFigureProtocolImages(md).length
	);
}

const PUBLISH_ILLUSTRATION_MD_IMG_RE =
	/!\[[^\]]*]\(\s*\.\.\/assets\/illustrations\/[^)\s]+\s*\)/g;

/** 正文里指向 `assets/illustrations` 的 Markdown 图片条数（与 wechat-input 同源路径）。 */
export function countPublishIllustrationMarkdownImages(md: string): number {
	const re = new RegExp(
		PUBLISH_ILLUSTRATION_MD_IMG_RE.source,
		PUBLISH_ILLUSTRATION_MD_IMG_RE.flags,
	);
	let n = 0;
	while (re.exec(md)) n += 1;
	return n;
}

/**
 * 终稿已通过 gzh-figure 解析写入的插图链接（相对于 publish/wechat-input.md）。
 * 用于避免「二次发布」时占位符已为 0 却仍走 LLM 备选插图分支。
 */
export function markdownHasPublishIllustrationImages(md: string): boolean {
	return countPublishIllustrationMarkdownImages(md) > 0;
}

/** 发布前：校验 `![](../assets/illustrations/…)` 条数在 {@link GZH_BODY_FIGURE_MIN}–{@link GZH_BODY_FIGURE_MAX}。 */
export function assertPublishBodyIllustrationCountInPolicy(md: string): void {
	const n = countPublishIllustrationMarkdownImages(md);
	if (n < GZH_BODY_FIGURE_MIN) {
		throw new Error(
			`[GZH 配图] 正文插图至少需要 ${GZH_BODY_FIGURE_MIN} 张（当前统计到 ${n} 张 \`![](../assets/illustrations/...)\`）。请在终稿中加入 gzh-figure 占位，或确保备选插图已在正文中插入。`,
		);
	}
	if (n > GZH_BODY_FIGURE_MAX) {
		throw new Error(
			`[GZH 配图] 正文插图至多 ${GZH_BODY_FIGURE_MAX} 张（当前 ${n} 张）。请删减 gzh-figure 占位或手写插图链接后再发布。`,
		);
	}
}

function decodeSceneFragment(raw: string): string {
	if (!/%[0-9A-Fa-f]{2}/.test(raw)) return raw;
	try {
		return decodeURIComponent(raw);
	} catch {
		return raw;
	}
}

function sceneToIllustrationPrompt(scene: string): string {
	const t = scene.trim();
	const baseHint =
		t.length > 0
			? t
			: "minimal editorial metaphor illustration for article body";
	const enTail =
		"\n\nStyle: cohesive editorial illustration, soft lighting, clean composition suited to the article. No readable text or lettering in image.";
	return `${baseHint}${enTail}`;
}

export function parseGzhFigureInner(inner: string): ParsedGzhFigure | null {
	const lines = inner.replace(/\r\n/g, "\n").split("\n");
	const fields: Record<string, string> = {};
	for (const rawLine of lines) {
		const line = rawLine.trim();
		if (!line) continue;
		const m = /^(file_base|caption_zh|prompt_en):\s*(.*)$/.exec(line);
		if (!m) return null;
		fields[m[1]] = m[2].trim();
	}
	const file_base = fields.file_base;
	const caption_zh = fields.caption_zh;
	const prompt_en = fields.prompt_en;
	if (!file_base || !caption_zh || !prompt_en) return null;
	return { file_base, caption_zh, prompt_en };
}

function captionFromObsidianAlt(altRaw: string): string {
	const i = altRaw.indexOf("|");
	return i < 0 ? altRaw.trim() : altRaw.slice(0, i).trim();
}

/** 用于 assets 下 .md 记录的短标题；微信正文用无 alt 图，不展示此字段 */
function deriveCaptionForAssetFile(
	altRaw: string,
	fileBase: string,
	sceneDescription: string,
): string {
	if (altRaw.includes("gzh-figure://")) {
		const ex = sceneDescription.trim();
		if (ex.length > 0) return ex.length <= 48 ? ex : `${ex.slice(0, 45)}…`;
	}
	const c = captionFromObsidianAlt(altRaw);
	return c && !c.includes("gzh-figure://") ? c : fileBase.replace(/-/g, " ");
}

type UnifiedHit =
	| {
			kind: "protocol";
			start: number;
			end: number;
			parsed: ParsedGzhFigure;
	  }
	| {
			kind: "fenced";
			start: number;
			end: number;
			parsed: ParsedGzhFigure;
	  };

function buildUnifiedHits(md: string): UnifiedHit[] {
	const protos = findGzhFigureProtocolImages(md);
	const fenced = findGzhFigureBlocks(md);
	const out: UnifiedHit[] = [];
	for (const p of protos) {
		if (!p.file_base) {
			throw new Error(
				`[GZH 配图占位] 无法解析 gzh-figure://（标准：](gzh-figure://slug:描写) 或将 gzh-figure:// 写在 [!...] 内且 () 留空）。`,
			);
		}
		const base = sanitizeFigureFileBase(p.file_base);
		const cap = deriveCaptionForAssetFile(
			p.altRaw,
			base,
			p.sceneDescription,
		);
		out.push({
			kind: "protocol",
			start: p.start,
			end: p.end,
			parsed: {
				file_base: base,
				caption_zh: cap,
				prompt_en: sceneToIllustrationPrompt(p.sceneDescription),
			},
		});
	}
	for (const f of fenced) {
		const parsed = parseGzhFigureInner(f.inner);
		if (!parsed) {
			throw new Error(
				`[GZH 配图占位] 某段 \`\`\`gzh-figure\`\`\` 解析失败：需三行 file_base / caption_zh / prompt_en（单行值）。`,
			);
		}
		out.push({
			kind: "fenced",
			start: f.start,
			end: f.end,
			parsed: {
				...parsed,
				file_base: sanitizeFigureFileBase(parsed.file_base),
			},
		});
	}
	out.sort((a, b) => a.start - b.start);
	let prevEnd = -1;
	for (const h of out) {
		if (prevEnd >= 0 && h.start < prevEnd) {
			throw new Error(
				"[GZH 配图占位] 检测到重叠的配图占位，请调整正文后再发布。",
			);
		}
		prevEnd = h.end;
	}

	const slugKeys = out.map((h) => h.parsed.file_base);
	if (new Set(slugKeys).size !== slugKeys.length) {
		throw new Error(
			"[GZH 配图占位] 存在重复的 file_base / 前缀-slug（同文只能出现一次文件名前缀）。请修改后再发布。",
		);
	}
	return out;
}

export interface ResolveGzhFigureSlotsParams {
	projectRoot: string;
	files: FileService;
	img: ImageGenerationService;
	md: string;
	onSlot?: (index: number, total: number, fileBase: string) => void;
}

/**
 * 将终稿中的 `gzh-figure://` 伪链接与/或 \`\`\`gzh-figure\`\`\` 占位替换为真实
 * `![](../assets/illustrations/…)`，并 HTTP 生图。占位超过 {@link GZH_BODY_FIGURE_MAX} 处会报错；
 * 发布前还会在终稿中对 `assets/illustrations` Markdown 插图做 {@link GZH_BODY_FIGURE_MIN}～{@link GZH_BODY_FIGURE_MAX} 校验。
 */
export async function resolveGzhFigureSlotsInMarkdown(
	params: ResolveGzhFigureSlotsParams,
): Promise<{ md: string; count: number; items: ParsedGzhFigure[] }> {
	const hits = buildUnifiedHits(params.md);
	if (hits.length === 0) {
		return { md: params.md, count: 0, items: [] };
	}
	if (hits.length > GZH_BODY_FIGURE_MAX) {
		throw new Error(
			`[GZH 配图占位] 含 gzh-figure://／旧 fenced 占位不得超过 ${GZH_BODY_FIGURE_MAX} 处（当前 ${hits.length} 处）。请删减至 ${GZH_BODY_FIGURE_MIN}～${GZH_BODY_FIGURE_MAX} 处以内。`,
		);
	}

	await params.files.mkdirp(
		joinVaultPath(params.projectRoot, PUBLISH_LAYOUT.illustrationsDir),
	);
	await params.files.mkdirp(
		joinVaultPath(params.projectRoot, PUBLISH_LAYOUT.illustrationPromptsDir),
	);

	const items: ParsedGzhFigure[] = [];
	const replacements: Array<{
		start: number;
		end: number;
		replacement: string;
	}> = [];

	for (let i = 0; i < hits.length; i++) {
		const hit = hits[i]!;
		const parsed = hit.parsed;
		items.push(parsed);
		params.onSlot?.(i + 1, hits.length, parsed.file_base);

		const promptPath = joinVaultPath(
			params.projectRoot,
			PUBLISH_LAYOUT.illustrationPromptsDir,
			`${parsed.file_base}.md`,
		);
		await params.files.writeTextFile(
			promptPath,
			`# ${parsed.caption_zh}\n\n${parsed.prompt_en}\n`,
		);

		const imgRel = joinVaultPath(
			PUBLISH_LAYOUT.illustrationsDir,
			`${parsed.file_base}.png`,
		);
		const vaultImg = joinVaultPath(params.projectRoot, imgRel);
		await params.img.renderPromptToVaultImage({
			vaultPath: vaultImg,
			prompt: `${parsed.prompt_en}\n\nKeep consistent with article mood; no readable text unless subtle labels.`,
			purpose: "wechat_illustration",
		});

		const fromPublish = `../${imgRel}`;
		// 公众号正文只留图，不写图注/提示词（由 stripWechatFigureEditorialNoise 去掉周边说明行）
		replacements.push({
			start: hit.start,
			end: hit.end,
			replacement: `\n\n![](${fromPublish})\n\n`,
		});
	}

	let outMd = params.md;
	for (const r of replacements.sort((a, b) => b.start - a.start)) {
		outMd = outMd.slice(0, r.start) + r.replacement + outMd.slice(r.end);
	}
	return { md: outMd, count: hits.length, items };
}

export function buildIllustrationOutlineFromSlots(
	parsed: ParsedGzhFigure[],
): string {
	const lines = [
		"# 配图占位（扩写阶段插入，发布时已渲染）",
		"",
		...parsed.map(
			(p, i) =>
				`${i + 1}. \`${p.file_base}\` — ${p.caption_zh}`,
		),
		"",
	];
	return lines.join("\n");
}
