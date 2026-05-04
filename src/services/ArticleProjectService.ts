import type { ArticleMeta, GzhWritingPipelineSettings, LLMProviderConfig } from "../types";
import { dirnameVault, joinVaultPath, normalizeVaultPath } from "../utils/path";
import { sanitizePathSegment } from "../utils/slug";
import { randomSixDigits } from "../utils/random";
import type { FileService } from "./FileService";
import { initialMetaSkeleton } from "../templates/metaTemplate";
import { extractArticleTitle } from "../utils/markdown";

export class ArticleProjectService {
	constructor(
		private readonly files: FileService,
		private readonly getSettings: () => GzhWritingPipelineSettings,
	) {}

	getPublishedRootForSourceFile(sourceFilePath: string): string {
		const settings = this.getSettings();
		const parentDir = dirnameVault(sourceFilePath);
		if (settings.createPublishedUnderSourceDir) {
			return joinVaultPath(parentDir, settings.publishedDirName);
		}
		const fixed = normalizeVaultPath(settings.fixedPublishedDirPath);
		if (fixed.length === 0) {
			throw new Error(
				"你关闭了「在原始文件目录下创建 Published」，但未配置固定 Published 根目录。",
			);
		}
		return fixed;
	}

	async ensureUniqueProjectDir(params: {
		publishedRoot: string;
		title: string;
	}): Promise<string> {
		const safeTitle = sanitizePathSegment(params.title);
		for (let i = 0; i < 40; i++) {
			const dirName = `${safeTitle}-${randomSixDigits()}`;
			const candidate = joinVaultPath(params.publishedRoot, dirName);
			if (!(await this.files.pathExists(candidate))) {
				await this.files.mkdirp(candidate);
				return candidate;
			}
		}
		throw new Error("无法生成唯一文章目录，请稍后重试。");
	}

	buildInitialMeta(params: {
		title: string;
		sourceFilePath: string;
		projectDirPath: string;
	}): ArticleMeta {
		return initialMetaSkeleton({
			title: params.title,
			sourceFilePath: params.sourceFilePath,
			projectDirPath: normalizeVaultPath(params.projectDirPath),
			status: "source_created",
		});
	}

	extractTitle(sourceFilePath: string, markdown: string): string {
		return extractArticleTitle(sourceFilePath, markdown);
	}
}

export function pickActiveProviderConfig(
	settings: GzhWritingPipelineSettings,
): LLMProviderConfig {
	switch (settings.provider) {
		case "openai":
			return settings.openai;
		case "deepseek":
			return settings.deepseek;
		case "doubao":
			return settings.doubao;
		default:
			throw new Error(`未知 Provider`);
	}
}

export function assertApiKeyConfigured(
	settings: GzhWritingPipelineSettings,
): void {
	const cfg = pickActiveProviderConfig(settings);
	if (!cfg.apiKey.trim()) {
		throw new Error("请先在插件设置中配置当前 LLM Provider 的 API Key。");
	}
}

export function pickActiveModel(settings: GzhWritingPipelineSettings): string {
	return pickActiveProviderConfig(settings).model.trim();
}
