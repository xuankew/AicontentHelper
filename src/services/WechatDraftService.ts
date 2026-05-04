import type { App } from "obsidian";
import { requestUrl, TFile } from "obsidian";
import type { GzhWritingPipelineSettings } from "../types";
import { joinVaultPath, normalizeVaultPath } from "../utils/path";
import { PUBLISH_LAYOUT } from "../constants/publishPaths";
import {
	DEFAULT_RAPHAEL_THEME_ID,
	formatMarkdownForWechat,
} from "./RaphaelWechatFormatter";
import {
	countImgTags,
	countMarkdownImageLinks,
	listImgSrcFromHtml,
	listMarkdownImageSources,
} from "../utils/gzhPublishIllustrationTrace";

const LOG = "[GZH 微信 API]";

let tokenCache: { token: string; expMs: number } | null = null;

/** Obsidian `requestUrl` 走主进程，不受 `app://obsidian.md` 的浏览器 CORS 限制。 */
async function wechatHttpText(params: {
	url: string;
	method?: string;
	contentType?: string;
	body?: string | ArrayBuffer;
}): Promise<{ status: number; text: string }> {
	const res = await requestUrl({
		url: params.url,
		method: params.method ?? "GET",
		contentType: params.contentType,
		body: params.body,
		throw: false,
	});
	return { status: res.status, text: res.text };
}

function buildMultipartPngBody(
	fileName: string,
	bytes: Uint8Array,
): { contentType: string; body: ArrayBuffer } {
	const safeName = fileName.replace(/[^\w.\-]+/g, "_").slice(0, 120) || "cover.png";
	const boundary = `----GzhWp${Date.now().toString(36)}${Math.random().toString(36).slice(2, 9)}`;
	const crlf = "\r\n";
	const head =
		`--${boundary}${crlf}` +
		`Content-Disposition: form-data; name="media"; filename="${safeName}"${crlf}` +
		`Content-Type: image/png${crlf}${crlf}`;
	const tail = `${crlf}--${boundary}--${crlf}`;
	const enc = new TextEncoder();
	const h = enc.encode(head);
	const t = enc.encode(tail);
	const out = new Uint8Array(h.length + bytes.length + t.length);
	out.set(h, 0);
	out.set(bytes, h.length);
	out.set(t, h.length + bytes.length);
	return {
		contentType: `multipart/form-data; boundary=${boundary}`,
		body: out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength),
	};
}

async function getAccessTokenCached(
	appId: string,
	appSecret: string,
): Promise<string> {
	const now = Date.now();
	if (tokenCache?.token && tokenCache.expMs - 60_000 > now) {
		console.info(LOG, "复用缓存 access_token（未过期）");
		return tokenCache.token;
	}
	const url =
		`https://api.weixin.qq.com/cgi-bin/token` +
		`?grant_type=client_credential&appid=${encodeURIComponent(appId)}` +
		`&secret=${encodeURIComponent(appSecret)}`;
	const { status, text } = await wechatHttpText({ url });
	console.info(LOG, "请求 access_token", {
		httpStatus: status,
		bodyPreview: text.slice(0, 280),
	});
	const j = JSON.parse(text) as Record<string, unknown>;
	if (typeof j.access_token === "string") {
		const ttl =
			typeof j.expires_in === "number" ? j.expires_in : 7200;
		tokenCache = {
			token: j.access_token,
			expMs: now + ttl * 1000,
		};
		return j.access_token;
	}
	throw new Error(
		`${LOG} access_token 失败：` + String(j.errmsg ?? text.slice(0, 200)),
	);
}

export interface WechatDraftApiResult {
	ok: boolean;
	media_id?: string;
	raw: Record<string, unknown>;
	errmsg?: string;
	/** Theme actually used to render the HTML (lets the caller log/audit). */
	themeId?: string;
	/** Vault path of the rendered HTML snapshot, if it was written. */
	formattedHtmlVaultPath?: string;
	/** Diagnostics merged into publish/logs trace (插图是否在 HTML / 上传 map). */
	illustrationTrace?: Record<string, unknown>;
}

