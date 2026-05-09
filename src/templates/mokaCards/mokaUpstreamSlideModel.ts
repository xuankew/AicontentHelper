import type {
	MokaCardPlatform,
	MokaDeckSlide,
	NativeMokaDeck,
} from "../../types";

/**
 * deck.json 里 platform 可能是 xhs / XHS / xiaohongshu / 小红书 等，统一后再判断角标与装饰。
 */
export function normalizeMokaDeckPlatform(raw: unknown): MokaCardPlatform {
	const rawTrim = String(raw ?? "").trim();
	if (rawTrim === "小红书" || rawTrim === "小紅書") return "xhs";
	const s = rawTrim.toLowerCase().replace(/\s+/g, "");
	if (
		s === "xhs" ||
		s === "xiaohongshu" ||
		s === "rednote" ||
		s === "redbook" ||
		s === "littleredbook" ||
		s === "little_red_book"
	) {
		return "xhs";
	}
	return "wechat";
}

export function upstreamCategoryLabel(platform: unknown): string {
	/** 小红书封面不显示「XHS」平台角标（空串由 upstream Cover 解释为隐藏） */
	if (normalizeMokaDeckPlatform(platform) === "xhs") return "";
	return "WECHAT";
}

/**
 * Normalize plugin deck slide → upstream split template slide model (`s` prop).
 */
export function buildUpstreamSlidePayload(
	deck: NativeMokaDeck,
	slide: MokaDeckSlide,
): Record<string, unknown> {
	if (slide.kind === "cover") {
		return {
			category: upstreamCategoryLabel(deck.platform),
			emoji: slide.emoji,
			title: slide.title,
			subtitle: slide.subtitle,
		};
	}

	if (slide.kind === "content") {
		return {
			heading: slide.heading,
			text: slide.text,
			extra: slide.extra ?? "",
		};
	}

	return {
		emoji: "✨",
		cta: slide.cta,
		sub: slide.sub,
		tags: slide.tags,
	};
}
