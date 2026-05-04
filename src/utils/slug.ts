const ILLEGAL = /[/\\:*?"<>|]/g;

export function sanitizePathSegment(name: string): string {
	const cleaned = name.replace(ILLEGAL, "-").replace(/\s+/g, " ").trim();
	return cleaned.length > 0 ? cleaned : "untitled";
}
