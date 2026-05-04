import type { ArticleMeta, ArticleStatus } from "../types";
import { joinVaultPath } from "../utils/path";
import { STAGE_FILES } from "./fileTemplates";
import { createArticleId } from "../utils/random";

export function isoNow(): string {
	return new Date().toISOString();
}

export function initialMetaSkeleton(params: {
	title: string;
	sourceFilePath: string;
	projectDirPath: string;
	status: ArticleStatus;
}): ArticleMeta {
	const now = isoNow();
	return {
		id: createArticleId(),
		title: params.title,
		sourceFilePath: params.sourceFilePath,
		projectDirPath: params.projectDirPath,
		status: params.status,
		createdAt: now,
		updatedAt: now,
		files: {
			source: STAGE_FILES.source,
		},
	};
}

export function outlineMetaPath(projectDirPath: string): string {
	return joinVaultPath(projectDirPath, STAGE_FILES.meta);
}
