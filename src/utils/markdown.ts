import { extractTitleFromFrontmatter } from "./frontmatter";
import { fileNameFromPath } from "./path";

export function extractArticleTitle(
	filePath: string,
	markdown: string,
): string {
	const fromFm = extractTitleFromFrontmatter(markdown);
	if (fromFm && fromFm.trim().length > 0) return fromFm.trim();

	const base = fileNameFromPath(filePath);
	if (base.toLowerCase().endsWith(".md")) {
		return base.slice(0, -3);
	}
	return base;
}
