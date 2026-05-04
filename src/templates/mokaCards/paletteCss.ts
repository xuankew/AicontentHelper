import type { MokaPaletteId } from "../../settings/mokaCardPresets";
import { PLUGIN_PALETTE_UPSTREAM_THEME } from "./mokaUpstreamPalettes";

export interface PaletteTokens {
	bg: string;
	fg: string;
	muted: string;
	accent: string;
	cardBg: string;
	border: string;
}

function hexRgb(hex: string): { r: number; g: number; b: number } {
	const m = hex.replace("#", "").match(/^([0-9a-f]{6})$/i);
	if (!m) return { r: 0, g: 0, b: 0 };
	const n = Number.parseInt(m[1]!, 16);
	return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function rgbaHex(hex: string, alpha: number): string {
	const { r, g, b } = hexRgb(hex);
	return `rgba(${r},${g},${b},${alpha})`;
}

function cardGradient(bgHex: string, accentHex: string): string {
	return `linear-gradient(150deg, ${bgHex} 0%, ${rgbaHex(
		accentHex,
		0.12,
	)} 48%, #ffffff 100%)`;
}

function buildPaletteTokens(p: MokaPaletteId): PaletteTokens {
	const t = PLUGIN_PALETTE_UPSTREAM_THEME[p];
	return {
		bg: cardGradient(t.bgHex, t.accentHex),
		fg: t.fgHex,
		muted: rgbaHex(t.fgHex, 0.5),
		accent: t.accentHex,
		cardBg: rgbaHex("#ffffff", 0.54),
		border: rgbaHex(t.accentHex, 0.28),
	};
}

/** 与上游 Moka `PALETTES` 对齐（slideDom fallback / 渐变底）。 */
export const MOKA_PALETTE_VARS: Record<MokaPaletteId, PaletteTokens> = {
	coral: buildPaletteTokens("coral"),
	matcha: buildPaletteTokens("matcha"),
	ink: buildPaletteTokens("ink"),
	amber: buildPaletteTokens("amber"),
	plum: buildPaletteTokens("plum"),
	bluestone: buildPaletteTokens("bluestone"),
	rust: buildPaletteTokens("rust"),
	pine: buildPaletteTokens("pine"),
};
