import type { App } from "obsidian";
import { spawn } from "child_process";
import * as nodePath from "path";
import * as fs from "fs";
import type { GzhWritingPipelineSettings } from "../types";
import { vaultRelativeToFilesystemPath } from "../utils/desktopVaultPath";

const RENDER_LOG = "[GZH 视频]";
type PlatformId = "xiaohongshu" | "douyin" | "shipinhao";

type PlatformVideoCopy = { title: string; openingText: string; endingText: string };

export interface VideoRenderJobInput {
	outputDirVault: string;
	coverPngVault?: string;
	middlePngVaultPaths?: string[];
	voiceover: string;
	platformCopies: Record<PlatformId, PlatformVideoCopy>;
	accountInfo: string;
}

export interface VideoRenderResult {
	outputVaultPath: string;
	outputs: Partial<Record<PlatformId, string>>;
	logVaultPath: string;
}

interface VideoConfigPlatformCopy {
	cover_title: string;
	opening_text: string;
	ending_text: string;
}
interface VideoConfigPayload {
	voiceover: string;
	accountInfo: string;
	platforms: Record<PlatformId, VideoConfigPlatformCopy>;
}
interface JobJson {
	outputDir: string;
	cardImageFiles?: string[];
	openSec: number;
	endSec: number;
	videoConfig: VideoConfigPayload & { openFramePngPath?: string };
	backgroundMusic?: { enabled: boolean; path: string; volume: number };
}
interface TtsConfigJson {
	engine: "listenhub" | "edge";
	listenhub?: { apiKey: string; voice: string; model: string; baseUrl?: string };
	edge?: { voice: string };
}

export class VideoRenderService {
	constructor(
		private readonly app: App,
		private readonly getSettings: () => GzhWritingPipelineSettings,
		private readonly pluginManifestId: string,
	) {}

	async render(input: VideoRenderJobInput): Promise<VideoRenderResult> {
		const settings = this.getSettings();
		this.assertEngineConfigured(settings);

		const outputAbs = vaultRelativeToFilesystemPath(this.app, input.outputDirVault);
		fs.mkdirSync(outputAbs, { recursive: true });

		const scriptAbs = this.resolveRenderScriptPath();
		if (!fs.existsSync(scriptAbs)) {
			throw new Error(`视频渲染脚本不存在：${scriptAbs}`);
		}

		const middleAbs = (input.middlePngVaultPaths ?? [])
			.map((p) => {
				try {
					return vaultRelativeToFilesystemPath(this.app, p);
				} catch {
					return "";
				}
			})
			.filter((p) => p.length > 0 && fs.existsSync(p));
		if (middleAbs.length === 0) {
			throw new Error("缺少视频中段图片（cardImageFiles 为空）。请先完成 Moka 视频导图。");
		}

		const coverAbs = input.coverPngVault
			? (() => {
					try {
						const a = vaultRelativeToFilesystemPath(this.app, input.coverPngVault!);
						return fs.existsSync(a) ? a : "";
					} catch {
						return "";
					}
				})()
			: "";

		const job: JobJson = {
			outputDir: outputAbs,
			cardImageFiles: middleAbs,
			openSec: settings.videoOpenSec,
			endSec: settings.videoEndSec,
			videoConfig: {
				voiceover: input.voiceover,
				accountInfo: input.accountInfo,
				openFramePngPath: coverAbs || undefined,
				platforms: {
					xiaohongshu: {
						cover_title: input.platformCopies.xiaohongshu.title,
						opening_text: input.platformCopies.xiaohongshu.openingText,
						ending_text: input.platformCopies.xiaohongshu.endingText,
					},
					douyin: {
						cover_title: input.platformCopies.douyin.title,
						opening_text: input.platformCopies.douyin.openingText,
						ending_text: input.platformCopies.douyin.endingText,
					},
					shipinhao: {
						cover_title: input.platformCopies.shipinhao.title,
						opening_text: input.platformCopies.shipinhao.openingText,
						ending_text: input.platformCopies.shipinhao.endingText,
					},
				},
			},
			backgroundMusic: this.resolveBgm(settings),
		};

		const tts: TtsConfigJson = {
			engine: settings.videoTtsEngine,
			listenhub:
				settings.videoTtsEngine === "listenhub"
					? {
							apiKey: settings.listenhubApiKey,
							voice: settings.listenhubVoice,
							model: settings.listenhubModel,
							baseUrl: settings.listenhubBaseUrl || undefined,
						}
					: undefined,
			edge:
				settings.videoTtsEngine === "edge"
					? { voice: "zh-CN-YunxiNeural" }
					: undefined,
		};

		const env: Record<string, string> = {
			...process.env,
			MDT_VIDEO_JOB_JSON: JSON.stringify(job),
			MDT_VIDEO_TTS_CONFIG_JSON: JSON.stringify(tts),
			MDT_VIDEO_TTS_ENGINE: settings.videoTtsEngine,
			PYTHONIOENCODING: "utf-8",
		};
		if (settings.videoFfmpegPath.trim()) {
			env.MDT_VIDEO_FFMPEG_PATH = settings.videoFfmpegPath.trim();
		}
		if (settings.enableDebugLog) env.MDT_DEBUG = "1";

		const stdout: string[] = [];
		const stderr: string[] = [];
		await new Promise<void>((resolve, reject) => {
			const cp = spawn(settings.videoPythonPath, [scriptAbs], {
				cwd: nodePath.dirname(scriptAbs),
				env,
				windowsHide: true,
			});
			cp.stdout?.setEncoding("utf-8");
			cp.stderr?.setEncoding("utf-8");
			cp.stdout?.on("data", (x: string) => {
				stdout.push(x);
				console.info(RENDER_LOG, "stdout", x.trimEnd());
			});
			cp.stderr?.on("data", (x: string) => {
				stderr.push(x);
				console.warn(RENDER_LOG, "stderr", x.trimEnd());
			});
			cp.on("error", (err) => reject(new Error(String(err))));
			cp.on("close", (code) => {
				if (code === 0) return resolve();
				reject(new Error(`视频渲染脚本异常退出(${code})`));
			});
		});

		const logVault = `${input.outputDirVault.replace(/\/$/, "")}/render.log`;
		fs.writeFileSync(
			vaultRelativeToFilesystemPath(this.app, logVault),
			(stdout.join("") + "\n" + stderr.join("")).trim() + "\n",
			"utf-8",
		);

		const outputs: Partial<Record<PlatformId, string>> = {};
		for (const p of ["xiaohongshu", "douyin", "shipinhao"] as const) {
			const v = `${input.outputDirVault.replace(/\/$/, "")}/${p}.mp4`;
			try {
				const abs = vaultRelativeToFilesystemPath(this.app, v);
				if (fs.existsSync(abs)) outputs[p] = v;
			} catch {
				// noop
			}
		}
		if (!outputs.xiaohongshu) {
			throw new Error(`渲染完成但缺少 xiaohongshu.mp4，详见 ${logVault}`);
		}

		return {
			outputVaultPath: outputs.xiaohongshu,
			outputs,
			logVaultPath: logVault,
		};
	}

