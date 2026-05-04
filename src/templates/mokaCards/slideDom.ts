import type { NativeMokaDeck, MokaDeckSlide } from "../../types";
import { MOKA_PALETTE_VARS, type PaletteTokens } from "./paletteCss";
import { resolveCardChrome } from "./mokaCardVisual";

/** 分页渲染上下文（对齐上游 Moka 分页模板的序号与圆点分页） */
export interface SlideRenderContext {
	slideIndex: number;
	slideTotal: number;
}

export function tokensForDeck(deck: NativeMokaDeck): PaletteTokens {
	const k = deck.palette as keyof typeof MOKA_PALETTE_VARS;
	return MOKA_PALETTE_VARS[k];
}

function accentBlobRGBA(accent: string, alpha: number): string {
	const m = accent.match(/^#([0-9a-f]{6})$/i);
	if (!m) return `rgba(249,115,115,${alpha})`;
	const n = Number.parseInt(m[1]!, 16);
	const r = (n >> 16) & 255;
	const g = (n >> 8) & 255;
	const b = n & 255;
	return `rgba(${r},${g},${b},${alpha})`;
}

/** 画布背景：cream_soft 用条纹 + 晕染（接近 Moka CreamyStyle 底） */
export function frameBackdropForDeck(
	deck: NativeMokaDeck,
	tokens: PaletteTokens,
): string {
	if (deck.template !== "cream_soft") return tokens.bg;
	return [
		`repeating-linear-gradient(90deg,rgba(63,31,24,0.028) 0px,transparent 1px,transparent 26px)`,
		`radial-gradient(ellipse 95% 58% at 90% 6%, ${accentBlobRGBA(tokens.accent, 0.17)},transparent 52%)`,
		`radial-gradient(ellipse 72% 48% at 10% 42%, ${accentBlobRGBA(tokens.accent, 0.11)},transparent 50%)`,
		`radial-gradient(ellipse 85% 50% at 72% 94%, ${accentBlobRGBA(tokens.accent, 0.09)},transparent 54%)`,
		"#fff9f5",
	].join(",");
}

/** 当前页在所有 content 幻灯中的序号（从 1 起）；非 content 为 0 */
function contentOrdinal(
	deck: NativeMokaDeck,
	slideIndex: number,
): { pos: number; total: number } {
	let total = 0;
	let pos = 0;
	for (let i = 0; i < deck.slides.length; i++) {
		if (deck.slides[i]!.kind === "content") {
			total++;
			if (i === slideIndex) pos = total;
		}
	}
	return { pos, total };
}

function romanNumeralCapital(n: number): string {
	if (n >= 1 && n <= 12) return String.fromCharCode(0x2160 + n - 1);
	return String(n);
}

function appendCreamPagination(
	parent: HTMLElement,
	tokens: PaletteTokens,
	ctx: SlideRenderContext,
): void {
	const row = document.createElement("div");
	row.style.display = "flex";
	row.style.justifyContent = "center";
	row.style.alignItems = "center";
	row.style.gap = "12px";
	row.style.marginTop = "auto";
	row.style.paddingTop = "20px";
	row.style.flexShrink = "0";

	for (let i = 0; i < ctx.slideTotal; i++) {
		const active = i === ctx.slideIndex;
		const dot = document.createElement("div");
		if (active) {
			dot.style.width = "40px";
			dot.style.height = "11px";
			dot.style.borderRadius = "999px";
			dot.style.background = tokens.accent;
		} else {
			dot.style.width = "11px";
			dot.style.height = "11px";
			dot.style.borderRadius = "50%";
			dot.style.background = accentBlobRGBA(tokens.accent, 0.22);
		}
		row.appendChild(dot);
	}
	parent.appendChild(row);
}

function applyCreamSoftCover(
	el: HTMLElement,
	deck: NativeMokaDeck,
	slide: MokaDeckSlide & { kind: "cover" },
	tokens: PaletteTokens,
	ctx: SlideRenderContext,
	chrome: ReturnType<typeof resolveCardChrome>,
): void {
	const inner = document.createElement("div");
	inner.style.height = "100%";
	inner.style.display = "flex";
	inner.style.flexDirection = "column";
	inner.style.justifyContent = "flex-start";
	inner.style.gap = "20px";

	const cat = document.createElement("div");
	cat.style.alignSelf = "flex-start";
	cat.style.padding = "8px 20px";
	cat.style.borderRadius = "999px";
	cat.style.fontSize = "20px";
	cat.style.fontWeight = "700";
	cat.style.letterSpacing = "0.14em";
	cat.style.textTransform = "uppercase";
	cat.style.background = "#ffffff";
	cat.style.boxShadow =
		"0 10px 32px rgba(63,31,24,0.07), 0 2px 8px rgba(63,31,24,0.04)";
	cat.style.color = tokens.accent;
	cat.textContent = deck.platform === "wechat" ? "WECHAT" : "CREAMY";
	inner.appendChild(cat);

	const em = document.createElement("div");
	em.style.fontSize = slide.emoji.length <= 4 ? "76px" : "52px";
	em.style.lineHeight = "1";
	em.style.marginTop = "8px";
	em.textContent = slide.emoji;
	inner.appendChild(em);

	const t = document.createElement("div");
	t.style.fontWeight = "800";
	t.style.fontSize = `${chrome.coverTitlePx + 4}px`;
	t.style.color = tokens.fg;
	t.style.lineHeight = "1.18";
	t.style.letterSpacing = chrome.coverLetter;
	t.textContent = slide.title;
	inner.appendChild(t);

	const s = document.createElement("div");
	s.style.fontSize = "28px";
	s.style.lineHeight = "1.45";
	s.style.color = tokens.muted;
	s.style.whiteSpace = "pre-wrap";
	s.style.maxWidth = "100%";
	s.textContent = slide.subtitle;
	inner.appendChild(s);

	appendCreamPagination(inner, tokens, ctx);
	el.appendChild(inner);
}

function applyCreamSoftContent(
	el: HTMLElement,
	deck: NativeMokaDeck,
	slide: MokaDeckSlide & { kind: "content" },
	tokens: PaletteTokens,
	ctx: SlideRenderContext,
	chrome: ReturnType<typeof resolveCardChrome>,
): void {
	const { pos, total } = contentOrdinal(deck, ctx.slideIndex);

	const inner = document.createElement("div");
	inner.style.height = "100%";
	inner.style.display = "flex";
	inner.style.flexDirection = "column";
	inner.style.gap = "0";
	inner.style.minHeight = "0";

	const chap = document.createElement("div");
	chap.style.flexShrink = "0";
	chap.style.display = "flex";
	chap.style.alignItems = "stretch";
	chap.style.gap = "22px";
	chap.style.padding = "22px 24px";
	chap.style.borderRadius = "22px";
	chap.style.background = "#ffffff";
	chap.style.boxShadow =
		"0 14px 48px rgba(63,31,24,0.09), 0 3px 12px rgba(63,31,24,0.05)";

	const iconBox = document.createElement("div");
	iconBox.style.width = "80px";
	iconBox.style.minWidth = "80px";
	iconBox.style.borderRadius = "18px";
	iconBox.style.background = tokens.accent;
	iconBox.style.display = "flex";
	iconBox.style.alignItems = "center";
	iconBox.style.justifyContent = "center";
	iconBox.style.fontSize = pos > 0 ? "46px" : "40px";
	iconBox.style.fontWeight = "800";
	iconBox.style.color = "#ffffff";
	iconBox.style.fontFamily = chrome.fontFamily;
	iconBox.style.lineHeight = "1";
	iconBox.textContent = pos > 0 ? romanNumeralCapital(pos) : "·";

	const right = document.createElement("div");
	right.style.flex = "1";
	right.style.minWidth = "0";
	right.style.paddingTop = "2px";

	const chLabel = document.createElement("div");
	chLabel.style.fontSize = "20px";
	chLabel.style.fontWeight = "700";
	chLabel.style.letterSpacing = "0.16em";
	chLabel.style.textTransform = "uppercase";
	chLabel.style.color = tokens.accent;
	chLabel.textContent = "chapter";

	const subLine = document.createElement("div");
	subLine.style.display = "flex";
	subLine.style.alignItems = "center";
	subLine.style.gap = "12px";
	subLine.style.marginTop = "10px";

	const num = document.createElement("span");
	num.style.fontSize = "26px";
	num.style.fontWeight = "600";
	num.style.color = tokens.muted;
	num.textContent =
		pos > 0 && total > 0
			? `${String(pos).padStart(2, "0")} / ${String(total).padStart(2, "0")}`
			: "01 / 01";

	const line = document.createElement("div");
	line.style.flex = "1";
	line.style.height = "2px";
	line.style.borderRadius = "2px";
	line.style.background = accentBlobRGBA(tokens.accent, 0.42);

	subLine.appendChild(num);
	subLine.appendChild(line);

	right.appendChild(chLabel);
	right.appendChild(subLine);
	chap.appendChild(iconBox);
	chap.appendChild(right);
	inner.appendChild(chap);

	const titleWrap = document.createElement("div");
	titleWrap.style.marginTop = "28px";
	titleWrap.style.fontWeight = "800";
	titleWrap.style.fontSize = "44px";
	titleWrap.style.lineHeight = "1.22";
	titleWrap.style.color = tokens.fg;
	titleWrap.style.whiteSpace = "pre-wrap";
	titleWrap.textContent = slide.heading;
	inner.appendChild(titleWrap);

	const bodyOuter = document.createElement("div");
	bodyOuter.style.display = "flex";
	bodyOuter.style.gap = "20px";
	bodyOuter.style.flex = "1";
	bodyOuter.style.minHeight = "100px";
	bodyOuter.style.marginTop = "22px";

	const stripe = document.createElement("div");
	stripe.style.width = "5px";
	stripe.style.borderRadius = "6px";
	stripe.style.flexShrink = "0";
	stripe.style.background = tokens.accent;
	stripe.style.opacity = "0.92";

	const body = document.createElement("div");
	body.style.flex = "1";
	body.style.fontSize = "30px";
	body.style.lineHeight = "1.68";
	body.style.color = tokens.fg;
	body.style.whiteSpace = "pre-wrap";
	body.style.minWidth = "0";
	body.textContent = slide.text;

	bodyOuter.appendChild(stripe);
	bodyOuter.appendChild(body);
	inner.appendChild(bodyOuter);

	if (slide.extra?.trim()) {
		const tips = document.createElement("div");
		tips.style.flexShrink = "0";
		tips.style.marginTop = "26px";
		tips.style.padding = "22px 24px";
		tips.style.borderRadius = "22px";
		tips.style.background = "#ffffff";
		tips.style.boxShadow =
			"0 14px 44px rgba(63,31,24,0.08), 0 3px 10px rgba(63,31,24,0.05)";

		const head = document.createElement("div");
		head.style.display = "flex";
		head.style.alignItems = "center";
		head.style.gap = "10px";
		head.style.marginBottom = "12px";
		head.style.fontSize = "21px";
		head.style.fontWeight = "700";
		head.style.letterSpacing = "0.14em";
		head.style.textTransform = "uppercase";
		head.style.color = tokens.accent;
		head.innerHTML =
			'<span aria-hidden="true">💭</span> <span>TIPS</span>';

		const bodyTips = document.createElement("div");
		bodyTips.style.fontSize = "26px";
		bodyTips.style.lineHeight = "1.56";
		bodyTips.style.fontWeight = "500";
		bodyTips.style.color = tokens.fg;
		bodyTips.style.whiteSpace = "pre-wrap";
		bodyTips.textContent = slide.extra.trim();

		tips.appendChild(head);
		tips.appendChild(bodyTips);
		inner.appendChild(tips);
	}

	appendCreamPagination(inner, tokens, ctx);
	el.appendChild(inner);
}

function applyCreamSoftEnd(
	el: HTMLElement,
	deck: NativeMokaDeck,
	slide: MokaDeckSlide & { kind: "end" },
	tokens: PaletteTokens,
	ctx: SlideRenderContext,
	chrome: ReturnType<typeof resolveCardChrome>,
): void {
	void deck;
	void chrome;
	const inner = document.createElement("div");
	inner.style.height = "100%";
	inner.style.display = "flex";
	inner.style.flexDirection = "column";
	inner.style.justifyContent = "center";
	inner.style.alignItems = "stretch";
	inner.style.gap = "22px";

	const deco = document.createElement("div");
	deco.style.textAlign = "center";
	deco.style.fontSize = "36px";
	deco.style.letterSpacing = "0.55em";
	deco.style.color = accentBlobRGBA(tokens.accent, 0.65);
	deco.textContent = "✧ 💫 ✧";
	inner.appendChild(deco);

	const t = document.createElement("div");
	t.style.fontWeight = "800";
	t.style.fontSize = "48px";
	t.style.lineHeight = "1.2";
	t.style.color = tokens.fg;
	t.style.textAlign = "center";
	t.textContent = slide.cta;
	inner.appendChild(t);

	const sub = document.createElement("div");
	sub.style.fontSize = "28px";
	sub.style.lineHeight = "1.45";
	sub.style.color = tokens.muted;
	sub.style.whiteSpace = "pre-wrap";
	sub.style.textAlign = "center";
	sub.textContent = slide.sub;
	inner.appendChild(sub);

	const tagRow = document.createElement("div");
	tagRow.style.display = "flex";
	tagRow.style.flexWrap = "wrap";
	tagRow.style.gap = "12px";
	tagRow.style.justifyContent = "center";
	tagRow.style.marginTop = "8px";

	for (const raw of slide.tags) {
		const tag = document.createElement("span");
		tag.style.fontSize = "22px";
		tag.style.padding = "10px 18px";
		tag.style.borderRadius = "999px";
		tag.style.border = `1px solid ${accentBlobRGBA(tokens.accent, 0.28)}`;
		tag.style.background = "#ffffff";
		tag.style.boxShadow = "0 6px 20px rgba(63,31,24,0.06)";
		tag.style.color = tokens.fg;
		tag.style.fontWeight = "600";
		tag.textContent = raw.startsWith("#") ? raw : `#${raw}`;
		tagRow.appendChild(tag);
	}
	inner.appendChild(tagRow);

	const fin = document.createElement("div");
	fin.style.textAlign = "center";
	fin.style.marginTop = "12px";
	fin.style.fontSize = "20px";
	fin.style.letterSpacing = "0.42em";
	fin.style.fontWeight = "600";
	fin.style.color = tokens.muted;
	fin.style.textTransform = "uppercase";
	fin.textContent = "FIN";
	inner.appendChild(fin);

	appendCreamPagination(inner, tokens, ctx);
	el.appendChild(inner);
}

export function decorateCardRoot(
	el: HTMLElement,
	deck: NativeMokaDeck,
	tokens: PaletteTokens,
): void {
	const chrome = resolveCardChrome(deck.template, deck.palette, deck.platform);
	el.style.borderRadius = chrome.borderRadius;
	el.style.overflow = "hidden";
	el.style.position = "relative";
	el.style.width = "100%";
	el.style.height = "100%";
	el.style.boxSizing = "border-box";

	if (deck.template === "cream_soft") {
		el.style.padding = "10px 6px 6px";
		el.style.background = "transparent";
		el.style.backdropFilter = "none";
		el.style.border = "none";
		el.style.fontFamily = chrome.fontFamily;
		return;
	}

	el.style.padding = chrome.padding;
	el.style.background = tokens.cardBg
		.replace("0.5", "0.32")
		.replace("0.52", "0.34")
		.replace("0.55", "0.36")
		.replace("0.58", "0.38");
	el.style.backdropFilter = "blur(2px)";
	el.style.border = `${chrome.thinBorder ? "1px" : "2px"} solid ${tokens.border}`;
	el.style.fontFamily = chrome.fontFamily;
}

export function applySlideContent(
	el: HTMLElement,
	deck: NativeMokaDeck,
	slide: MokaDeckSlide,
	tokens: PaletteTokens,
	ctx: SlideRenderContext,
): void {
	el.innerHTML = "";

	if (deck.template === "cream_soft") {
		const chrome = resolveCardChrome(deck.template, deck.palette, deck.platform);
		if (slide.kind === "cover") {
			applyCreamSoftCover(el, deck, slide, tokens, ctx, chrome);
			return;
		}
		if (slide.kind === "content") {
			applyCreamSoftContent(el, deck, slide, tokens, ctx, chrome);
			return;
		}
		applyCreamSoftEnd(el, deck, slide, tokens, ctx, chrome);
		return;
	}

	const chrome = resolveCardChrome(deck.template, deck.palette, deck.platform);
	const inner = document.createElement("div");
	inner.style.height = "100%";
	inner.style.display = "flex";
	inner.style.flexDirection = "column";
	inner.style.justifyContent = "space-between";
	inner.style.gap = "16px";

	if (slide.kind === "cover") {
		const em = document.createElement("div");
		em.style.fontSize = slide.emoji.length <= 4 ? "64px" : "48px";
		em.style.lineHeight = "1";
		em.textContent = slide.emoji;
		inner.appendChild(em);

		const t = document.createElement("div");
		t.style.fontWeight = "800";
		t.style.fontSize = `${chrome.coverTitlePx}px`;
		t.style.color = tokens.fg;
		t.style.lineHeight = "1.15";
		t.style.letterSpacing = chrome.coverLetter;
		t.textContent = slide.title;
		inner.appendChild(t);

		const s = document.createElement("div");
		s.style.fontSize = "26px";
		s.style.lineHeight = "1.35";
		s.style.color = tokens.muted;
		s.style.whiteSpace = "pre-wrap";
		s.textContent = slide.subtitle;
		inner.appendChild(s);
	} else if (slide.kind === "content") {
		const badge = document.createElement("div");
		badge.style.alignSelf = "flex-start";
		badge.style.fontSize = "20px";
		badge.style.fontWeight = "700";
		badge.style.letterSpacing = "0.1em";
		badge.style.textTransform = chrome.contentBadgeUppercase
			? "uppercase"
			: "none";
		badge.style.color = tokens.accent;
		badge.textContent =
			deck.platform === "xhs" && chrome.contentBadgeLabel === "POINT"
				? "精读"
				: chrome.contentBadgeLabel;
		inner.appendChild(badge);

		const h = document.createElement("div");
		h.style.fontWeight = "800";
		h.style.fontSize = "42px";
		h.style.lineHeight = "1.25";
		h.style.color = tokens.fg;
		h.textContent = slide.heading;
		inner.appendChild(h);

		const body = document.createElement("div");
		body.style.fontSize = "30px";
		body.style.lineHeight = "1.52";
		body.style.flex = "1";
		body.style.color = tokens.fg;
		body.style.whiteSpace = "pre-wrap";
		body.textContent = slide.text;
		inner.appendChild(body);

		if (slide.extra?.trim()) {
			const ex = document.createElement("div");
			ex.style.fontSize = "24px";
			ex.style.padding = "16px 18px";
			ex.style.borderRadius = "14px";
			ex.style.border = `1px dashed ${tokens.border}`;
			ex.style.color = tokens.fg;
			ex.style.whiteSpace = "pre-wrap";
			ex.style.background =
				tokens.fg.startsWith("#faf") || tokens.fg.startsWith("#e8f")
					? `rgba(255,255,255,${chrome.extrasAlpha})`
					: `rgba(0,0,0,${chrome.extrasAlpha})`;
			ex.textContent = slide.extra.trim();
			inner.appendChild(ex);
		}
	} else {
		const t = document.createElement("div");
		t.style.fontWeight = "800";
		t.style.fontSize = "44px";
		t.style.lineHeight = "1.2";
		t.style.color = tokens.fg;
		t.textContent = slide.cta;
		inner.appendChild(t);

		const sub = document.createElement("div");
		sub.style.fontSize = "28px";
		sub.style.color = tokens.muted;
		sub.style.whiteSpace = "pre-wrap";
		sub.textContent = slide.sub;
		inner.appendChild(sub);

		const tagRow = document.createElement("div");
		tagRow.style.display = "flex";
		tagRow.style.flexWrap = "wrap";
		tagRow.style.gap = "10px";

		const tagBg =
			tokens.fg.startsWith("#faf") || tokens.fg.startsWith("#e8f")
				? "rgba(255,255,255,0.42)"
				: "rgba(255,255,255,0.08)";

		for (const raw of slide.tags) {
			const tag = document.createElement("span");
			tag.style.fontSize = "22px";
			tag.style.padding = "8px 14px";
			tag.style.borderRadius = "999px";
			tag.style.border = `1px solid ${tokens.border}`;
			tag.style.background = tagBg;
			tag.style.color = tokens.fg;
			tag.textContent = raw.startsWith("#") ? raw : `#${raw}`;
			tagRow.appendChild(tag);
		}
		inner.appendChild(tagRow);
	}

	el.appendChild(inner);
}
