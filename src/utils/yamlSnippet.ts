/** Minimal YAML-ish frontmatter for WeChat tooling (avoid extra deps). */
export function stringifySimpleFrontmatter(
	fields: Record<string, string>,
): string {
	const lines = Object.entries(fields)
		.filter(([, v]) => v.trim().length > 0)
		.map(([k, v]) => `${k}: ${quote(v)}`);
	return `---\n${lines.join("\n")}\n---\n\n`;
}

function quote(v: string): string {
	const needsQuotes =
		/[\n\r:#]/.test(v) || v.includes('"') || v.trim() !== v;
	if (!needsQuotes) return v;
	return `"${v.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}