	private resolveRenderScriptPath(): string {
		const adapter = this.app.vault.adapter as unknown as {
			getFullPath?: (p: string) => string;
		};
		if (typeof adapter.getFullPath !== "function") {
			throw new Error("当前资料库无法解析磁盘路径。");
		}
		const pluginRoot = adapter.getFullPath(
			`${this.app.vault.configDir}/plugins/${this.pluginManifestId}`,
		);
		return nodePath.join(pluginRoot, "scripts", "render_video.py");
	}

	private resolveBgm(settings: GzhWritingPipelineSettings): JobJson["backgroundMusic"] {
		const bgm = this.resolveBackgroundMusicAbs(settings);
		if (!bgm) return undefined;
		return {
			enabled: true,
			path: bgm,
			volume: settings.videoBackgroundMusicVolume,
		};
	}

	private resolveBackgroundMusicAbs(settings: GzhWritingPipelineSettings): string | null {
		const adapter = this.app.vault.adapter as unknown as {
			getFullPath?: (p: string) => string;
		};
		if (typeof adapter.getFullPath !== "function") return null;
		const raw = settings.videoBackgroundMusicPath.trim();
		if (raw) {
			if (nodePath.isAbsolute(raw) && fs.existsSync(raw)) return raw;
			try {
				const abs = adapter.getFullPath(raw);
				if (abs && fs.existsSync(abs)) return abs;
			} catch {
				// noop
			}
		}
		const pluginRoot = adapter.getFullPath(
			`${this.app.vault.configDir}/plugins/${this.pluginManifestId}`,
		);
		const fallback = nodePath.join(pluginRoot, "resource", "mp3", "65歌曲.mp3");
		return fs.existsSync(fallback) ? fallback : null;
	}

	private assertEngineConfigured(settings: GzhWritingPipelineSettings): void {
		if (settings.videoTtsEngine === "listenhub" && !settings.listenhubApiKey.trim()) {
			throw new Error("ListenHub API Key 未配置。");
		}
		if (!settings.videoPythonPath.trim()) {
			throw new Error("请在设置中填写 Python 可执行文件路径。");
		}
	}
}

