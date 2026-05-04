import type { MokaPaletteId } from "../../settings/mokaCardPresets";

/** Mirrors Moka PALETTES[] + plugin id synonyms (matcha→sage, bluestone→slate). */
export const PLUGIN_PALETTE_UPSTREAM_THEME: Record<
	MokaPaletteId,
	{
		accentHex: string;
		bgHex: string;
		fgHex: string;
		bcHex: string;
	}
> = {
	coral: {
		accentHex: "#e05a4b",
		bgHex: "#fff8f6",
		fgHex: "#2a1210",
		bcHex: "#4a3330",
	},
	matcha: {
		accentHex: "#4a7c59",
		bgHex: "#f4faf6",
		fgHex: "#172312",
		bcHex: "#344d38",
	},
	ink: {
		accentHex: "#2d3561",
		bgHex: "#f4f5fb",
		fgHex: "#0f1220",
		bcHex: "#333650",
	},
	amber: {
		accentHex: "#c47c2b",
		bgHex: "#fffbf4",
		fgHex: "#1f1508",
		bcHex: "#4a3010",
	},
	plum: {
		accentHex: "#8b3a62",
		bgHex: "#fdf4f8",
		fgHex: "#2a1020",
		bcHex: "#4a2a38",
	},
	bluestone: {
		accentHex: "#4a7c8a",
		bgHex: "#f4fafb",
		fgHex: "#101e22",
		bcHex: "#2a3e44",
	},
	rust: {
		accentHex: "#a0522d",
		bgHex: "#fef8f4",
		fgHex: "#200e08",
		bcHex: "#4a2818",
	},
	pine: {
		accentHex: "#2d6a4f",
		bgHex: "#f0faf5",
		fgHex: "#0a1e14",
		bcHex: "#1e4432",
	},
};

export function accentForPluginPalette(p: MokaPaletteId): string {
	return PLUGIN_PALETTE_UPSTREAM_THEME[p].accentHex;
}
