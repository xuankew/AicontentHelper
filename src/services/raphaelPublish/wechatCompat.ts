/*
 * Adapted from raphael-publish/src/lib/wechatCompat.ts (MIT, see ./LICENSE.md).
 * Plugin-side adjustments:
 * - Drop dependency on the editor `markdownIndexer` (we never inject the
 *   `data-md-type/index` markers in this plugin), and remove the inline
 *   wrapper that strips them.
 * - Make image transformation pluggable: callers can pass a `getReplacementSrc`
 *   so we can swap local Markdown image paths to WeChat-hosted URLs returned
 *   by `media/uploadimg`. Base64 conversion is intentionally not used because
 *   the WeChat draft API rejects giant inline images and prefers wx-hosted
 *   `<img src="https://mmbiz.qpic.cn/...">`.
 */
import { THEMES } from "./themes";

function liIsVisuallyEmpty(li: HTMLLIElement): boolean {
	if (li.querySelector("img, pre, table, ul, ol")) return false;
	return !(li.textContent || "").replace(/\u00a0/g, " ").trim();
}

/**
 * CommonMark + markdown-it turn `1.\\n\\n正文` into `<ol><li></li></ol><p>正文</p>`.
 * WeChat then shows blank numbered rows. Hoist the following `<p>` into the empty `li`.
 */
function repairFragmentedEmptyListBlocks(section: HTMLElement): void {
	for (const list of Array.from(
		section.querySelectorAll(":scope > ol, :scope > ul"),
	)) {
		const lis = Array.from(list.children).filter(
			(c): c is HTMLLIElement => c.tagName === "LI",
		);
		if (lis.length !== 1) continue;
		const li = lis[0]!;
		if (!liIsVisuallyEmpty(li)) continue;

		let sib: ChildNode | null = list.nextSibling;
		while (sib?.nodeType === Node.TEXT_NODE && !(sib.textContent || "").trim()) {
			const zap = sib;
			sib = sib.nextSibling;
			zap.parentNode?.removeChild(zap);
		}
		const pLike = sib as Element | null;
		if (!pLike || pLike.tagName !== "P") continue;

		while (pLike.firstChild) li.appendChild(pLike.firstChild);
		pLike.parentNode?.removeChild(pLike);

		const emptyList =
			list.children.length === 1 && liIsVisuallyEmpty(li);
		if (emptyList) list.parentNode?.removeChild(list);
	}
}

export interface WechatCompatOptions {
	/**
	 * Theme id used to derive container styles (font, color, line-height) that
	 * we forcibly inherit onto WeChat-hostile elements (`<p>`, `<li>` etc.).
	 */
	themeId: string;
	/**
	 * Optional swap function: given the original `<img src>` (absolute or
	 * relative), return the URL we want the final HTML to use. Returning
	 * `null`/`undefined` keeps the original src.
	 */
	getReplacementSrc?: (src: string) => string | null | undefined;
}

