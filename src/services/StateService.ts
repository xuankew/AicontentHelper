import { TFile, Vault } from "obsidian";
import type {
	ArticleMeta,
	ArticleStatus,
	GzhWritingPipelineSettings,
	PipelineStep,
} from "../types";
import {
	basenameVault,
	dirnameVault,
	joinVaultPath,
	normalizeVaultPath,
} from "../utils/path";
import { STAGE_FILES } from "../templates/fileTemplates";

export class StateService {
	constructor(
		private readonly vault: Vault,
		private readonly getSettings: () => GzhWritingPipelineSettings,
	) {}

	/**
	 * Strict project resolution:
	 * - There is a `meta.json` in `projectRoot`
	 * - The parent directory matches Publishing rules:
	 *   - Source-adjacent mode: dirname(projectRoot)'s basename == `publishedDirName`
	 *   - Fixed root mode: dirname(projectRoot) == `fixedPublishedDirPath`
	 */
	async resolvePublishedProjectRoot(
		filePath: string,
	): Promise<string | null> {
		const normalized = normalizeVaultPath(filePath);
		let dir = dirnameVault(normalized);
		for (let i = 0; i < 250 && dir.length > 0; i++) {
			const metaPath = joinVaultPath(dir, STAGE_FILES.meta);
			const metaFile = this.vault.getAbstractFileByPath(metaPath);
			if (metaFile instanceof TFile) {
				const meta = await this.readMetaFromPath(metaPath);
				if (!meta) {
					dir = dirnameVault(dir);
					continue;
				}
				const publishedFolder = dirnameVault(dir);
				if (publishedFolder.length === 0) {
					dir = dirnameVault(dir);
					continue;
				}

				const settings = this.getSettings();
				let passesPublishingConvention = false;
				if (settings.createPublishedUnderSourceDir) {
					passesPublishingConvention =
						basenameVault(publishedFolder) === settings.publishedDirName;
				} else {
					passesPublishingConvention =
						normalizeVaultPath(publishedFolder) ===
						normalizeVaultPath(settings.fixedPublishedDirPath);
				}

				if (!passesPublishingConvention) {
					dir = dirnameVault(dir);
					continue;
				}
				// Basic consistency check: meta should match its folder
				if (normalizeVaultPath(meta.projectDirPath) !== dir) {
					dir = dirnameVault(dir);
					continue;
				}
				return dir;
			}
			const next = dirnameVault(dir);
			if (next === dir) break;
			dir = next;
		}
		return null;
	}

	async readMeta(projectRoot: string): Promise<ArticleMeta | null> {
		const metaPath = joinVaultPath(projectRoot, STAGE_FILES.meta);
		return this.readMetaFromPath(metaPath);
	}

	async readMetaOrThrow(projectRoot: string): Promise<ArticleMeta> {
		const meta = await this.readMeta(projectRoot);
		if (!meta) {
			throw new Error(
				"当前文件不属于有效的公众号文章项目，请检查目录结构。",
			);
		}
		return meta;
	}

	async readMetaFromPath(metaPath: string): Promise<ArticleMeta | null> {
		const f = this.vault.getAbstractFileByPath(metaPath);
		if (!(f instanceof TFile)) return null;
		let text = "";
		try {
			text = await this.vault.read(f);
		} catch {
			return null;
		}
		return tryParseMetaJson(text);
	}

	assertCanRunStep(params: {
		step: PipelineStep;
		projectRoot: string | null;
		meta: ArticleMeta | null;
	}): void {
		const { step, projectRoot, meta } = params;
		const inPublishedProject = !!projectRoot;

		if (step === "outline") {
			if (inPublishedProject) {
				throw new Error(
					"列提纲请从原始思考卡片文件开始（当前 Markdown 已在 Published 项目目录下）。",
				);
			}
			return;
		}

		if (!inPublishedProject) {
			throw new Error(
				"请先点击【列提纲】，在 Published 目录中生成文章项目后再继续。",
			);
		}

		if (!meta) {
			throw new Error("当前文件不属于有效的公众号文章项目，请检查目录结构。");
		}

		const status = meta.status;
		if (step === "draft" && status !== "outlined") {
			throw new Error(mismatchMessage(status, "draft"));
		}
		if (step === "humanize" && status !== "drafted") {
			throw new Error(mismatchMessage(status, "humanize"));
		}
		if (step === "review" && status !== "humanized") {
			throw new Error(mismatchMessage(status, "review"));
		}
	}
}

function mismatchMessage(status: ArticleStatus, attempted: PipelineStep): string {
	if (attempted === "draft") {
		if (status === "source_created")
			return "当前文章状态为 source_created，请先完成列提纲。";
		if (status === "drafted" || status === "humanized" || status === "reviewed")
			return `当前文章状态为 ${status}，扩写阶段不可用。`;
	}
	if (attempted === "humanize") {
		if (status === "outlined")
			return "当前文章状态为 outlined，请先完成扩写。";
		if (status === "source_created")
			return "当前文章状态为 source_created，请先完成列提纲与扩写。";
		if (status === "humanized" || status === "reviewed")
			return `当前文章状态为 ${status}，去 AI 味阶段不可用。`;
	}
	if (attempted === "review") {
		if (status === "drafted")
			return "当前文章状态为 drafted，请先完成去 AI 味。";
		if (status === "outlined")
			return "当前文章状态为 outlined，请先完成扩写与去 AI 味。";
		if (status === "source_created")
			return "当前文章状态为 source_created，请先按顺序完成前置阶段。";
		if (status === "reviewed")
			return "当前文章已进入 reviewed。如需重新审稿请使用专门的重新审稿命令。";
	}
	return `当前文章状态为 ${status}，该操作不可用。`;
}

function isArticleStatus(x: unknown): x is ArticleStatus {
	return (
		x === "source_created" ||
		x === "outlined" ||
		x === "drafted" ||
		x === "humanized" ||
		x === "reviewed"
	);
}

function tryParseMetaJson(text: string): ArticleMeta | null {
	try {
		const obj = JSON.parse(text) as Partial<ArticleMeta>;
		if (!obj || typeof obj !== "object") return null;
		if (!isArticleStatus(obj.status)) return null;
		if (typeof obj.id !== "string" || obj.id.length === 0) return null;
		if (typeof obj.title !== "string" || obj.title.length === 0) return null;
		if (typeof obj.sourceFilePath !== "string") return null;
		if (typeof obj.projectDirPath !== "string") return null;
		if (typeof obj.createdAt !== "string") return null;
		if (typeof obj.updatedAt !== "string") return null;
		if (!obj.files || typeof obj.files !== "object") return null;
		if (typeof obj.files.source !== "string") return null;
		return obj as ArticleMeta;
	} catch {
		return null;
	}
}
