import { TFile, Vault } from "obsidian";
import {
	dirnameVault,
	fileNameFromPath,
	joinVaultPath,
	normalizeVaultPath,
} from "../utils/path";
import { randomSixDigits } from "../utils/random";

export class FileService {
	constructor(private readonly vault: Vault) {}

	async mkdirp(folderPath: string): Promise<void> {
		const norm = normalizeVaultPath(folderPath);
		if (norm.length === 0) return;
		const parts = norm.split("/");
		let acc = "";
		for (const part of parts) {
			acc = acc ? `${acc}/${part}` : part;
			const exists = await this.vault.adapter.exists(acc);
			if (!exists) {
				await this.vault.createFolder(acc);
			}
		}
	}

	async createTextFile(path: string, content: string): Promise<TFile> {
		const norm = normalizeVaultPath(path);
		const dir = dirnameVault(norm);
		if (dir.length > 0) await this.mkdirp(dir);
		return await this.vault.create(norm, content);
	}

	async writeTextFile(path: string, content: string): Promise<TFile> {
		const norm = normalizeVaultPath(path);
		const existing = this.vault.getAbstractFileByPath(norm);
		if (existing instanceof TFile) {
			await this.vault.modify(existing, content);
			return existing;
		}
		return await this.createTextFile(norm, content);
	}

	async readTextFile(path: string): Promise<string> {
		const norm = normalizeVaultPath(path);
		const f = this.vault.getAbstractFileByPath(norm);
		if (!(f instanceof TFile)) {
			throw new Error(`文件不存在：${norm}`);
		}
		return await this.vault.read(f);
	}

	async pathExists(path: string): Promise<boolean> {
		return await this.vault.adapter.exists(normalizeVaultPath(path));
	}

	async renameWithTimestampSuffix(file: TFile): Promise<string> {
		const folder = dirnameVault(file.path);
		const base = fileNameFromPath(file.path);
		for (let i = 0; i < 25; i++) {
			const suffix = `${formatLocalTimestamp(new Date())}${
				i === 0 ? "" : `-${randomSixDigits()}`
			}`;
			const stampedName = stampFileName(base, suffix);
			const target = joinVaultPath(folder, stampedName);
			if (await this.pathExists(target)) continue;
			await this.vault.rename(file, target);
			return target;
		}
		throw new Error("无法为重命名生成唯一文件名");
	}

	async deleteIfExists(path: string): Promise<void> {
		const norm = normalizeVaultPath(path);
		const f = this.vault.getAbstractFileByPath(norm);
		if (f instanceof TFile) {
			await this.vault.delete(f);
		}
	}

	/** Write binary assets; ensures parent dirs exist (like `writeTextFile`). */
	async writeBinaryFile(path: string, data: ArrayBuffer): Promise<void> {
		const norm = normalizeVaultPath(path);
		const dir = dirnameVault(norm);
		if (dir.length > 0) await this.mkdirp(dir);
		const existing = this.vault.getAbstractFileByPath(norm);
		if (existing instanceof TFile) {
			await this.vault.modifyBinary(existing, data);
		} else {
			await this.vault.createBinary(norm, data);
		}
	}
}

function formatLocalTimestamp(d: Date): string {
	const pad = (n: number) => String(n).padStart(2, "0");
	const y = d.getFullYear();
	const m = pad(d.getMonth() + 1);
	const day = pad(d.getDate());
	const hh = pad(d.getHours());
	const mm = pad(d.getMinutes());
	const ss = pad(d.getSeconds());
	return `${y}${m}${day}-${hh}${mm}${ss}`;
}

function stampFileName(original: string, ts: string): string {
	const lower = original.toLowerCase();
	if (lower.endsWith(".md")) {
		return `${original.slice(0, -3)}-${ts}.md`;
	}
	return `${original}-${ts}`;
}
