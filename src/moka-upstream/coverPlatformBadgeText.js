/**
 * Moka upstream Cover 左上角平台文案（原计划 XHS / WECHAT；小红书导出已改为隐藏）。
 *
 * @param {unknown} slide - cover payload `s`
 * @param {string | null | undefined} whenMissingCategoryKey - deck 不含 `category` 时的兜底（沿用各模板原先的英文 tag）
 * @returns {string | null} null 时不渲染该平台行（避免占位）
 */
export function coverPlatformBadgeText(slide, whenMissingCategoryKey) {
	if (!slide || typeof slide !== "object") {
		return whenMissingCategoryKey == null ? null : String(whenMissingCategoryKey);
	}
	const s = /** @type {Record<string, unknown>} */ (slide);
	if (!Object.prototype.hasOwnProperty.call(s, "category")) {
		return whenMissingCategoryKey == null ? null : String(whenMissingCategoryKey);
	}
	const c = s.category;
	if (typeof c !== "string") {
		return whenMissingCategoryKey == null ? null : String(whenMissingCategoryKey ?? "");
	}
	const t = c.trim();
	if (!t.length) {
		return null;
	}
	return t.toUpperCase();
}
