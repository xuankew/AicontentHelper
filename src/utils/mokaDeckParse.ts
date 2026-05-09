import type {
	MokaCardPlatform,
	MokaDeckContentSlide,
	MokaDeckCoverSlide,
	MokaDeckEndSlide,
	MokaDeckSlide,
	NativeMokaDeck,
} from "../types";
import {
	coerceCardPalette,
	coerceCardTemplate,
	type MokaCardTemplateId,
	type MokaPaletteId,
} from "../settings/mokaCardPresets";
import { stripCodeFencesJson } from "./extractStructured";

function asStr(v: unknown, fb: string): string {
	return typeof v === "string" ? v : fb;
}

function asStrArr(v: unknown): string[] {
	if (!Array.isArray(v)) return [];
	return v
		.map((x) => (typeof x === "string" ? x.trim() : ""))
		.filter(Boolean)
		.slice(0, 10);
}

function normalizeKind(k: unknown): MokaDeckSlide["kind"] | null {
	if (k === "cover" || k === "content" || k === "end") return k;
	if (k === "Cover" || k === "COVER") return "cover";
	return null;
}

function parseSlide(row: Record<string, unknown>, idx: number): MokaDeckSlide | null {
	const kind =
		normalizeKind(row.kind) ??
		normalizeKind(row.type) ??
		normalizeKind(row.role);
	if (!kind) return null;
	if (kind === "cover") {
		const s: MokaDeckCoverSlide = {
			kind: "cover",
			emoji: asStr(row.emoji, "✨").slice(0, 8),
			title: asStr(row.title, `要点 ${idx + 1}`).slice(0, 80),
			subtitle: asStr(row.subtitle, "").slice(0, 120),
		};
		return s;
	}
	if (kind === "content") {
		const s: MokaDeckContentSlide = {
			kind: "content",
			heading: asStr(row.heading, asStr(row.title, "内容")).slice(0, 80),
			text: asStr(row.text, "").slice(0, 800),
			extra: asStr(row.extra, "").slice(0, 200) || undefined,
		};
		return s;
	}
	const tags = asStrArr(row.tags);
	const s: MokaDeckEndSlide = {
		kind: "end",
		cta: asStr(row.cta, "感谢阅读").slice(0, 80),
		sub: asStr(row.sub, "").slice(0, 120),
		tags:
			tags.length > 0
				? tags
				: ["干货", "收藏", "分享"],
	};
	return s;
}

export function coercePlatform(v: unknown, fb: MokaCardPlatform): MokaCardPlatform {
	if (v === "wechat" || v === "xhs") return v;
	if (typeof v === "string") {
		const t = v.trim();
		const lower = t.toLowerCase();
		const compact = lower.replace(/\s+/g, "");
		if (lower === "wechat") return "wechat";
		if (
			lower === "xhs" ||
			lower === "xiaohongshu" ||
			t === "小红书" ||
			t === "小紅書" ||
			compact === "rednote" ||
			compact === "redbook" ||
			compact === "littleredbook"
		) {
			return "xhs";
		}
	}
	return fb;
}

export function parseNativeMokaDeckFromLlm(params: {
	raw: string;
	fallbackPlatform: MokaCardPlatform;
	fallbackTemplate: MokaCardTemplateId;
	fallbackPalette: MokaPaletteId;
}): NativeMokaDeck {
	let root: Record<string, unknown> = {};
	try {
		root = JSON.parse(stripCodeFencesJson(params.raw)) as Record<string, unknown>;
	} catch {
		root = {};
	}

	const slidesUnknown = Array.isArray(root.slides) ? root.slides : [];

	const slides: MokaDeckSlide[] = slidesUnknown
		.filter((x): x is Record<string, unknown> => !!x && typeof x === "object")
		.map((row, idx) => parseSlide(row, idx))
		.filter((s): s is MokaDeckSlide => !!s);

	const deck: NativeMokaDeck = {
		platform: coercePlatform(root.platform, params.fallbackPlatform),
		template: coerceCardTemplate(root.template, params.fallbackTemplate),
		palette: coerceCardPalette(root.palette, params.fallbackPalette),
		slides: slides.length >= 2 ? slides : minimalFallbackDeck(),
	};

	deck.slides = normalizeSlideOrder(deck.slides);

	return deck;
}

function minimalFallbackDeck(): MokaDeckSlide[] {
	return [
		{
			kind: "cover",
			emoji: "✨",
			title: "读书笔记",
			subtitle: "拆成多张卡片更易读",
		},
		{
			kind: "content",
			heading: "核心 takeaway",
			text: "请重新运行拆分：模型未能返回合法 JSON。",
		},
		{
			kind: "end",
			cta: "关注更新",
			sub: "",
			tags: ["#复盘", "#学习", "#分享"],
		},
	];
}

function normalizeSlideOrder(slides: MokaDeckSlide[]): MokaDeckSlide[] {
	const covers = slides.filter((s) => s.kind === "cover");
	const contents = slides.filter((s) => s.kind === "content");
	const ends = slides.filter((s) => s.kind === "end");
	const out: MokaDeckSlide[] = [];
	if (covers[0]) out.push(covers[0]!);
	for (const c of covers.slice(1)) {
		const text = `${c.emoji} ${c.subtitle}`.trim();
		out.push({
			kind: "content",
			heading: c.title || "延伸",
			text: text.length ? text : c.subtitle,
		});
	}
	out.push(...contents);
	if (ends.length) out.push(ends[ends.length - 1]!);
	return out.length ? out : minimalFallbackDeck();
}
