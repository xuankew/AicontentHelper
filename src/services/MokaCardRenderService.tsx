import { StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { toPng } from "html-to-image";
import type { MokaDeckSlide, NativeMokaDeck } from "../types";
import type { FileService } from "./FileService";
import { normalizeVaultPath, joinVaultPath } from "../utils/path";
import { MOKA_LAYOUT } from "../constants/publishPaths";
import {
	applySlideContent,
	decorateCardRoot,
	frameBackdropForDeck,
	tokensForDeck,
} from "../templates/mokaCards/slideDom";
import {
	MOKA_UPSTREAM_DESIGN_H,
	MOKA_UPSTREAM_DESIGN_W,
	UpstreamMokaSlide,
} from "../templates/mokaCards/upstreamBridge";

const RENDER_LOG = "[GZH Moka 渲染]";

export function parseMokaCardDimensions(
	mokaCardSizeWxH: string,
): { w: number; h: number } {
	const d = mokaCardSizeWxH.trim();
	const m = d.match(/^(\d+)\s*[x×]\s*(\d+)$/i);
	if (m) {
		const w = Number(m[1]);
		const h = Number(m[2]);
		if (Number.isFinite(w) && Number.isFinite(h) && w > 100 && h > 100) {
			return { w: Math.round(w), h: Math.round(h) };
		}
	}
	return { w: 1242, h: 1660 };
}

function dataUrlToArrayBuffer(dataUrl: string): ArrayBuffer {
	const i = dataUrl.indexOf(",");
	if (i < 0 || !dataUrl.startsWith("data:")) {
		throw new Error("data URL 解析失败（toPng 输出异常）");
	}
	const b64 = dataUrl.slice(i + 1);
	const bin = Buffer.from(b64, "base64");
	return bin.buffer.slice(
		bin.byteOffset,
		bin.byteOffset + bin.byteLength,
	) as ArrayBuffer;
}

function docTarget(): Document {
	const aw = (globalThis as { activeWindow?: Window }).activeWindow;
	return (aw ?? window).document;
}

async function waitForRenderPaint(doc: Document): Promise<void> {
	await doc.fonts.ready.catch(() => {
		// ignore: some environments may not expose FontFaceSet
	});
	await new Promise<void>((resolve) => {
		requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
	});
}

function renderLegacySlideToFrame(
	doc: Document,
	frame: HTMLElement,
	deck: NativeMokaDeck,
	slide: MokaDeckSlide,
	slideIndex: number,
): void {
	const tok = tokensForDeck(deck);
	frame.style.padding = "36px";
	frame.style.background = frameBackdropForDeck(deck, tok);

	const card = doc.createElement("div");
	card.style.width = "100%";
	card.style.height = "100%";
	decorateCardRoot(card, deck, tok);
	applySlideContent(card, deck, slide, tok, {
		slideIndex,
		slideTotal: deck.slides.length,
	});
	frame.appendChild(card);
}

function mountUpstreamSlide(
	doc: Document,
	frame: HTMLElement,
	deck: NativeMokaDeck,
	slide: MokaDeckSlide,
	slideIndex: number,
	dims: { w: number; h: number },
): Root {
	frame.style.padding = "0";
	frame.style.background = "#ffffff";

	const scaleX = dims.w / MOKA_UPSTREAM_DESIGN_W;
	const scaleY = dims.h / MOKA_UPSTREAM_DESIGN_H;

	const scaler = doc.createElement("div");
	scaler.style.boxSizing = "border-box";
	scaler.style.width = `${MOKA_UPSTREAM_DESIGN_W}px`;
	scaler.style.height = `${MOKA_UPSTREAM_DESIGN_H}px`;
	scaler.style.transform = `scale(${scaleX}, ${scaleY})`;
	scaler.style.transformOrigin = "top left";

	const root = createRoot(scaler);
	root.render(
		<StrictMode>
			<UpstreamMokaSlide
				deck={deck}
				slide={slide}
				slideIndex={slideIndex}
			/>
		</StrictMode>,
	);
	frame.appendChild(scaler);
	return root;
}

export class MokaCardRenderService {
	constructor(private readonly files: FileService) {}

	async exportDeckToVault(params: {
		projectRoot: string;
		deck: NativeMokaDeck;
		exportPixelRatio: number;
		cardWxH?: string;
	}): Promise<string[]> {
		const { deck } = params;
		const dims = parseMokaCardDimensions(params.cardWxH ?? "");
		const pr = Math.max(1, Math.min(4, params.exportPixelRatio || 2));
		const pngPathsOut: string[] = [];

		const doc = docTarget();
		const host = doc.body.appendChild(doc.createElement("div"));
		host.style.cssText =
			"position:fixed;left:-32000px;top:0;pointer-events:none;opacity:.01;";

		try {
			for (let idx = 0; idx < deck.slides.length; idx++) {
				const slide = deck.slides[idx]!;
				const t0 = typeof performance !== "undefined" ? performance.now() : Date.now();
				let renderMode: "upstream" | "legacy" = "upstream";

				const frame = doc.createElement("div");
				frame.style.boxSizing = "border-box";
				frame.style.width = `${dims.w}px`;
				frame.style.height = `${dims.h}px`;
				frame.style.overflow = "hidden";
				frame.style.margin = "0";

				let reactRoot: Root | null = null;
				let usedUpstream = false;

				try {
					reactRoot = mountUpstreamSlide(
						doc,
						frame,
						deck,
						slide,
						idx,
						dims,
					);
					usedUpstream = true;
				} catch (e) {
					console.warn(
						RENDER_LOG,
						"上游 React 挂载失败，回退 slideDom:",
						e,
					);
					renderMode = "legacy";
					renderLegacySlideToFrame(doc, frame, deck, slide, idx);
				}

				host.appendChild(frame);

				await waitForRenderPaint(doc).catch(() => {});

				let dataUrl: string;
				try {
					dataUrl = await toPng(frame, {
						pixelRatio: pr,
						cacheBust: true,
						backgroundColor: "#ffffff",
					});
				} catch (e) {
					if (usedUpstream && reactRoot) {
						reactRoot.unmount();
						reactRoot = null;
						frame.innerHTML = "";
						renderMode = "legacy";
						console.warn(RENDER_LOG, "html-to-image 失败，改用 slideDom 重试:", e);
						renderLegacySlideToFrame(
							doc,
							frame,
							deck,
							slide,
							idx,
						);
						await waitForRenderPaint(doc).catch(() => {});
						dataUrl = await toPng(frame, {
							pixelRatio: pr,
							cacheBust: true,
							backgroundColor: undefined,
						});
					} else {
						throw e;
					}
				} finally {
					if (reactRoot) {
						reactRoot.unmount();
					}
				}

				const buf = dataUrlToArrayBuffer(dataUrl);
				const name = `${String(idx + 1).padStart(2, "0")}-${slide.kind}.png`;
				const rel = joinVaultPath(MOKA_LAYOUT.rootDir, name);
				const vaultPath = joinVaultPath(params.projectRoot, rel);
				await this.files.writeBinaryFile(vaultPath, buf);
				pngPathsOut.push(normalizeVaultPath(vaultPath));

				host.removeChild(frame);
				const t1 =
					typeof performance !== "undefined"
						? performance.now()
						: Date.now();
				console.info(RENDER_LOG, "已导出 PNG", {
					vaultRelative: normalizeVaultPath(rel),
					px: dims,
					scale: pr,
					slide: slide.kind,
					renderer: renderMode,
					ms: Math.round((t1 - t0) * 10) / 10,
				});
			}
			return pngPathsOut;
		} catch (err) {
			console.error(RENDER_LOG, "导出卡组失败:", err);
			throw err instanceof Error ? err : new Error(String(err));
		} finally {
			doc.body.removeChild(host);
		}
	}

	async persistDeckArtifacts(params: {
		projectRoot: string;
		deck: NativeMokaDeck;
		outlineMd: string;
	}): Promise<void> {
		const root = params.projectRoot;
		const deckPath = joinVaultPath(root, MOKA_LAYOUT.deckJson);
		const outlinePath = joinVaultPath(root, MOKA_LAYOUT.outlineMd);
		await this.files.writeTextFile(
			deckPath,
			JSON.stringify(params.deck, null, 2),
		);
		await this.files.writeTextFile(outlinePath, params.outlineMd);
	}
}
