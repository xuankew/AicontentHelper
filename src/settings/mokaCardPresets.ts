/**
 * Moka Native：29 卡片模板 × 8 套配色。
 * ids 为小写 snake_case（写入 deck.json）；设置下拉展示中文标签。
 */

export const MOKA_CARD_TEMPLATE_IDS = [
	// 经典 / 通用
	"magazine",
	"sticky_note",
	"minimal_line",
	"hand_ledger",
	"color_block",
	"dark_night",
	"newspaper",
	"film",
	"tag_style",
	// 小红书热门
	"cream_soft",
	"retro",
	"forest_mori",
	"ins_style",
	"japanese_clean",
	"korean_bold",
	"minimal_geo",
	"pop_art",
	"literary",
	"light_luxe",
	// 公众号垂直
	"biz_pro",
	"tech_pro",
	"edu_pro",
	"medical_pro",
	"finance_pro",
	"law_pro",
	"food_pro",
	"travel_pro",
	"fashion_pro",
	"baby_pro",
] as const;

export type MokaCardTemplateId = (typeof MOKA_CARD_TEMPLATE_IDS)[number];

export type MokaCardTemplateCategory = "classic" | "xhs_hot" | "wechat_vertical";

/** 下拉分组：经典 9 · 小红书 10 · 公众号 10 */
export const MOKA_CARD_TEMPLATE_CATEGORY: Record<MokaCardTemplateId, MokaCardTemplateCategory> =
	{
		magazine: "classic",
		sticky_note: "classic",
		minimal_line: "classic",
		hand_ledger: "classic",
		color_block: "classic",
		dark_night: "classic",
		newspaper: "classic",
		film: "classic",
		tag_style: "classic",
		cream_soft: "xhs_hot",
		retro: "xhs_hot",
		forest_mori: "xhs_hot",
		ins_style: "xhs_hot",
		japanese_clean: "xhs_hot",
		korean_bold: "xhs_hot",
		minimal_geo: "xhs_hot",
		pop_art: "xhs_hot",
		literary: "xhs_hot",
		light_luxe: "xhs_hot",
		biz_pro: "wechat_vertical",
		tech_pro: "wechat_vertical",
		edu_pro: "wechat_vertical",
		medical_pro: "wechat_vertical",
		finance_pro: "wechat_vertical",
		law_pro: "wechat_vertical",
		food_pro: "wechat_vertical",
		travel_pro: "wechat_vertical",
		fashion_pro: "wechat_vertical",
		baby_pro: "wechat_vertical",
	};

export const MOKA_CARD_TEMPLATE_LABELS_ZH: Record<MokaCardTemplateId, string> = {
	magazine: "杂志风",
	sticky_note: "便签风",
	minimal_line: "极简线",
	hand_ledger: "手账风",
	color_block: "撞色块",
	dark_night: "暗夜风",
	newspaper: "报纸风",
	film: "胶片风",
	tag_style: "标签风",
	cream_soft: "奶油风",
	retro: "复古风",
	forest_mori: "森系风",
	ins_style: "ins风",
	japanese_clean: "日系风",
	korean_bold: "韩系风",
	minimal_geo: "极简风",
	pop_art: "波普风",
	literary: "文艺风",
	light_luxe: "轻奢风",
	biz_pro: "商务风",
	tech_pro: "科技风",
	edu_pro: "教育风",
	medical_pro: "医疗风",
	finance_pro: "财经风",
	law_pro: "法律风",
	food_pro: "美食风",
	travel_pro: "旅游风",
	fashion_pro: "时尚风",
	baby_pro: "母婴风",
};

/** LLM / 下拉说明（气质关键词） */
export const MOKA_CARD_TEMPLATE_HINTS: Record<MokaCardTemplateId, string> = {
	magazine: "大标题分级、留白像刊物专题",
	sticky_note: "便签底板、贴纸感、轻快",
	minimal_line: "细线分隔、极简层次",
	hand_ledger: "手写点缀、格纹/胶带装饰感",
	color_block: "撞色几何块、强对比抓眼",
	dark_night: "深色底高光字、夜游氛围",
	newspaper: "分栏、报头排版、资讯感",
	film: "暗角边框、胶片颗粒隐喻",
	tag_style: "圆角标签、chip 信息流",
	cream_soft: "奶油米白柔和、马卡龙亲和力",
	retro: "做旧纸张、Vintage 色相",
	forest_mori: "森系绿与自然纹理",
	ins_style: "网格留白、韩系 ins 画报",
	japanese_clean: "清淡配色、ゆる排版",
	korean_bold: "高对比韩系标题块",
	minimal_geo: "几何留白、少一点装饰",
	pop_art: "撞色波点、POP 插画感",
	literary: "诗性留白、文摘气质",
	light_luxe: "金属点缀、轻奢克制",
	biz_pro: "商务简报与信息层级",
	tech_pro: "数据感、模块化科技",
	edu_pro: "板书分块、教学清晰",
	medical_pro: "洁净医疗蓝绿、可信度",
	finance_pro: "图表暗示、稳重数字感",
	law_pro: "严谨条款感、对齐线",
	food_pro: "暖食色相、种草食欲",
	travel_pro: "地图胶片感与行程条",
	fashion_pro: "时尚大片标题层级",
	baby_pro: "柔和圆弧、母婴安心感",
};