function parseFrontmatter(md: string): {
	attrs: Record<string, string>;
	body: string;
} {
	const m =
		/^---\s*\r?\n([\s\S]*?)\r?\n---\s*\r?\n([\s\S]*)$/m.exec(md);
	if (!m) return { attrs: {}, body: md.trim() };
	const fm = m[1] ?? "";
	const body = (m[2] ?? "").trim();
	const attrs: Record<string, string> = {};
	for (const rawLine of fm.split(/\r?\n/)) {
		const line = rawLine.trim();
		const i = line.indexOf(":");
		if (i <= 0) continue;
		const k = line.slice(0, i).trim().toLowerCase();
		let v = line.slice(i + 1).trim().replace(/^["']|["']$/g, "");
		attrs[k] = v;
	}
	return { attrs, body };
}

async function readVaultBin(app: App, path: string): Promise<Uint8Array> {
	const norm = normalizeVaultPath(path);
	const f = app.vault.getAbstractFileByPath(norm);
	if (!(f instanceof TFile)) {
		throw new Error(`${LOG} 找不到文件：${norm}`);
	}
	return new Uint8Array(await app.vault.readBinary(f));
}

async function uploadThumb(
	token: string,
	bytes: Uint8Array,
	name: string,
): Promise<string> {
	const url =
		`https://api.weixin.qq.com/cgi-bin/material/add_material` +
		`?access_token=${encodeURIComponent(token)}&type=thumb`;
	const { body, contentType } = buildMultipartPngBody(name, bytes);
	const { status, text } = await wechatHttpText({
		url,
		method: "POST",
		contentType,
		body,
	});
	console.info(LOG, "上传 thumb", { status, head: text.slice(0, 360) });
	const j = JSON.parse(text) as Record<string, unknown>;
	if (typeof j.media_id === "string") return j.media_id;
	throw new Error(`${LOG} thumb 失败：` + String(j.errmsg ?? text));
}

async function uploadImg(
	token: string,
	bytes: Uint8Array,
	name: string,
): Promise<string> {
	const url =
		`https://api.weixin.qq.com/cgi-bin/media/uploadimg` +
		`?access_token=${encodeURIComponent(token)}`;
	const { body, contentType } = buildMultipartPngBody(name, bytes);
	const { status, text } = await wechatHttpText({
		url,
		method: "POST",
		contentType,
		body,
	});
	console.info(LOG, "uploadimg", { status, head: text.slice(0, 360) });
	const j = JSON.parse(text) as Record<string, unknown>;
	if (typeof j.url === "string") return j.url;
	throw new Error(`${LOG} uploadimg 失败：` + String(j.errmsg ?? text));
}

/**
 * Strip only a leading `./` so `../assets/...` stays intact.
 * (Previously `replace(/^[./]+/, "")` turned `../x` into `x`, breaking cover paths.)
 */
function normalizeRelativePathFromPublish(src: string): string {
	let rel = src.trim();
	if (rel.startsWith("./")) rel = rel.slice(2);
	return rel;
}

/** `coverImage` in wechat-input.md is relative to the `publish/` folder. */
function normalizeCoverRelForWechatInput(coverRel: string): string {
	const t = coverRel.trim();
	if (/^(https?:|data:)/i.test(t)) return t;
	if (t.startsWith("../")) return normalizeRelativePathFromPublish(t);
	return `../${normalizeRelativePathFromPublish(t)}`;
}

function resolveFromPublish(
	projectRoot: string,
	publishDir: string,
	src: string,
): string {
	const rel = normalizeRelativePathFromPublish(src);
	const base = joinVaultPath(projectRoot, publishDir);
	const parts = base.split("/");
	for (const seg of rel.split("/")) {
		if (!seg || seg === ".") continue;
		if (seg === "..") parts.pop();
		else parts.push(seg);
	}
	return parts.join("/");
}

/**
 * Walk the body for `![alt](src)` Markdown image links and upload each unique
 * `src` to WeChat (`media/uploadimg`). Returns a map keyed by the original
 * Markdown src (verbatim, e.g. `../assets/illustrations/foo.png`) → CDN URL.
 *
 * Already-remote sources (`http(s)://`, `data:`) are kept as-is and do not
 * need to be uploaded. WeChat's editor accepts external images that resolve
 * against its CDN at publish time, but for safer fan-out we still upload
 * local Vault images.
 */
async function buildImageUrlMap(
	app: App,
	token: string,
	projectRoot: string,
	body: string,
): Promise<Map<string, string>> {
	const map = new Map<string, string>();
	const seen = new Set<string>();
	const re = /!\[[^\]]*]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
	let m: RegExpExecArray | null;
	while ((m = re.exec(body))) {
		const src = m[1]?.trim();
		if (!src || seen.has(src)) continue;
		seen.add(src);
		if (/^(https?:|data:)/i.test(src)) continue;
		if (/^gzh-figure:/i.test(src)) continue;

		const path = resolveFromPublish(projectRoot, "publish", src);
		const bytes = await readVaultBin(app, path);
		const fname = path.split("/").pop() ?? "img.png";
		const url = await uploadImg(token, bytes, fname);
		map.set(src, url);
	}
	return map;
}

async function draftAdd(
	token: string,
	payload: Record<string, unknown>,
): Promise<Record<string, unknown>> {
	const url =
		`https://api.weixin.qq.com/cgi-bin/draft/add` +
		`?access_token=${encodeURIComponent(token)}`;
	const { status, text } = await wechatHttpText({
		url,
		method: "POST",
		contentType: "application/json; charset=utf-8",
		body: JSON.stringify(payload),
	});
	console.info(LOG, "draft/add", { status, head: text.slice(0, 600) });
	return JSON.parse(text) as Record<string, unknown>;
}

function pickRaphaelThemeId(
	settings: GzhWritingPipelineSettings,
): string {
	const id = (settings.wechatRaphaelThemeId ?? "").trim();
	if (id) return id;
	return DEFAULT_RAPHAEL_THEME_ID;
}

export async function pushWechatDraftFromVault(params: {
	app: App;
	projectRootVault: string;
	settings: GzhWritingPipelineSettings;
	wechatInputRelative?: string;
}): Promise<WechatDraftApiResult> {
	const appId = params.settings.wechatAppId.trim();
	const sec = params.settings.wechatAppSecret.trim();
	if (!appId || !sec) {
		throw new Error(`${LOG} 请填写 wechatAppId / wechatAppSecret`);
	}

	const rel =
		params.wechatInputRelative?.trim() ?? PUBLISH_LAYOUT.wechatInput;
	const path = joinVaultPath(params.projectRootVault, rel);
	const file = params.app.vault.getAbstractFileByPath(
		normalizeVaultPath(path),
	);
	if (!(file instanceof TFile)) {
		throw new Error(`${LOG} 读不到 ${path}`);
	}
	const md = await params.app.vault.read(file);
	const fm = parseFrontmatter(md);

	const title =
		fm.attrs.title ?? path.split("/").pop() ?? "title";
	const author =
		fm.attrs.author?.trim() ||
		params.settings.wechatAuthor.trim() ||
		"作者";
	const digest = (fm.attrs.description ?? "").slice(0, 120);

	const coverRelRaw = fm.attrs.coverimage?.trim();
	if (!coverRelRaw) throw new Error(`${LOG} frontmatter 缺 coverImage`);
	const coverRel = normalizeCoverRelForWechatInput(coverRelRaw);

	const token = await getAccessTokenCached(appId, sec);

	const coverPath = resolveFromPublish(
		params.projectRootVault,
		"publish",
		coverRel,
	);
	const thumbId = await uploadThumb(
		token,
		await readVaultBin(params.app, coverPath),
		"cover.png",
	);

	const bodyRaw = fm.body;
	const bodyForDraft = stripWechatFigureEditorialNoise(bodyRaw);

	const imageUrlMap = await buildImageUrlMap(
		params.app,
		token,
		params.projectRootVault,
		bodyForDraft,
	);

	const themeId = pickRaphaelThemeId(params.settings);
	const formatted = formatMarkdownForWechat(bodyForDraft, {
		themeId,
		getReplacementImageSrc: (src) => imageUrlMap.get(src) ?? null,
	});
	const htmlSrcsFull = listImgSrcFromHtml(formatted.html);
	const htmlStillRelativeOrNonHttp = htmlSrcsFull.filter(
		(s) =>
			s.startsWith("../") ||
			(!/^https?:/i.test(s) && !/^data:/i.test(s)),
	);
	console.info(LOG, "Raphael 排版完成", {
		themeId: formatted.themeId,
		themeName: formatted.themeName,
		uploadedImages: imageUrlMap.size,
		htmlLength: formatted.html.length,
		mdBodyImgAfterStrip: countMarkdownImageLinks(bodyForDraft),
		htmlImgTagCount: countImgTags(formatted.html),
		htmlUnresolvedLocalStyles: htmlStillRelativeOrNonHttp.length,
	});

	const formattedRel = PUBLISH_LAYOUT.wechatFormattedHtml;
	const formattedPath = joinVaultPath(
		params.projectRootVault,
		formattedRel,
	);
	const previewDoc =
		`<!doctype html><meta charset="utf-8">` +
		`<title>${escapeHtmlAttr(title)} · Raphael preview</title>` +
		`<body>${formatted.html}</body>`;
	const formattedFile =
		params.app.vault.getAbstractFileByPath(
			normalizeVaultPath(formattedPath),
		);
	if (formattedFile instanceof TFile) {
		await params.app.vault.modify(formattedFile, previewDoc);
	} else {
		await params.app.vault.create(
			normalizeVaultPath(formattedPath),
			previewDoc,
		);
	}

	const raw = await draftAdd(token, {
		articles: [
			{
				title,
				author,
				digest,
				content: formatted.html,
				content_source_url: "",
				thumb_media_id: thumbId,
				show_cover_pic: 1,
				need_open_comment: 0,
				only_fans_can_comment: 0,
			},
		],
	});

	const media =
		typeof raw.media_id === "string" ? raw.media_id : undefined;
	const ok = Boolean(media);
	if (!ok) {
		console.error(LOG, "draft/add 未成功", raw);
	}
	return {
		ok,
		media_id: media,
		raw,
		errmsg: typeof raw.errmsg === "string" ? raw.errmsg : undefined,
		themeId: formatted.themeId,
		formattedHtmlVaultPath: formattedRel,
		illustrationTrace: {
			wechatInputRelative: rel,
			bodyMarkdownImageLinksBeforeStrip: countMarkdownImageLinks(bodyRaw),
			bodyMarkdownImageLinksAfterStrip: countMarkdownImageLinks(bodyForDraft),
			bodyImageSrcAfterStripSample:
				listMarkdownImageSources(bodyForDraft).slice(0, 16),
			uploadimgMapSize: imageUrlMap.size,
			uploadimgMapKeys: [...imageUrlMap.keys()],
			htmlImgTagCount: htmlSrcsFull.length,
			htmlImgSrcsSample: htmlSrcsFull.slice(0, 16),
			htmlSrcStillRelativeOrNonHttpSample: htmlStillRelativeOrNonHttp.slice(
				0,
				8,
			),
		},
	};
}

function escapeHtmlAttr(s: string): string {
	return s
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

/**
 * 去掉扩写阶段常见的「图示 N」标题行与「图注 / 生成提示词」说明行，
 * 使公众号草稿中插图旁不留多余文字。
 */
function stripWechatFigureEditorialNoise(md: string): string {
	let s = md.replace(/\r\n/g, "\n");
	s = s.replace(/^\s*\*\*（图示[0-9]+）\*\*\s*$/gm, "");
	s = s.replace(/^\s*\*\*（图示）\*\*\s*$/gm, "");
	s = s.replace(/^\s*\*\*（图\s*[0-9]+\s*）\*\*\s*$/gm, "");
	s = s.replace(/^\s*\*\*（图示\s*[一二三四五六七八九十]+\s*）\*\*\s*$/gm, "");
	/* 单行匹配：跨行 [\s\S]* 版会把两行之间的 ![](...) Markdown 整块吞掉，导致草稿无图 */
	s = s.replace(/^\s*\*（[^\n]*?图注：[^\n]*）\*\s*$/gm, "");
	s = s.replace(/^\s*\*（[^\n]*?图片生成提示词[^\n]*）\*\s*$/gm, "");
	s = s.replace(/^\s*\*（[^\n]*?提示词[：:][^\n]*）\*\s*$/gm, "");
	s = s.replace(/\n{3,}/g, "\n\n");
	return s.trimEnd();
}
