import { type App, TFile } from "obsidian";
import * as fs from "fs";
import * as path from "path";
import { toPng } from "html-to-image";
import { normalizeVaultPath } from "../utils/path";

/** 公众号首图常用约 2.35:1（900×383） */
export const WECHAT_SIMPLE_COVER_W = 900;
export const WECHAT_SIMPLE_COVER_H = 383;

export const DEFAULT_WECHAT_SIMPLE_COVER_TAGLINE =
	"真实爸爸视角|家庭教育实战方法";

export const WECHAT_SIMPLE_COVER_BACKGROUNDS = [
	{
		id: "warm_cream",
		label: "暖杏米",
		bg: "#FFF5EB",
		title: "#1c1917",
		subtitle: "#57534e",
		tagline: "#78716c",
	},
	{
		id: "coral_glow",
		label: "珊瑚粉",
		bg: "#FFE8E0",
		title: "#7f1d1d",
		subtitle: "#9a3412",
		tagline: "#b45309",
	},
	{
		id: "sky_calm",
		label: "晴空蓝",
		bg: "#E8F4FC",
		title: "#0c4a6e",
		subtitle: "#075985",
		tagline: "#0369a1",
	},
	{
		id: "mint_fresh",
		label: "薄荷清",
		bg: "#ECFDF5",
		title: "#14532d",
		subtitle: "#166534",
		tagline: "#15803d",
	},
	{
		id: "deep_focus",
		label: "深蓝夜",
		bg: "#0f172a",
		title: "#f8fafc",
		subtitle: "#cbd5e1",
		tagline: "#94a3b8",
	},
] as const;

export type WechatSimpleCoverBgId =
	(typeof WECHAT_SIMPLE_COVER_BACKGROUNDS)[number]["id"];

const BG_IDS = new Set<string>(
	WECHAT_SIMPLE_COVER_BACKGROUNDS.map((b) => b.id),
);

export function coerceWechatSimpleCoverBgId(raw: string): WechatSimpleCoverBgId {
	const t = raw.trim();
	if (BG_IDS.has(t)) return t as WechatSimpleCoverBgId;
	return WECHAT_SIMPLE_COVER_BACKGROUNDS[0].id;
}

function docTarget(): Document {
	const aw = (globalThis as { activeWindow?: Window }).activeWindow;
	return (aw ?? window).document;
}

async function waitForPaint(doc: Document): Promise<void> {
	await doc.fonts.ready.catch(() => undefined);
	await new Promise<void>((resolve) => {
		requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
	});
}

function dataUrlToArrayBuffer(dataUrl: string): ArrayBuffer {
	const i = dataUrl.indexOf(",");
	if (i < 0 || !dataUrl.startsWith("data:")) {
		throw new Error("封面 data URL 解析失败");
	}
	const b64 = dataUrl.slice(i + 1);
	const bin = Buffer.from(b64, "base64");
	return bin.buffer.slice(
		bin.byteOffset,
		bin.byteOffset + bin.byteLength,
	) as ArrayBuffer;
}

export function readPluginLogoDataUrl(
	app: App,
	pluginManifestId: string,
): string | null {
	try {
		const abs = path.join(
			app.vault.configDir,
			"plugins",
			pluginManifestId,
			"logo.png",
		);
		if (!fs.existsSync(abs)) return null;
		const buf = fs.readFileSync(abs);
		return `data:image/png;base64,${buf.toString("base64")}`;
	} catch {
		return null;
	}
}

/** 仓库内图片路径（相对 vault 根），用作简易封面 logo。 */
export async function readVaultImageDataUrl(
	app: App,
	vaultRelativePath: string,
): Promise<string | null> {
	const norm = normalizeVaultPath(vaultRelativePath.trim());
	if (!norm) return null;
	const f = app.vault.getAbstractFileByPath(norm);
	if (!(f instanceof TFile)) return null;
	const ext = f.extension.toLowerCase();
	if (!/^(png|jpe?g|webp|gif)$/i.test(ext)) return null;
	try {
		const buf = new Uint8Array(await app.vault.readBinary(f));
		const mime =
			ext === "png"
				? "image/png"
				: ext === "webp"
					? "image/webp"
					: ext === "gif"
						? "image/gif"
						: "image/jpeg";
		return `data:${mime};base64,${Buffer.from(buf).toString("base64")}`;
	} catch {
		return null;
	}
}

async function waitForInlineImage(img: HTMLImageElement): Promise<void> {
	if (img.complete && img.naturalWidth > 0) return;
	await new Promise<void>((resolve) => {
		const done = (): void => {
			img.removeEventListener("load", done);
			img.removeEventListener("error", done);
			resolve();
		};
		img.addEventListener("load", done);
		img.addEventListener("error", done);
		window.setTimeout(done, 2000);
	});
}

function titleFontPx(title: string): number {
	const n = Array.from(title).length;
	/* 主标题偏大一级，更易在首图上抓眼；超长标题逐级缩小以防裁切 */
	if (n <= 12) return 52;
	if (n <= 18) return 45;
	if (n <= 26) return 39;
	if (n <= 36) return 33;
	return 28;
}

function subtitleFontPx(titleLen: number): number {
	if (titleLen > 26) return 17;
	return 20;
}

