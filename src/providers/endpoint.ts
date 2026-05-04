const CHAT_COMPLETIONS_PATH = "/v1/chat/completions";

/**
 * Accepts:
 * - Base URL like `https://api.openai.com/v1`
 * - Base URL like `https://api.openai.com`
 * - Full endpoint already ending with `/chat/completions` (optionally with query)
 */
export function resolveChatCompletionsUrl(baseUrl: string): string {
	const raw = baseUrl.trim();
	if (!raw) throw new Error("Base URL 为空");
	if (/\/chat\/completions(\?|#|$)/i.test(raw)) return raw;

	const trimmed = raw.replace(/\/+$/, "");
	if (trimmed.toLowerCase().endsWith("/v1")) {
		return `${trimmed}/chat/completions`;
	}
	return `${trimmed}${CHAT_COMPLETIONS_PATH}`;
}
