/** Vault-style path using forward slashes */
export function normalizeVaultPath(path: string): string {
	return path.replace(/\\/g, "/").replace(/^\//, "").replace(/\/$/, "");
}

export function dirnameVault(path: string): string {
	const p = normalizeVaultPath(path);
	const i = p.lastIndexOf("/");
	if (i <= 0) return "";
	return p.slice(0, i);
}

export function joinVaultPath(...parts: string[]): string {
	return parts
		.map((p) => normalizeVaultPath(p))
		.filter((p) => p.length > 0)
		.join("/");
}

export function fileNameFromPath(path: string): string {
	const p = normalizeVaultPath(path);
	const i = p.lastIndexOf("/");
	return i >= 0 ? p.slice(i + 1) : p;
}

export function basenameVault(path: string): string {
	return fileNameFromPath(path);
}
