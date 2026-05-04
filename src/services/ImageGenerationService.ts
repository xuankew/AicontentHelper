import { App, requestUrl, type RequestUrlResponse } from "obsidian";
import * as fs from "fs";
import * as path from "path";
import type {
	GzhWritingPipelineSettings,
	ImageCanvasPurpose,
	ImagePresetProvider,
} from "../types";
import type { FileService } from "./FileService";
import { pickActiveProviderConfig } from "./ArticleProjectService";
import { normalizeVaultPath } from "../utils/path";
/** Volcengine Ark：北京区 OpenAI 兼容图像入口 */
const VOLC_ARK_IMAGE_GENERATIONS =
	"https://ark.cn-beijing.volces.com/api/v3/images/generations";
/** 智谱 CogView / GLM-Image */
const ZHIPU_IMAGE_GENERATIONS =
	"https://open.bigmodel.cn/api/paas/v4/images/generations";
const OPENAI_IMAGE_GENERATIONS =
	"https://api.openai.com/v1/images/generations";

/** 平台默认模型占位；实际以控制台/文档为准，可用设置项覆盖。 */
const PRESET_DEFAULT_MODEL: Record<
	Exclude<ImagePresetProvider, "custom">,
	string
> = {
	/** 控制台实际 endpoint id 常为带版本后缀，可按需改或在设置覆盖 model */
	doubao_volc: "doubao-seedream-5-0-260128",
	zhipu_glm: "cogview-3-plus",
	gpt_image: "gpt-image-1",
};

const IMAGE_SIZE_FALLBACK: Record<ImageCanvasPurpose, string> = {
	wechat_cover: "1792x1024",
	wechat_illustration: "1536x1024",
	xhs_cover: "1024x1024",
	xhs_body: "1024x1536",
};

export function resolveImageSizeForPurpose(
	settings: GzhWritingPipelineSettings,
	purpose: ImageCanvasPurpose,
): string {
	const t = rawImageSizeTrimmed(settings, purpose);
	return t.length > 0 ? t : IMAGE_SIZE_FALLBACK[purpose];
}

/**
 * Seedream 报错：`image size must be at least 3686400 pixels`。
 * 恰等于 3_686_400 时仍有网关校验失败反馈，默认略高于下限；并对用户填入的 WxH 做校验。
 */
const VOLC_MIN_PIXEL_AREA = 3686400;
const VOLC_IMAGE_SIZE_FALLBACK_BY_PURPOSE: Record<ImageCanvasPurpose, string> = {
	wechat_cover: "2561x1441",
	wechat_illustration: "2561x1441",
	xhs_cover: "1921x1921",
	xhs_body: "1441x2561",
};

const IMG_LOG_PREFIX = "[GZH 生图]";

function parseWxHArea(px: string): number | null {
	const m = px.trim().match(/^(\d+)\s*[x×]\s*(\d+)$/i);
	if (!m) return null;
	const w = Number(m[1]);
	const h = Number(m[2]);
	if (!Number.isFinite(w) || !Number.isFinite(h) || w < 1 || h < 1)
		return null;
	return Math.floor(w) * Math.floor(h);
}

export function resolveVolcArkImageSize(
	settings: GzhWritingPipelineSettings,
	purpose: ImageCanvasPurpose,
): string {
	const fb = VOLC_IMAGE_SIZE_FALLBACK_BY_PURPOSE[purpose];
	const tRaw = rawImageSizeTrimmed(settings, purpose).trim();
	const compact = tRaw.replace(/\s+/g, "");

	if (!tRaw.length) return fb;
	if (/^[12]\s*k$/i.test(tRaw) || /^[12]k$/i.test(compact)) return fb;

	const area = parseWxHArea(tRaw);
	if (area === null) {
		console.warn(
			IMG_LOG_PREFIX,
			"火山作画 size 未能解析为 `宽x高`，已改用默认",
			{ purpose, had: tRaw, use: fb },
		);
		return fb;
	}
	if (area < VOLC_MIN_PIXEL_AREA) {
		console.warn(
			IMG_LOG_PREFIX,
			"火山作画 size 总像素低于下限（需 ≥3686400），已改用默认",
			{
				purpose,
				had: tRaw,
				pixels: area,
				min: VOLC_MIN_PIXEL_AREA,
				use: fb,
			},
		);
		return fb;
	}

	return tRaw;
}

