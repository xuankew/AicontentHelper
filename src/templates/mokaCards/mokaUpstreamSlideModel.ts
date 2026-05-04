import type { MokaDeckSlide, NativeMokaDeck } from "../../types";

export function upstreamCategoryLabel(
	platform: NativeMokaDeck["platform"],
): string {
	return platform === "xhs" ? "XHS" : "WECHAT";
}

/**
 * Normalize plugin deck slide → upstream split template slide model (`s` prop).
 */
export function buildUpstreamSlidePayload(
	deck: NativeMokaDeck,
	slide: MokaDeckSlide,
): Record<string, unknown> {
	const cat = upstreamCategoryLabel(deck.platform);

	if (slide.kind === "cover") {
		return {
			category: cat,
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