/**
 * 使用离屏 DOM + html-to-image 导出公众号封面 PNG（900×383，2× 像素密度）。
 */
export async function renderSimpleWechatCoverToPngBytes(params: {
	app: App;
	pluginManifestId: string;
	title: string;
	subtitle: string;
	tagline: string;
	bgId: string;
	/** 未传则读插件目录 logo.png；传 `null` 表示不显示 logo */
	logoDataUrl?: string | null;
}): Promise<ArrayBuffer> {
	const preset =
		WECHAT_SIMPLE_COVER_BACKGROUNDS.find((b) => b.id === params.bgId) ??
		WECHAT_SIMPLE_COVER_BACKGROUNDS[0];
	const logo =
		params.logoDataUrl !== undefined
			? params.logoDataUrl
			: readPluginLogoDataUrl(params.app, params.pluginManifestId);
	const tagParts = params.tagline
		.split("|")
		.map((s) => s.trim())
		.filter(Boolean);

	const doc = docTarget();
	const host = doc.createElement("div");
	host.style.cssText =
		"position:fixed;left:-12000px;top:0;pointer-events:none;z-index:-1;";

	const root = doc.createElement("div");
	root.style.cssText = [
		`width:${WECHAT_SIMPLE_COVER_W}px`,
		`height:${WECHAT_SIMPLE_COVER_H}px`,
		"position:relative",
		"box-sizing:border-box",
		'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif',
		"overflow:hidden",
	].join(";");

	const bg = doc.createElement("div");
	bg.style.cssText = `position:absolute;inset:0;background:${preset.bg};`;
	root.appendChild(bg);

	const layer = doc.createElement("div");
	layer.style.cssText =
		"position:relative;z-index:1;display:flex;flex-direction:column;height:100%;box-sizing:border-box;";

	const top = doc.createElement("div");
	top.style.cssText =
		"display:flex;flex-direction:row;align-items:center;gap:12px;padding:16px 22px 8px;";

	if (logo) {
		const img = doc.createElement("img");
		img.src = logo;
		img.alt = "logo";
		img.width = 52;
		img.height = 52;
		img.style.cssText =
			"width:52px;height:52px;max-width:64px;border-radius:10px;object-fit:contain;flex-shrink:0;box-shadow:0 2px 8px rgba(0,0,0,0.12);background:rgba(255,255,255,0.35);";
		top.appendChild(img);
		await waitForInlineImage(img);
	}

	const tagCol = doc.createElement("div");
	tagCol.style.cssText =
		"display:flex;flex-direction:column;justify-content:center;align-items:flex-start;gap:2px;min-height:52px;";
	const line1 = tagParts[0] ?? "";
	const line2 = tagParts[1] ?? tagParts.slice(1).join(" · ");
	if (line1) {
		const t1 = doc.createElement("div");
		t1.textContent = line1;
		t1.style.cssText = `font-size:12px;font-weight:700;color:${preset.tagline};line-height:1.25;letter-spacing:0.02em;`;
		tagCol.appendChild(t1);
	}
	if (line2) {
		const t2 = doc.createElement("div");
		t2.textContent = line2;
		t2.style.cssText = `font-size:11px;font-weight:500;color:${preset.tagline};opacity:0.95;line-height:1.3;`;
		tagCol.appendChild(t2);
	}
	if (logo || line1 || line2) {
		top.appendChild(tagCol);
		layer.appendChild(top);
	}

	const sub = params.subtitle.trim();
	const center = doc.createElement("div");
	center.style.cssText = [
		"flex:1;display:flex;flex-direction:column;justify-content:center;align-items:center;",
		"text-align:center;",
		sub ? "padding:8px 40px 36px" : "padding:8px 40px 44px",
		"box-sizing:border-box;",
	].join("");

	const titleEl = doc.createElement("div");
	titleEl.textContent = params.title.trim() || "未命名";
	const tPx = titleFontPx(params.title);
	titleEl.style.cssText = [
		`font-size:${tPx}px`,
		"font-weight:800",
		`color:${preset.title}`,
		"line-height:1.18",
		"max-width:100%",
		"word-break:break-word",
	].join(";");

	center.appendChild(titleEl);
	if (sub) {
		const subEl = doc.createElement("div");
		subEl.textContent = sub;
		const sPx = subtitleFontPx(Array.from(params.title).length);
		subEl.style.cssText = [
			`margin-top:18px`,
			`font-size:${sPx}px`,
			"font-weight:500",
			`color:${preset.subtitle}`,
			"line-height:1.45",
			"max-width:92%",
			"opacity:0.95",
			"display:-webkit-box",
			"-webkit-line-clamp:2",
			"-webkit-box-orient:vertical",
			"overflow:hidden",
		].join(";");
		center.appendChild(subEl);
	}
	layer.appendChild(center);
	root.appendChild(layer);
	host.appendChild(root);
	doc.body.appendChild(host);

	try {
		await waitForPaint(doc);
		const dataUrl = await toPng(root, {
			pixelRatio: 2,
			cacheBust: true,
			backgroundColor: preset.bg,
			width: WECHAT_SIMPLE_COVER_W,
			height: WECHAT_SIMPLE_COVER_H,
		});
		return dataUrlToArrayBuffer(dataUrl);
	} finally {
		host.remove();
	}
}
