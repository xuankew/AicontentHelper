import type { MokaCardTemplateId } from "../../settings/mokaCardPresets";

/** Upstream pagination template ids (`SPLIT_STYLES` in Moka constants). */
export type MokaUpstreamSplitId =
	| "vivid"
	| "clean"
	| "dark"
	| "paper"
	| "editorial"
	| "gradient"
	| "creamy"
	| "retro"
	| "forest"
	| "ins"
	| "japanese"
	| "korean"
	| "pure"
	| "pop"
	| "artistic"
	| "luxury"
	| "business"
	| "tech"
	| "edu"
	| "medical"
	| "finance"
	| "law"
	| "food"
	| "travel"
	| "fashion"
	| "mom";

/** One plugin preset id maps to exactly one upstream split renderer. */
export const PLUGIN_TEMPLATE_TO_UPSTREAM_SPLIT: Record<
	MokaCardTemplateId,
	MokaUpstreamSplitId
> = {
	magazine: "editorial",
	sticky_note: "paper",
	minimal_line: "clean",
	hand_ledger: "paper",
	color_block: "vivid",
	dark_night: "dark",
	newspaper: "editorial",
	film: "gradient",
	tag_style: "ins",

	cream_soft: "creamy",
	retro: "retro",
	forest_mori: "forest",
	ins_style: "ins",
	japanese_clean: "japanese",
	korean_bold: "korean",
	minimal_geo: "pure",
	pop_art: "pop",
	literary: "artistic",
	light_luxe: "luxury",

	biz_pro: "business",
	tech_pro: "tech",
	edu_pro: "edu",
	medical_pro: "medical",
	finance_pro: "finance",
	law_pro: "law",
	food_pro: "food",
	travel_pro: "travel",
	fashion_pro: "fashion",
	baby_pro: "mom",
};

export function upstreamSplitForPluginTemplate(
	id: MokaCardTemplateId,
): MokaUpstreamSplitId {
	return PLUGIN_TEMPLATE_TO_UPSTREAM_SPLIT[id];
}
