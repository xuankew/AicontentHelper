import type { GzhWritingPipelineSettings, LLMProvider } from "../types";
import { ChatCompletionsProvider } from "./ChatCompletionsProvider";

export function createLLMProviderFromSettings(
	settings: GzhWritingPipelineSettings,
): LLMProvider {
	switch (settings.provider) {
		case "openai":
			return new ChatCompletionsProvider(settings.openai);
		case "deepseek":
			return new ChatCompletionsProvider(settings.deepseek);
		case "doubao":
			return new ChatCompletionsProvider(settings.doubao);
		default:
			throw new Error(
				`未知 Provider：${String((settings as { provider?: string }).provider)}`,
			);
	}
}
