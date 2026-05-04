import type { FC } from "react";
import type { MokaDeckSlide, NativeMokaDeck } from "../../types";
import { accentForPluginPalette } from "./mokaUpstreamPalettes";
import { buildUpstreamSlidePayload } from "./mokaUpstreamSlideModel";
import { upstreamSplitForPluginTemplate } from "./mokaUpstreamSplitIds";
import { UPSTREAM_SPLIT_REGISTRY } from "./upstreamSplitRegistry";

const ED = undefined;
const EMOJI_ED = undefined;

/** Design viewport used by upstream Moka split templates (matches preview ~420×560). */
export const MOKA_UPSTREAM_DESIGN_W = 420;
export const MOKA_UPSTREAM_DESIGN_H = 560;

/**
 * Render one slide with vendored upstream split components (read-only).
 */
export const UpstreamMokaSlide: FC<{
	deck: NativeMokaDeck;
	slide: MokaDeckSlide;
	slideIndex: number;
}> = ({ deck, slide, slideIndex }) => {
	const split = upstreamSplitForPluginTemplate(deck.template);
	const triple = UPSTREAM_SPLIT_REGISTRY[split];
	const accent = accentForPluginPalette(deck.palette);
	const s = buildUpstreamSlidePayload(deck, slide);
	const total = deck.slides.length;

	if (slide.kind === "cover") {
		const Cover = triple.Cover;
		return (
			<Cover
				s={s}
				a={accent}
				total={total}
				ed={ED}
				emojiEditor={EMOJI_ED}
			/>
		);
	}

	if (slide.kind === "content") {
		const Content = triple.Content;
		return (
			<Content
				s={s}
				a={accent}
				idx={slideIndex}
				total={total}
				ed={ED}
			/>
		);
	}

	const End = triple.End;
	return (
		<End
			s={s}
			a={accent}
			ed={ED}
			emojiEditor={EMOJI_ED}
		/>
	);
};