function rawImageSizeTrimmed(
	settings: GzhWritingPipelineSettings,
	purpose: ImageCanvasPurpose,
): string {
	switch (purpose) {
		case "wechat_cover":
			return settings.imageSizeWechatCover.trim();
		case "wechat_illustration":
			return settings.imageSizeWechatIllustration.trim();
		case "xhs_cover":
			return settings.imageSizeXhsCover.trim();
		default:
			return settings.imageSizeXhsBody.trim();
	}
}

interface OpenAIImageResponse {
	data?: Array<{ b64_json?: string; url?: string }>;
	error?: { message?: string };
}

/** 解析各网关可能出现的 url / base64（不仅限于严格 OpenAI 形态）。 */
function extractFirstImageArtifact(j: unknown): {
	url?: string;
	b64?: string;
	rawKeys?: string[];
} {
	if (!j || typeof j !== "object") {
		return {};
	}
	const o = j as Record<string, unknown>;
	const keys = Object.keys(o);
	const rows: unknown[] = [];

	const pushArr = (a: unknown): void => {
		if (Array.isArray(a)) rows.push(...a);
		else if (a && typeof a === "object") rows.push(a);
	};

	pushArr(o.data);
	pushArr(o.output);
	pushArr(o.outputs);
	pushArr(o.images);
	pushArr(o.result);

	if (typeof o.url === "string" && /^https?:\/\//i.test(o.url)) {
		return { url: o.url, rawKeys: keys };
	}

	for (const item of rows) {
		if (!item || typeof item !== "object") continue;
		const row = item as Record<string, unknown>;
		const b64Candidates = ["b64_json", "b64", "base64", "image_base64"];
		for (const k of b64Candidates) {
			const v = row[k];
			if (typeof v === "string" && v.length > 20) return { b64: v, rawKeys: keys };
		}
		const urlCandidates = ["url", "image_url", "imageUrl", "revised_prompt_image_url"];
		for (const k of urlCandidates) {
			const v = row[k];
			if (typeof v === "string" && /^https?:\/\//i.test(v))
				return { url: v, rawKeys: keys };
		}
		const urls = row.urls as unknown;
		if (Array.isArray(urls) && typeof urls[0] === "string" && /^https?:\/\//i.test(urls[0]))
			return { url: urls[0], rawKeys: keys };
	}
	return { rawKeys: keys };
}

function safeJsonSnippet(obj: unknown, max = 900): string {
	try {
		const s = JSON.stringify(obj, null, 0);
		return s.length > max ? s.slice(0, max) + "…" : s;
	} catch {
		return "[无法序列化为 JSON]";
	}
}

function parseHttpResponseBody(res: { text: string; json: unknown }): unknown {
	const t = typeof res.text === "string" ? res.text : "";
	const trimmed = t.trim();
	if (trimmed.length > 0) {
		try {
			return JSON.parse(trimmed) as unknown;
		} catch {
			// Obsidian 可能已填 res.json
		}
	}
	return res.json;
}

export function resolveImageGenerationsUrl(
	settings: GzhWritingPipelineSettings,
): string {
	const u = settings.imageGenerationsUrl.trim();
	if (u.length > 0) return u;
	const base = pickActiveProviderConfig(settings).baseUrl
		.trim()
		.replace(/\/$/, "");
	if (base.toLowerCase().endsWith("/chat/completions")) {
		return base.replace(/\/chat\/completions$/i, "/images/generations");
	}
	if (base.toLowerCase().endsWith("/v1")) {
		return `${base}/images/generations`;
	}
	return `${base}/v1/images/generations`;
}

/** 仅 preset === custom 时需防 DeepSeek URL 推导踩坑。 */
function assertImageHttpLikelyConfigured(
	settings: GzhWritingPipelineSettings,
): void {
	if (settings.imagePresetProvider !== "custom") return;
	if (settings.imageGenerationsUrl.trim().length > 0) return;
	if (
		settings.provider === "deepseek" &&
		settings.useLlmApiKeyForImages
	) {
		throw new Error(
			[
				"生图预设为「自定义」且未填作画 URL，又从 DeepSeek Base URL 推导路径，会 404。",
				"",
				"请填写「自定义作画 URL」（完整 https://…/images/generations），或改为豆包/智谱/OpenAI GPT Image 预设并填对应 Key。",
			].join("\n"),
		);
	}
}

function imageHttpFailureMessage(params: {
	status: number;
	url: string;
	bodySnippet: string;
}): string {
	const baseMsg =
		params.bodySnippet.trim().length > 0
			? params.bodySnippet.trim().slice(0, 480)
			: `HTTP ${params.status}`;
	if (params.status === 404) {
		return [
			`图像接口返回 404。`,
			`请求 URL：${params.url}`,
			baseMsg !== `HTTP ${params.status}` ? `\n接口返回：${baseMsg}` : "",
			"",
			"请核对：豆包/智谱/OpenAI 控制台中的模型 ID 与区域；或检查「自定义作画 URL」是否正确。",
		]
			.filter(Boolean)
			.join("\n");
	}
	return baseMsg;
}

function pickImageApiKeyCustom(settings: GzhWritingPipelineSettings): string {
	if (settings.useLlmApiKeyForImages) {
		return pickActiveProviderConfig(settings).apiKey.trim();
	}
	return settings.imageApiKey.trim();
}

type HttpImageTarget = {
	url: string;
	apiKey: string;
	model: string;
	/** OpenAI 原生对 b64_json 支持较好；部分国内接口只返 url。 */
	preferB64Json: boolean;
};

function resolvePluginHttpTarget(
	settings: GzhWritingPipelineSettings,
): HttpImageTarget {
	const preset = settings.imagePresetProvider;
	if (preset === "custom") {
		assertImageHttpLikelyConfigured(settings);
		const key = pickImageApiKeyCustom(settings);
		if (!key.length) {
			throw new Error(
				"请选择「自定义」时：勾选复用 LLM Key，或填写「图片专用 API Key」。",
			);
		}
		const url = resolveImageGenerationsUrl(settings);
		const model = settings.imageModel.trim();
		if (!model.length) {
			throw new Error("「自定义」生图须填写「生图模型（model）」。");
		}
		return {
			url,
			apiKey: key,
			model,
			preferB64Json: true,
		};
	}

	if (preset === "doubao_volc") {
		const key = settings.imageApiKeyDoubaoArk.trim();
		if (!key.length) {
			throw new Error("请先填写「豆包 / 火山 Ark · 图像 API Key」。");
		}
		const model =
			settings.imageModel.trim() || PRESET_DEFAULT_MODEL.doubao_volc;
		return {
			url: VOLC_ARK_IMAGE_GENERATIONS,
			apiKey: key,
			model,
			preferB64Json: false,
		};
	}

	if (preset === "zhipu_glm") {
		const key = settings.imageApiKeyZhipuGlm.trim();
		if (!key.length) {
			throw new Error("请先填写「智谱 GLM / CogView · API Key」。");
		}
		const model =
			settings.imageModel.trim() || PRESET_DEFAULT_MODEL.zhipu_glm;
		return {
			url: ZHIPU_IMAGE_GENERATIONS,
			apiKey: key,
			model,
			preferB64Json: false,
		};
	}

	/* gpt_image */
	const key = settings.imageApiKeyGptImage.trim();
	if (!key.length) {
		throw new Error("请先填写「OpenAI GPT Image · API Key」。");
	}
	const model = settings.imageModel.trim() || PRESET_DEFAULT_MODEL.gpt_image;
	return {
		url: OPENAI_IMAGE_GENERATIONS,
		apiKey: key,
		model,
		preferB64Json: true,
	};
}

/** 发布/图文前校验作图配置可见错误（仅插件 HTTP）。 */
export function assertImagePipelineReady(
	settings: GzhWritingPipelineSettings,
): void {
	resolvePluginHttpTarget(settings);
}

/** Saves PNG-compatible binary under vault-relative path (.png suffix recommended). */
export class ImageGenerationService {
	constructor(
		private readonly app: App,
		private readonly files: FileService,
		private readonly getSettings: () => GzhWritingPipelineSettings,
	) {}

	async renderPromptToVaultImage(opts: {
		vaultPath: string;
		prompt: string;
		purpose: ImageCanvasPurpose;
		logFilePath?: string;
		timeoutMs?: number;
	}): Promise<void> {
		const settings = this.getSettings();
		const outNorm = normalizeVaultPath(opts.vaultPath);

		console.info(
			IMG_LOG_PREFIX,
			"插件 HTTP 作画",
			{ purpose: opts.purpose, vaultPath: outNorm },
		);

		const target = resolvePluginHttpTarget(settings);
		const isVolcArkDoubao =
			settings.imagePresetProvider === "doubao_volc" &&
			target.url.includes("volces.com");
		const sz = isVolcArkDoubao
			? resolveVolcArkImageSize(settings, opts.purpose)
			: resolveImageSizeForPurpose(settings, opts.purpose);
		const url = target.url;

		const postPayload = (body: Record<string, unknown>) =>
			requestUrl({
				url,
				method: "POST",
				/** 火山等网关 400 时也会带 JSON 报错；默认 throw 会直接抛错且不便于读 body */
				throw: false,
				contentType: "application/json",
				headers: {
					Authorization: `Bearer ${target.apiKey.trim()}`,
				},
				body: JSON.stringify(body),
			});

		let payload: Record<string, unknown>;
		if (isVolcArkDoubao) {
			payload = {
				model: target.model,
				prompt: opts.prompt.slice(0, 3900),
				sequential_image_generation: "disabled",
				response_format: "url",
				size: sz,
				stream: false,
				watermark: true,
			};
		} else {
			payload = {
				model: target.model,
				prompt: opts.prompt.slice(0, 3900),
				n: 1,
				size: sz,
			};
			if (target.preferB64Json) payload.response_format = "b64_json";
		}

		console.info(IMG_LOG_PREFIX, "插件 HTTP 作画请求", {
			preset: settings.imagePresetProvider,
			purpose: opts.purpose,
			isVolcArkSeedream: isVolcArkDoubao,
			endpoint: url,
			model: target.model,
			size: sz,
			promptChars: opts.prompt.length,
			vaultPath: outNorm,
		});

		let res: RequestUrlResponse;
		try {
			res = await postPayload(payload);
		} catch (err) {
			console.error(
				IMG_LOG_PREFIX,
				"作画请求抛错（网络/证书/Obsidian HTTP 插件层异常，非服务端 4xx）：",
				err,
			);
			throw err instanceof Error ? err : new Error(String(err));
		}

		let text0 = typeof res.text === "string" ? res.text : "";

		/** 服务端 400：Obsidian 已 throw:false；仍读 body */
		const logVolc400AndMaybeRetry =
			async (): Promise<void> => {
				if (!isVolcArkDoubao || res.status !== 400) return;

				console.error(
					IMG_LOG_PREFIX,
					"火山作画 HTTP 400（完整响应节选，可供控制台排查）:",
					text0.length > 0 ? text0.slice(0, 4000) : "[空 body]",
				);

				const minimalPayload: Record<string, unknown> = {
					model: target.model,
					prompt: opts.prompt.slice(0, 3900),
					response_format: "url",
					size: sz,
				};
				console.warn(
					IMG_LOG_PREFIX,
					"火山 400：正在用精简 body 重试一次（仅 model/prompt/response_format/size）…",
				);
				let resAlt;
				try {
					resAlt = await postPayload(minimalPayload);
				} catch (e2) {
					console.error(
						IMG_LOG_PREFIX,
						"精简重试同样失败（客户端异常）:",
						e2,
					);
					return;
				}
				const ta = typeof resAlt.text === "string" ? resAlt.text : "";
				console.info(
					IMG_LOG_PREFIX,
					"精简 body 重试结果",
					{ httpStatus: resAlt.status, responsePreview: ta.slice(0, 800) },
				);
				if (resAlt.status < 400) {
					res = resAlt;
					text0 = ta;
					payload = minimalPayload;
				}
			};

		await logVolc400AndMaybeRetry();

		if (
			res.status >= 400 &&
			target.preferB64Json &&
			"response_format" in payload &&
			/unrecognized|response_format|not support|unknown field/i.test(text0)
		) {
			const { response_format: _rf, ...rest } = payload;
			payload = rest;
			console.warn(
				IMG_LOG_PREFIX,
				"首次请求因 response_format 被拒，将去掉该字段重试一次",
			);
			res = await postPayload(payload);
			text0 = typeof res.text === "string" ? res.text : "";
		}

		const parsedBody = parseHttpResponseBody(res);

		console.info(IMG_LOG_PREFIX, "作画 HTTP 已返回", {
			httpStatus: res.status,
			responseTextChars: text0.length,
			topLevelKeys:
				parsedBody && typeof parsedBody === "object"
					? Object.keys(parsedBody as object)
					: [],
			bodyPreview:
				text0.length > 0
					? text0.slice(0, Math.min(text0.length, 600))
					: safeJsonSnippet(parsedBody, 600),
		});

		let j: OpenAIImageResponse = parsedBody as OpenAIImageResponse;

		if (res.status >= 400) {
			const msgFromBody =
				typeof (parsedBody as { error?: { message?: unknown } })?.error
					?.message === "string"
					? (parsedBody as { error: { message: string } }).error.message
					: undefined;
			const text = typeof res.text === "string" ? res.text : "";
			const raw =
				msgFromBody ??
				j?.error?.message ??
				(text.length ? text.slice(0, 500) : `HTTP ${res.status}`);
			const msg = imageHttpFailureMessage({
				status: res.status,
				url,
				bodySnippet: raw,
			});
			if (opts.logFilePath?.length) {
				fs.mkdirSync(path.dirname(opts.logFilePath), { recursive: true });
				fs.appendFileSync(opts.logFilePath, `\n[image-http] ${msg}\n`);
			}
			console.error(IMG_LOG_PREFIX, "作画接口返回 ≥400", {
				status: res.status,
				apiMessage: raw,
				fullBodyHead: text.slice(0, 2000),
			});
			const msgDetailed =
				text.length > 200
					? `${msg}\n\n接口正文（节选）:\n${text.slice(0, 1600)}`
					: msg;
			throw new Error(msgDetailed);
		}

		const artifact = extractFirstImageArtifact(parsedBody);
		const b64Fallback = artifact.b64;
		const remoteUrl =
			artifact.url ?? (parsedBody as OpenAIImageResponse)?.data?.[0]?.url;

		const b64 = b64Fallback ?? (parsedBody as OpenAIImageResponse)?.data?.[0]?.b64_json;

		if (!b64 && !remoteUrl) {
			console.error(IMG_LOG_PREFIX, "作画成功但未解析出图片（无 url/base64），完整摘要:", {
				keysSeen: artifact.rawKeys,
				snippet: safeJsonSnippet(parsedBody, 1200),
			});
			throw new Error(
				typeof (parsedBody as { error?: { message?: string } })?.error
					?.message === "string"
					? (parsedBody as { error: { message: string } }).error.message
					: "图片接口未返回可用数据（无 b64_json / url）；请对照控制台日志中的响应 JSON。",
			);
		}

		console.info(IMG_LOG_PREFIX, "已从响应中取到图片引用", {
			viaBase64: Boolean(b64),
			viaUrl: Boolean(remoteUrl && !b64),
		});

		let bin: ArrayBuffer;
		if (b64) {
			bin = base64ToArrayBuffer(b64);
		} else {
			console.info(
				IMG_LOG_PREFIX,
				"正在从返回的 URL 拉取二进制…",
				remoteUrl!.slice(0, 140),
			);
			const ures = await requestUrl({
				url: remoteUrl!,
				method: "GET",
				throw: false,
			});
			if (ures.status >= 400) {
				console.error(
					IMG_LOG_PREFIX,
					"下载生成图 URL 失败",
					remoteUrl!.slice(0, 200),
					"HTTP",
					ures.status,
				);
				throw new Error(`下载生成图失败 HTTP ${ures.status}`);
			}
			bin = ures.arrayBuffer;
		}

		if (!bin || bin.byteLength === 0) {
			console.error(
				IMG_LOG_PREFIX,
				"写入前图片长度为 0，放弃写入 vault",
				outNorm,
			);
			throw new Error("图片解码后长度为 0，无法写入 vault。");
		}

		await this.files.writeBinaryFile(outNorm, bin);
		console.info(IMG_LOG_PREFIX, "已写入 vault 图片", {
			vaultPath: outNorm,
			bytes: bin.byteLength,
		});
	}
}

function base64ToArrayBuffer(b64: string): ArrayBuffer {
	const buf = Buffer.from(b64, "base64");
	return buf.buffer.slice(
		buf.byteOffset,
		buf.byteOffset + buf.byteLength,
	) as ArrayBuffer;
}
