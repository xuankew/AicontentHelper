/**
 * Minimal frontmatter reader for `title:` only.
 * Does not implement full YAML.
 */
export function extractTitleFromFrontmatter(markdown: string): string | null {
	const match = /^---\s*\n([\s\S]*?)\n---\s*\n?/m.exec(markdown);
	if (!match) return null;
	const block = match[1];
	const titleLine = block
		.split("\n")
		.map((l) => l.trim())
		.find((l) => l.toLowerCase().startsWith("title:"));
	if (!titleLine) return null;
	const raw = titleLine.slice("title:".length).trim();
	return stripQuotes(raw);
}

function stripQuotes(s: string): string {
	if (
		(s.startsWith('"') && s.endsWith('"')) ||
		(s.startsWith("'") && s.endsWith("'"))
	) {
		return s.slice(1, -1);
	}
	return s;
}
