import { requestUrl } from "obsidian";
import type { LLMProvider, LLMProviderConfig, GenerateOptions } from "../types";
import { resolveChatCompletionsUrl } from "./endpoint";

interface ChatCompletionResponse {
	choices?: Array<{
		message?: { content?: string | null };
	}>;
	error?: { message?: string };
}

export class ChatCompletionsProvider implements LLMProvider {
	constructor(private readonly config: LLMProviderConfig) {}

	async generate(
		prompt: string,
		options?: GenerateOptions,
	): Promise<string> {
		const url = resolveChatCompletionsUrl(this.config.baseUrl);
		const apiKey = this.config.apiKey.trim();
		if (!apiKey) {
			throw new Error("API Key 未配置");
		}
		const model = this.config.model.trim();
		if (!model) {
			throw new Error("模型名称未配置");
		}

		const body: Record<string, unknown> = {
			model,
			messages: [{ role: "user", content: prompt }],
		};

		if (options?.temperature !== undefined) {
			body.temperature = options.temperature;
		}
		if (options?.maxTokens !== undefined) {
			body.max_tokens = options.maxTokens;
		}

		const res = await requestUrl({
			url,
			method: "POST",
			headers: {
				Authorization: `Bearer ${apiKey}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify(body),
		});

		if (res.status >= 400) {
			let msg = `HTTP ${res.status}`;
			try {
				const j = res.json as ChatCompletionResponse;
				if (j?.error?.message) msg = j.error.message;
			} catch {
				if (typeof res.text === "string" && res.text.length > 0) {
					msg = res.text.slice(0, 500);
				}
			}
			throw new Error(msg);
		}

		const json = res.json as ChatCompletionResponse;
		const content = json?.choices?.[0]?.message?.content;
		if (typeof content !== "string" || content.trim().length === 0) {
			throw new Error("LLM 返回内容为空");
		}
		return content;
	}
}
