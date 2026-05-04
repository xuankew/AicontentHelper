import type { App } from "obsidian";
import { normalizeVaultPath } from "./path";

type AdapterWithFsPath = {
	getFullPath(normalizedPath: string): string;
};

/**
 * Resolves vault-relative POSIX paths to filesystem paths (Obsidian Desktop, local vault).
 */
export function vaultRelativeToFilesystemPath(
	app: App,
	vaultRelative: string,
): string {
	const norm = normalizeVaultPath(vaultRelative);
	const adapter = app.vault.adapter as unknown as Partial<AdapterWithFsPath>;
	if (typeof adapter.getFullPath !== "function") {
		throw new Error(
			"当前资料库无法在磁盘上解析绝对路径（需本地文件夹类 vault）；部分导出或外部工具如需绝对路径请先使用本地文件夹库。",
		);
	}
	const fp = adapter.getFullPath(norm);
	if (!fp || fp.length === 0) {
		throw new Error(`磁盘路径为空：` + vaultRelative);
	}
	return fp;
}
