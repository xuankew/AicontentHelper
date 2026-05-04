import type { MokaCardPlatform } from "../../types";
import type {
	MokaCardTemplateId,
	MokaPaletteId,
} from "../../settings/mokaCardPresets";

/** 深色底配色：细描边、高光字 */
const DEEP_PALETTES: ReadonlySet<MokaPaletteId> = new Set([
	"rust",
	"pine",
]);

const SERIF_STACK =
	'"Georgia","Songti SC","Noto Serif SC","Source Han Serif SC",serif';
const SANS_STACK =
	'-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft Yahei","Hiragino Sans",sans-serif';
const MONO_STACK = "ui-monospace,SFMono-Regular,Menlo,monospace";

/** 偏杂志/文艺/法律财经 */
const SERIF_TEMPLATES: ReadonlySet<MokaCardTemplateId> = new Set([
	"magazine",
	"newspaper",
	"literary",
	"light_luxe",
	"law_pro",
	"finance_pro",
]);

/** 偏等宽/科技 */
const MONO_TEMPLATES: ReadonlySet<MokaCardTemplateId> = new Set([
	"tech_pro",
]);

function fontStack(t: MokaCardTemplateId): string {
	if (MONO_TEMPLATES.has(t)) return MONO_STACK;
	if (SERIF_TEMPLATES.has(t)) return SERIF_STACK;
	return SANS_STACK;
}

function borderRadius(t: MokaCardTemplateId): string {
	if (
		t === "tag_style" ||
		t === "sticky_note" ||
		t === "baby_pro"
	)
		return "20px";
	if (t === "minimal_line" || t === "minimal_geo") return "10px";
	if (t === "hand_ledger" || t === "cream_soft") return "18px";
	return "16px";
}

function padding(t: MokaCardTemplateId): string {
	if (
		t === "magazine" ||
		t === "newspaper" ||
		t === "literary"
	)
		return "44px 38px 34px";
	return "36px 32px";
}

function coverTitlePx(t: MokaCardTemplateId): number {
	if (t === "magazine" || t === "pop_art" || t === "korean_bold") return 54;
	if (t === "minimal_line" || t === "minimal_geo") return 42;
	return 46;
}

function letterCover(t: MokaCardTemplateId): string {
	if (t === "tech_pro" || t === "film") return "-0.035em";
	return "-0.02em";
}

function contentBadgeLabel(t: MokaCardTemplateId): string {
	switch (t) {
		case "edu_pro":
			return "要点";
		case "law_pro":
			return "提要";
		case "finance_pro":
			return "精读";
		case "medical_pro":
			return "贴士";
		case "food_pro":
			return "风味";
		case "travel_pro":
			return "路书";
		case "fashion_pro":
			return "STYLE";
		case "baby_pro":
			return "锦囊";
		default:
			return "POINT";
	}
}

export interface ResolvedCardChrome {
	borderRadius: string;
	padding: string;
	fontFamily: string;
	coverTitlePx: number;
	coverLetter: string;
	thinBorder: boolean;
	contentBadgeUppercase: boolean;
	contentBadgeLabel: string;
	extrasAlpha: string;
}

export function resolveCardChrome(
	template: MokaCardTemplateId,
	palette: MokaPaletteId,
	platform: MokaCardPlatform,
): ResolvedCardChrome {
	const deep = DEEP_PALETTES.has(palette);
	return {
		borderRadius: borderRadius(template),
		padding: padding(template),
		fontFamily: fontStack(template),
		coverTitlePx: coverTitlePx(template),
		coverLetter: letterCover(template),
		thinBorder: deep || template === "dark_night",
		contentBadgeUppercase:
			platform === "wechat" &&
			![
				"edu_pro",
				"baby_pro",
				"food_pro",
				"travel_pro",
				"medical_pro",
				"fashion_pro",
			].includes(template),
		contentBadgeLabel: contentBadgeLabel(template),
		extrasAlpha: deep ? "0.22" : "0.45",
	};
}