export function makeWeChatCompatibleSync(
	html: string,
	options: WechatCompatOptions,
): string {
	const parser = new DOMParser();
	const doc = parser.parseFromString(html, "text/html");

	const theme =
		THEMES.find((t) => t.id === options.themeId) || THEMES[0];
	const containerStyle = theme.styles.container || "";

	const allElements = doc.querySelectorAll("*");
	allElements.forEach((el) => {
		el.removeAttribute("data-md-type");
		el.removeAttribute("data-md-index");
	});

	const rootNodes = Array.from(doc.body.children);
	const section = doc.createElement("section");
	section.setAttribute("style", containerStyle);

	rootNodes.forEach((node) => {
		if (node.tagName === "DIV" && rootNodes.length === 1) {
			Array.from(node.childNodes).forEach((child) =>
				section.appendChild(child),
			);
		} else {
			section.appendChild(node);
		}
	});

	repairFragmentedEmptyListBlocks(section);

	const flexLikeNodes = section.querySelectorAll("div, p.image-grid");
	flexLikeNodes.forEach((node) => {
		if (node.closest("pre, code")) return;

		const style = node.getAttribute("style") || "";
		const isFlexNode =
			style.includes("display: flex") ||
			style.includes("display:flex");
		const isImageGrid = node.classList.contains("image-grid");
		if (!isFlexNode && !isImageGrid) return;

		const flexChildren = Array.from(node.children);
		if (
			flexChildren.every(
				(child) =>
					child.tagName === "IMG" || child.querySelector("img"),
			)
		) {
			const table = doc.createElement("table");
			table.setAttribute(
				"style",
				"width: 100%; border-collapse: collapse; margin: 16px 0; border: none !important;",
			);
			const tbody = doc.createElement("tbody");
			const tr = doc.createElement("tr");
			tr.setAttribute(
				"style",
				"border: none !important; background: transparent !important;",
			);

			flexChildren.forEach((child) => {
				const td = doc.createElement("td");
				td.setAttribute(
					"style",
					"padding: 0 4px; vertical-align: top; border: none !important; background: transparent !important;",
				);
				td.appendChild(child);
				if (child.tagName === "IMG") {
					const currentStyle =
						child.getAttribute("style") || "";
					child.setAttribute(
						"style",
						currentStyle.replace(/width:\s*[^;]+;?/g, "") +
							" width: 100% !important; display: block; margin: 0 auto;",
					);
				}
				tr.appendChild(td);
			});

			tbody.appendChild(tr);
			table.appendChild(tbody);
			node.parentNode?.replaceChild(table, node);
		} else if (isFlexNode) {
			node.setAttribute(
				"style",
				style.replace(/display:\s*flex;?/g, "display: block;"),
			);
		}
	});

	const listItems = section.querySelectorAll("li");
	listItems.forEach((li) => {
		const hasBlockChildren = Array.from(li.children).some((child) =>
			["P", "DIV", "UL", "OL", "BLOCKQUOTE"].includes(child.tagName),
		);
		if (hasBlockChildren) {
			const ps = li.querySelectorAll("p");
			ps.forEach((p) => {
				const span = doc.createElement("span");
				span.innerHTML = p.innerHTML;
				let pStyle = p.getAttribute("style") ?? "";
				// Strip block-level margins/paddings that cause "ghost blank lines"
				// in WeChat when <p> inside <li> is serialised as <span>.
				pStyle = pStyle
					.replace(/\bmargin(-top|-bottom)?:\s*[^;]+;?\s*/gi, "")
					.replace(/\bpadding(-top|-bottom)?:\s*[^;]+;?\s*/gi, "")
					.trim();
				if (pStyle) span.setAttribute("style", pStyle);
				p.parentNode?.replaceChild(span, p);
			});
		}
	});

	const fontMatch = containerStyle.match(/font-family:\s*([^;]+);/);
	const sizeMatch = containerStyle.match(/font-size:\s*([^;]+);/);
	const colorMatch = containerStyle.match(/color:\s*([^;]+);/);
	const lineHeightMatch = containerStyle.match(
		/line-height:\s*([^;]+);/,
	);

	const textNodes = section.querySelectorAll(
		"p, li, h1, h2, h3, h4, h5, h6, blockquote, span",
	);
	textNodes.forEach((node) => {
		if (node.tagName === "SPAN" && node.closest("pre, code")) return;

		let currentStyle = node.getAttribute("style") || "";

		if (fontMatch && !currentStyle.includes("font-family:")) {
			currentStyle += ` font-family: ${fontMatch[1]};`;
		}
		if (lineHeightMatch && !currentStyle.includes("line-height:")) {
			currentStyle += ` line-height: ${lineHeightMatch[1]};`;
		}
		if (
			sizeMatch &&
			!currentStyle.includes("font-size:") &&
			["P", "LI", "BLOCKQUOTE", "SPAN"].includes(node.tagName)
		) {
			currentStyle += ` font-size: ${sizeMatch[1]};`;
		}
		if (colorMatch && !currentStyle.includes("color:")) {
			currentStyle += ` color: ${colorMatch[1]};`;
		}

		node.setAttribute("style", currentStyle.trim());
	});

	const inlineNodes = section.querySelectorAll(
		"strong, b, em, span, a, code",
	);
	inlineNodes.forEach((node) => {
		const next = node.nextSibling;
		if (!next || next.nodeType !== Node.TEXT_NODE) return;
		const text = next.textContent || "";
		const match = text.match(/^\s*([：；，。！？、:])(.*)$/s);
		if (!match) return;

		const punct = match[1];
		const rest = match[2] || "";
		node.appendChild(doc.createTextNode(punct));
		if (rest) {
			next.textContent = rest;
		} else {
			next.parentNode?.removeChild(next);
		}
	});

	if (options.getReplacementSrc) {
		const swap = options.getReplacementSrc;
		const imgs = Array.from(section.querySelectorAll("img"));
		imgs.forEach((img) => {
			const src = img.getAttribute("src");
			if (!src) return;
			const next = swap(src);
			if (next && next !== src) {
				img.setAttribute("src", next);
			}
		});
	}

	doc.body.innerHTML = "";
	doc.body.appendChild(section);

	let outputHtml = doc.body.innerHTML;
	outputHtml = outputHtml.replace(
		/(<\/(?:strong|b|em|span|a|code)>)\s*([：；，。！？、])/g,
		"$1\u2060$2",
	);

	return outputHtml;
}