export const MOKA_PALETTE_IDS = [
	"coral",
	"matcha",
	"ink",
	"amber",
	"plum",
	"bluestone",
	"rust",
	"pine",
] as const;

export type MokaPaletteId = (typeof MOKA_PALETTE_IDS)[number];

export const MOKA_PALETTE_LABELS_ZH: Record<MokaPaletteId, string> = {
	coral: "珊瑚",
	matcha: "抹茶",
	ink: "水墨",
	amber: "琥珀",
	plum: "梅子",
	bluestone: "青石",
	rust: "铁锈",
	pine: "松针",
};

export const MOKA_PALETTE_HINTS: Record<MokaPaletteId, string> = {
	coral: "珊瑚粉橘，清甜活力",
	matcha: "抹茶灰绿，自然清爽",
	ink: "水墨纸色，素雅克制",
	amber: "琥珀暖金，食欲与亲切",
	plum: "梅子豆沙，柔媚不艳",
	bluestone: "青石灰蓝，冷静专业",
	rust: "铁锈赭褐，稳重复古景深",
	pine: "松针墨绿，森系沉静",
};

export type MokaCardExportPixelRatio = 2 | 3 | 4;

/** @deprecated v0.3 改用 MOKA_CARD_TEMPLATE_IDS */
export type MokaTemplateFamily = MokaCardTemplateId;

/** 旧版模板 id → 新 id（载入历史 meta / LLM JSON 容错） */
const LEGACY_TEMPLATE_MAP: Record<string, MokaCardTemplateId | undefined> = {
	vivid: "color_block",
	clean: "minimal_geo",
	paper: "hand_ledger",
	editorial: "magazine",
	business: "biz_pro",
	tech: "tech_pro",
	edu: "edu_pro",
	minimal: "minimal_line",
};
const LEGACY_PALETTE_MAP: Record<string, MokaPaletteId | undefined> = {
	rose: "plum",
	ocean: "bluestone",
	forest: "matcha",
	sunset: "amber",
	slate: "bluestone",
	cream: "coral",
	neon: "rust",
	mono: "ink",
};

export function migrateLegacyCardTemplate(raw: unknown): MokaCardTemplateId | undefined {
	const s = typeof raw === "string" ? raw.trim() : "";
	if (!s.length) return undefined;
	if ((MOKA_CARD_TEMPLATE_IDS as readonly string[]).includes(s))
		return s as MokaCardTemplateId;
	return LEGACY_TEMPLATE_MAP[s];
}

export function migrateLegacyCardPalette(raw: unknown): MokaPaletteId | undefined {
	const s = typeof raw === "string" ? raw.trim() : "";
	if (!s.length) return undefined;
	if ((MOKA_PALETTE_IDS as readonly string[]).includes(s))
		return s as MokaPaletteId;
	return LEGACY_PALETTE_MAP[s];
}

export function coerceCardTemplate(
	v: unknown,
	fallback: MokaCardTemplateId,
): MokaCardTemplateId {
	const s = typeof v === "string" ? v.trim() : "";
	if ((MOKA_CARD_TEMPLATE_IDS as readonly string[]).includes(s))
		return s as MokaCardTemplateId;
	const m = migrateLegacyCardTemplate(s);
	return m ?? fallback;
}

export function coerceCardPalette(
	v: unknown,
	fallback: MokaPaletteId,
): MokaPaletteId {
	const s = typeof v === "string" ? v.trim() : "";
	if ((MOKA_PALETTE_IDS as readonly string[]).includes(s))
		return s as MokaPaletteId;
	const m = migrateLegacyCardPalette(s);
	return m ?? fallback;
}
