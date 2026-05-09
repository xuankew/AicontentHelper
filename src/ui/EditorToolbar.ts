import { MarkdownView, Workspace, type Plugin } from "obsidian";

const ATTR = "data-gzh-writing-pipeline-toolbar";

export type ToolbarActions = {
	outline: () => void | Promise<void>;
	draft: () => void | Promise<void>;
	humanize: () => void | Promise<void>;
	review: () => void | Promise<void>;
	publishWechat: () => void | Promise<void>;
	imageCards: () => void | Promise<void>;
	video: () => void | Promise<void>;
};

/**
 * Registers Markdown header actions (outline → review + publish / Moka cards).
 * Uses `MarkdownView.addAction(icon, title, …)` — the `title` is what Obsidian shows
 * on hover as the readable hint (do not overlay `setTooltip` here or the native hint
 * for that control may disappear).
 */
export function registerMarkdownEditorToolbar(
	plugin: Plugin,
	actions: ToolbarActions,
): void {
	const installAll = (): void => {
		plugin.app.workspace.iterateAllLeaves((leaf) => {
			const view = leaf.view;
			if (!(view instanceof MarkdownView)) return;
			installOnMarkdownView(view, actions);
		});
	};

	installAll();

	plugin.registerEvent(
		plugin.app.workspace.on("layout-change", installAll),
	);
	plugin.registerEvent(
		plugin.app.workspace.on("active-leaf-change", installAll),
	);

	plugin.register(() => {
		uninstallAll(plugin.app.workspace);
	});
}

function installOnMarkdownView(
	view: MarkdownView,
	actions: ToolbarActions,
): void {
	if (view.containerEl.querySelector(`[${ATTR}]`)) return;

	const defs: Array<{
		step: keyof ToolbarActions;
		icon: string;
		/** Passed to Obsidian — used as hover / accessibility label for the toolbar control. */
		title: string;
	}> = [
		{
			step: "outline",
			icon: "list",
			title: "列提纲 · 从正文生成提纲（AI内容助手）",
		},
		{
			step: "draft",
			icon: "pen-line",
			title: "扩写 · 根据提纲写成初稿",
		},
		{
			step: "humanize",
			icon: "wand",
			title: "去 AI 味 · 润色降机械感",
		},
		{
			step: "review",
			icon: "clipboard-check",
			title: "审稿 · 审稿报告与定稿入口",
		},
		{
			step: "publishWechat",
			icon: "megaphone",
			title:
				"微信公众平台 · API 发稿至草稿（封面与插图上传）；与「Moka 分页 PNG」是两条不同流程",
		},
		{
			step: "imageCards",
			icon: "layout-grid",
			title:
				"Moka 图文：小红书画风或公众号画风由设置的默认平台决定，分页导出 PNG（与侧边「发稿到微信公众平台」无关）",
		},
		{
			step: "video",
			icon: "video",
			title:
				"视频 · 将小红书图文 + 04-final.md 合成 30 秒竖屏短视频（ListenHub 配音 + FFmpeg）",
		},
	];

	for (const d of defs) {
		const el = view.addAction(d.icon, d.title, (_evt: MouseEvent) => {
			void Promise.resolve(actions[d.step]()).catch(() => {
				// Pipeline surfaces Notices; avoid unhandled rejections
			});
		});
		el.toggleClass(["gzh-wp-toolbar-btn"], true);
		el.setAttrs({
			[ATTR]: d.step,
			title: d.title,
			"aria-label": d.title,
		});
	}
}

export function uninstallAll(workspace: Workspace): void {
	workspace.iterateAllLeaves((leaf) => {
		const view = leaf.view;
		if (!(view instanceof MarkdownView)) return;
		for (const el of Array.from(
			view.containerEl.querySelectorAll(`[${ATTR}]`),
		)) {
			el.remove();
		}
	});
}
