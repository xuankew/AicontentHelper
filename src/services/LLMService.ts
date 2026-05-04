import type { GzhWritingPipelineSettings } from "../types";
import { createLLMProviderFromSettings } from "../providers/ProviderFactory";

export class LLMService {
	constructor(private settingsProvider: () => GzhWritingPipelineSettings) {}

	async generate(prompt: string): Promise<string> {
		const settings = this.settingsProvider();
		const provider = createLLMProviderFromSettings(settings);
		return provider.generate(prompt, {
			temperature: settings.modelTemperature,
			maxTokens: settings.maxTokens,
		});
	}
}
