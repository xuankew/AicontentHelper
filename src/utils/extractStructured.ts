/** Pull first fenced ```yaml … ``` body from LLM response. */
export function extractYamlFencedBlock(text: string): string | null {
	const re = /^```(?:ya?ml)?\s*\n([\s\S]*?)\n```/im;
	const m = re.exec(text);
	return m?.[1]?.trim().length ? m[1]!.trim() : null;
}

/** Very small parser for `image_prompt:` multiline indented block under YAML-ish content. */
export function extractYamlImagePrompt(nestedYaml: string): string | null {
	const lines = nestedYaml.replace(/\r\n/g, "\n").split("\n");
	let i = 0;
	let keyLine = -1;
	for (; i < lines.length; i++) {
		if (/^image_prompt\s*:\s*/i.test(lines[i]!.trim())) {
			keyLine = i;
			break;
		}
	}
	if (keyLine < 0) return null;

	const header = lines[keyLine]!;
	const pipe = /\|\s*$/.test(header.trim());
	const inline = /^image_prompt\s*:\s*["'](.*)["']\s*$/i.exec(header);
	if (inline?.[1]) return inline[1].trim();

	if (!pipe) {
		const after = header.replace(/^.*?image_prompt\s*:\s*/i, "").trim();
		return after.replace(/^["']|["']$/g, "").trim() || null;
	}

	const body: string[] = [];
	for (let j = keyLine + 1; j < lines.length; j++) {
		const line = lines[j]!;
		if (line.startsWith("#")) continue;
		if (/^[a-z0-9_]+\s*:/i.test(line.trim())) break;
		body.push(line.replace(/^\t/, ""));
	}
	const joined = body.join("\n").trim();
	return joined.length ? joined : null;
}

export function stripCodeFencesJson(text: string): string {
	return text
		.trim()
		.replace(/^```(?:json)?\s*\n/im, "")
		.replace(/\n```\s*$/im, "")
		.trim();
}
