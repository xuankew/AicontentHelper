import { App, Notice, Plugin, PluginSettingTab, Setting } from "obsidian";
import type {
	GzhWritingPipelineSettings,
	ImagePresetProvider,
	MokaCardExportPixelRatio,
	MokaCardTemplateId,
	MokaPaletteId,
} from "../types";
import type { MokaCardTemplateCategory } from "../settings/mokaCardPresets";
import {
	MOKA_CARD_TEMPLATE_CATEGORY,
	MOKA_CARD_TEMPLATE_HINTS,
	MOKA_CARD_TEMPLATE_IDS,
	MOKA_CARD_TEMPLATE_LABELS_ZH,
	MOKA_PALETTE_HINTS,
	MOKA_PALETTE_IDS,
	MOKA_PALETTE_LABELS_ZH,
} from "../settings/mokaCardPresets";
import {
	DEFAULT_RAPHAEL_THEME_ID,
	THEME_GROUPS,
} from "../services/RaphaelWechatFormatter";
import {
	coerceWechatSimpleCoverBgId,
	DEFAULT_WECHAT_SIMPLE_COVER_TAGLINE,
	WECHAT_SIMPLE_COVER_BACKGROUNDS,
} from "../services/WechatSimpleCoverService";

/** Minimal surface the settings tab needs (avoids circular imports). */
export type PipelinePluginLike = Plugin & {
	settings: GzhWritingPipelineSettings;
	saveSettings(): Promise<void>;
};

function addFold(
	parent: HTMLElement,
	title: string,
	openDefault: boolean,
	build: (body: HTMLElement) => void,
): void {
	const det = parent.createEl("details");
	det.open = openDefault;
	const sum = det.createEl("summary");
	sum.textContent = title;
	sum.style.cursor = "pointer";
	sum.style.fontWeight = "600";
	sum.style.marginBottom = "0.35em";
	const body = det.createDiv();
	body.style.paddingLeft = "0.25rem";
	body.style.marginBottom = "1em";
	build(body);
}

function addStrEnumDropdown<S extends string>(
	body: HTMLElement,
	name: string,
	desc: string,
	values: readonly S[],
	cur: S,
	withLabel: undefined | ((v: S) => string),
	assign: (v: S) => void,
	settingsSaver: () => Promise<void>,
): void {
	new Setting(body).setName(name).setDesc(desc).addDropdown((dd) => {
		for (const v of values) {
			const lab = withLabel?.(v) ?? v;
			dd.addOption(v, lab);
		}
		return dd.setValue(cur).onChange(async (v) => {
			assign(v as S);
			await settingsSaver();
		});
	});
}

const MOKA_PLATFORM_OPTIONS = ["xhs", "wechat"] as const;

const TPL_CATEGORY_PREFIX: Record<MokaCardTemplateCategory, string> = {
	classic: "经典",
	xhs_hot: "小红书热门",
	wechat_vertical: "公众号",
};

function orderedMokaTemplates(): readonly MokaCardTemplateId[] {
	const order: MokaCardTemplateCategory[] = [
		"classic",
		"xhs_hot",
		"wechat_vertical",
	];
	const byCat = new Map<MokaCardTemplateCategory, MokaCardTemplateId[]>();
	for (const c of order) byCat.set(c, []);
	for (const id of MOKA_CARD_TEMPLATE_IDS) {
		byCat.get(MOKA_CARD_TEMPLATE_CATEGORY[id])!.push(id);
	}
	return order.flatMap((c) => byCat.get(c)!);
}

function tplDropdownLabel(id: MokaCardTemplateId): string {
	const cat = TPL_CATEGORY_PREFIX[MOKA_CARD_TEMPLATE_CATEGORY[id]];
	const zh = MOKA_CARD_TEMPLATE_LABELS_ZH[id];
	const raw = MOKA_CARD_TEMPLATE_HINTS[id];
	const hint = raw.length > 40 ? `${raw.slice(0, 40)}…` : raw;
	return `「${cat}」${zh}（${id}） — ${hint}`;
}

function paletteDropdownLabel(id: MokaPaletteId): string {
	return `${MOKA_PALETTE_LABELS_ZH[id]}（${id}） — ${MOKA_PALETTE_HINTS[id]}`;
}

export class GZHSettingTab extends PluginSettingTab {
	readonly pipelinePlugin: PipelinePluginLike;

	constructor(app: App, plugin: PipelinePluginLike) {
		super(app, plugin);
		this.pipelinePlugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		addFold(containerEl, "LLM Provider · API 配置", true, (bodyEl) => {
			new Setting(bodyEl)
			.setName("当前 Provider")
			.setDesc("选择一个 Provider（OpenAI / DeepSeek / 豆包）。实际请求都会走兼容 OpenAI Chat Completions 的接口。")
			.addDropdown((dd) =>
				dd
					.addOption("openai", "OpenAI")
					.addOption("deepseek", "DeepSeek")
					.addOption("doubao", "豆包")
					.setValue(this.pipelinePlugin.settings.provider)
					.onChange(async (v) => {
						this.pipelinePlugin.settings.provider =
							v as GzhWritingPipelineSettings["provider"];
						await this.pipelinePlugin.saveSettings();
						new Notice("已切换 Provider。", 2000);
						this.display();
					}),
			);

		const provider = this.pipelinePlugin.settings.provider;
		bodyEl.createEl("h3", { text: `当前 Provider：${provider}` });

		if (provider === "doubao") {
			bodyEl.createEl("small", {
				text: "豆包：请填写兼容 OpenAI Chat Completions 的 Base URL，或直接填写完整的 .../chat/completions Endpoint。",
			});
			bodyEl.createDiv();
		}

		const cfg = this.pipelinePlugin.settings[provider];

		new Setting(bodyEl)
			.setName("API Key")
			.addText((t) => {
				t.inputEl.type = "password";
				t.inputEl.placeholder = "***";
				t.setValue(cfg.apiKey).onChange(async (v) => {
					cfg.apiKey = v;
					await this.pipelinePlugin.saveSettings();
				});
				return t;
			});

		new Setting(bodyEl)
			.setName("Base URL")
			.addText((t) =>
				t.setValue(cfg.baseUrl).onChange(async (v) => {
					cfg.baseUrl = v;
					await this.pipelinePlugin.saveSettings();
				}),
			);

		new Setting(bodyEl)
			.setName("Model")
			.addText((t) =>
				t.setValue(cfg.model).onChange(async (v) => {
					cfg.model = v;
					await this.pipelinePlugin.saveSettings();
				}),
			);
		});

		addFold(containerEl, "Published 目录", true, (bodyEl) => {
			new Setting(bodyEl)
			.setName("Published 目录名称")
			.setDesc("默认：Published")
			.addText((t) =>
				t
					.setValue(this.pipelinePlugin.settings.publishedDirName)
					.onChange(async (v) => {
						this.pipelinePlugin.settings.publishedDirName =
							v.trim() || "Published";
						await this.pipelinePlugin.saveSettings();
					}),
			);

		new Setting(bodyEl)
			.setName("在原始文件所在目录下创建 Published（推荐）")
			.addToggle((toggle) =>
				toggle
					.setValue(this.pipelinePlugin.settings.createPublishedUnderSourceDir)
					.onChange(async (v) => {
						this.pipelinePlugin.settings.createPublishedUnderSourceDir = v;
						await this.pipelinePlugin.saveSettings();
						this.display();
					}),
			);

			if (!this.pipelinePlugin.settings.createPublishedUnderSourceDir) {
				new Setting(bodyEl)
					.setName("固定 Published 根目录（vault 相对路径）")
					.setDesc("示例：内容创作/公众号/成品（不要以 / 开头）")
					.addText((t) =>
						t
							.setValue(this.pipelinePlugin.settings.fixedPublishedDirPath)
							.onChange(async (v) => {
								this.pipelinePlugin.settings.fixedPublishedDirPath = v;
								await this.pipelinePlugin.saveSettings();
							}),
					);
			}
		});

		addFold(containerEl, "Temperature / Tokens / 人设 / 阶段提示词", true, (bodyEl) => {
			new Setting(bodyEl)
			.setName("Temperature（0–2）")
			.addText((t) =>
				t
					.setPlaceholder("0.7")
					.setValue(String(this.pipelinePlugin.settings.modelTemperature))
					.onChange(async (v) => {
						const num = Number(v);
						if (!Number.isFinite(num)) return;
						this.pipelinePlugin.settings.modelTemperature = Math.max(
							0,
							Math.min(2, num),
						);
						await this.pipelinePlugin.saveSettings();
					}),
			);

		new Setting(bodyEl)
			.setName("Max Tokens")
			.addText((t) =>
				t
					.setPlaceholder("4096")
					.setValue(String(this.pipelinePlugin.settings.maxTokens))
					.onChange(async (v) => {
						const n = Number.parseInt(v, 10);
						if (!Number.isFinite(n) || n <= 0) return;
						this.pipelinePlugin.settings.maxTokens = n;
						await this.pipelinePlugin.saveSettings();
					}),
			);

			bodyEl.createEl("h3", { text: "人设与风格" });

			addPromptArea(bodyEl, {
				title: "个人身份提示词（{{authorProfilePrompt}}）",
				value: this.pipelinePlugin.settings.authorProfilePrompt,
				heightPx: 110,
				onChange: async (v) => {
					this.pipelinePlugin.settings.authorProfilePrompt = v;
					await this.pipelinePlugin.saveSettings();
				},
			});

			addPromptArea(bodyEl, {
				title: "内容风格提示词（{{writingStylePrompt}}）",
				value: this.pipelinePlugin.settings.writingStylePrompt,
				heightPx: 110,
				onChange: async (v) => {
					this.pipelinePlugin.settings.writingStylePrompt = v;
					await this.pipelinePlugin.saveSettings();
				},
			});

			bodyEl.createEl("h3", { text: "阶段提示词" });
			bodyEl.createEl("small", {
				text: "变量：{{authorProfilePrompt}} {{writingStylePrompt}} {{sourceContent}} {{outlineContent}} {{draftContent}} {{humanizedContent}}",
			});
			bodyEl.createDiv();

			addPromptArea(bodyEl, {
				title: "列提纲提示词（outlinePrompt）",
				value: this.pipelinePlugin.settings.outlinePrompt,
				heightPx: 220,
				onChange: async (v) => {
					this.pipelinePlugin.settings.outlinePrompt = v;
					await this.pipelinePlugin.saveSettings();
				},
			});

			addPromptArea(bodyEl, {
				title: "扩写提示词（draftPrompt）",
				value: this.pipelinePlugin.settings.draftPrompt,
				heightPx: 220,
				onChange: async (v) => {
					this.pipelinePlugin.settings.draftPrompt = v;
					await this.pipelinePlugin.saveSettings();
				},
			});

			addPromptArea(bodyEl, {
				title: "去 AI 味提示词（humanizePrompt）",
				value: this.pipelinePlugin.settings.humanizePrompt,
				heightPx: 220,
				onChange: async (v) => {
					this.pipelinePlugin.settings.humanizePrompt = v;
					await this.pipelinePlugin.saveSettings();
				},
			});

			addPromptArea(bodyEl, {
				title: "审稿提示词（reviewPrompt）",
				value: this.pipelinePlugin.settings.reviewPrompt,
				heightPx: 260,
				onChange: async (v) => {
					this.pipelinePlugin.settings.reviewPrompt = v;
					await this.pipelinePlugin.saveSettings();
				},
			});
		});

		addFold(containerEl, "微信公众号 · 草稿 API（官方）", false, (bodyEl) => {
			bodyEl.createEl("small", {
				text: "「发布到公众号」将直接调用微信 `draft/add`。需填写 AppId / AppSecret（具有素材与草稿接口权限）。日志前缀：[GZH 微信 API]。",
			});
			bodyEl.createDiv();

			new Setting(bodyEl)
				.setName("简易公众号封面（模板）")
				.setDesc(
					"开启后，点击喇叭发布时用 900×383 纯色底图 + 主副标题 + 左上角 logo/标语生成 cover.png，不再调用文生图封面。请将 logo.png 放在插件目录：.obsidian/plugins/" +
						this.pipelinePlugin.manifest.id +
						"/logo.png。",
				)
				.addToggle((tg) =>
					tg
						.setValue(this.pipelinePlugin.settings.wechatSimpleCoverEnabled)
						.onChange(async (v) => {
							this.pipelinePlugin.settings.wechatSimpleCoverEnabled = v;
							await this.pipelinePlugin.saveSettings();
						}),
				);

			new Setting(bodyEl)
				.setName("封面背景色（5 种）")
				.setDesc("温馨浅底或深蓝高对比，可按文章气质选择。")
				.addDropdown((dd) => {
					for (const b of WECHAT_SIMPLE_COVER_BACKGROUNDS) {
						dd.addOption(b.id, `${b.label}（${b.bg}）`);
					}
					dd.setValue(
						this.pipelinePlugin.settings.wechatSimpleCoverBgId,
					).onChange(async (v) => {
						this.pipelinePlugin.settings.wechatSimpleCoverBgId =
							coerceWechatSimpleCoverBgId(v);
						await this.pipelinePlugin.saveSettings();
					});
				});

			new Setting(bodyEl)
				.setName("封面左上角标语")
				.setDesc(
					"显示在 logo 右侧；用竖线 | 分成两行（第一行加粗、第二行略小）。留空则用默认：" +
						DEFAULT_WECHAT_SIMPLE_COVER_TAGLINE,
				)
				.addText((t) =>
					t
						.setPlaceholder(DEFAULT_WECHAT_SIMPLE_COVER_TAGLINE)
						.setValue(
							this.pipelinePlugin.settings.wechatSimpleCoverTagline,
						)
						.onChange(async (v) => {
							this.pipelinePlugin.settings.wechatSimpleCoverTagline = v;
							await this.pipelinePlugin.saveSettings();
						}),
				);

			new Setting(bodyEl)
				.setName("简易封面 logo（仓库内路径，可选）")
				.setDesc(
					"相对仓库根的路径，如 attachments/logo.png。留空则使用 .obsidian/plugins/" +
						this.pipelinePlugin.manifest.id +
						"/logo.png。",
				)
				.addText((t) =>
					t
						.setPlaceholder("例如 attachments/gzh-logo.png")
						.setValue(
							this.pipelinePlugin.settings.wechatSimpleCoverLogoVaultPath,
						)
						.onChange(async (v) => {
							this.pipelinePlugin.settings.wechatSimpleCoverLogoVaultPath = v;
							await this.pipelinePlugin.saveSettings();
						}),
				);

			new Setting(bodyEl)
				.setName("公众号 theme / author")
				.addText((t) =>
					t
						.setPlaceholder("theme|author")
						.setValue(
							`${this.pipelinePlugin.settings.wechatTheme}|${this.pipelinePlugin.settings.wechatAuthor}`,
						)
						.onChange(async (v) => {
							const [th, au] = v.split("|");
							this.pipelinePlugin.settings.wechatTheme =
								th?.trim() || "default";
							this.pipelinePlugin.settings.wechatAuthor = au ?? "";
							await this.pipelinePlugin.saveSettings();
						}),
				);

			new Setting(bodyEl)
				.setName("公众号 theme color（可选）")
				.addText((t) =>
					t.setValue(this.pipelinePlugin.settings.wechatColor).onChange(
						async (v) => {
							this.pipelinePlugin.settings.wechatColor = v;
							await this.pipelinePlugin.saveSettings();
						},
					),
				);

			new Setting(bodyEl)
				.setName("公众号排版主题（Raphael Publish）")
				.setDesc(
					createFragment((el: DocumentFragment) => {
						el.createEl("p", {
							text: "「发布到公众号」时，正文按所选主题生成内联样式 HTML 再写入草稿。",
						});
						el.createEl("p", {
							text: `默认主题 id：${DEFAULT_RAPHAEL_THEME_ID}（微信公众号原生）。`,
						});
					}),
				)
				.addDropdown((dd) => {
					while (dd.selectEl.firstChild) {
						dd.selectEl.removeChild(dd.selectEl.firstChild);
					}
					for (const group of THEME_GROUPS) {
						const og = document.createElement("optgroup");
						og.label = group.label;
						for (const t of group.themes) {
							const opt = document.createElement("option");
							opt.value = t.id;
							opt.textContent = `${t.name} · ${t.id}`;
							og.appendChild(opt);
						}
						dd.selectEl.appendChild(og);
					}
					const raw =
						this.pipelinePlugin.settings.wechatRaphaelThemeId?.trim() ||
						"";
					const known = THEME_GROUPS.some((g) =>
						g.themes.some((t) => t.id === raw),
					);
					const current = known ? raw : DEFAULT_RAPHAEL_THEME_ID;
					dd.setValue(current).onChange(async (v) => {
						this.pipelinePlugin.settings.wechatRaphaelThemeId =
							v.trim() || DEFAULT_RAPHAEL_THEME_ID;
						await this.pipelinePlugin.saveSettings();
					});
				});

			new Setting(bodyEl)
				.setName("WECHAT_APP_ID | SECRET（必填以发草稿）")
				.setDesc("单行填写：appId|appSecret")
				.addText((t) =>
					t
						.setPlaceholder("appId|appSecret")
						.setValue(
							`${this.pipelinePlugin.settings.wechatAppId}|${this.pipelinePlugin.settings.wechatAppSecret}`,
						)
						.onChange(async (v) => {
							const [id, secret] = v.split("|");
							this.pipelinePlugin.settings.wechatAppId = id ?? "";
							this.pipelinePlugin.settings.wechatAppSecret =
								secret ?? "";
							await this.pipelinePlugin.saveSettings();
						}),
				);
		});

		addFold(containerEl, "作图（插件 HTTP）与画布", true, (imgEl) => {
			imgEl.createEl("p", {
				text: "公众号封面与正文配图仍走文生图 HTTP。Native 小红书卡片由「Moka DOM」本地导出，不依赖下列「小红书」画布尺寸，除非日后恢复 API 制图。",
				cls: "setting-item-description",
			});

			new Setting(imgEl)
				.setName("作图服务（HTTP）")
				.setDesc("豆包=火山 Ark；智谱=CogView；GPT Image；或自定义 URL。")
				.addDropdown((dd) =>
					dd
						.addOption("doubao_volc", "豆包 · 火山 Ark 图像")
						.addOption("zhipu_glm", "智谱 · GLM / CogView")
						.addOption("gpt_image", "OpenAI · GPT Image")
						.addOption("custom", "自定义 OpenAI-compatible URL")
						.setValue(this.pipelinePlugin.settings.imagePresetProvider)
						.onChange(async (v) => {
							this.pipelinePlugin.settings.imagePresetProvider =
								v as ImagePresetProvider;
							await this.pipelinePlugin.saveSettings();
							this.display();
						}),
				);

			const preset = this.pipelinePlugin.settings.imagePresetProvider;

			if (preset === "doubao_volc") {
				new Setting(imgEl)
					.setName("豆包 / 火山 Ark · API Key")
					.setDesc("火山引擎控制台 → 方舟 → API Key。")
					.addText((t) => {
						t.inputEl.type = "password";
						return t
							.setValue(this.pipelinePlugin.settings.imageApiKeyDoubaoArk)
							.onChange(async (v) => {
								this.pipelinePlugin.settings.imageApiKeyDoubaoArk = v;
								await this.pipelinePlugin.saveSettings();
							});
					});
			}

			if (preset === "zhipu_glm") {
				new Setting(imgEl)
					.setName("智谱开放平台 · API Key")
					.setDesc("open.bigmodel.cn 获取，用于 CogView / GLM-Image。")
					.addText((t) => {
						t.inputEl.type = "password";
						return t
							.setValue(this.pipelinePlugin.settings.imageApiKeyZhipuGlm)
							.onChange(async (v) => {
								this.pipelinePlugin.settings.imageApiKeyZhipuGlm = v;
								await this.pipelinePlugin.saveSettings();
							});
					});
			}

			if (preset === "gpt_image") {
				new Setting(imgEl)
					.setName("OpenAI · GPT Image API Key")
					.setDesc("与 Chat 的 Key 可不同；仅用于 https://api.openai.com/v1/images/generations。")
					.addText((t) => {
						t.inputEl.type = "password";
						return t
							.setValue(this.pipelinePlugin.settings.imageApiKeyGptImage)
							.onChange(async (v) => {
								this.pipelinePlugin.settings.imageApiKeyGptImage = v;
								await this.pipelinePlugin.saveSettings();
							});
					});
			}

			if (preset === "custom") {
				new Setting(imgEl)
					.setName("自定义作画 URL（完整）")
					.setDesc("须为 …/images/generations 或网关等价路径。")
					.addText((t) =>
						t
							.setPlaceholder("https://…/images/generations")
							.setValue(this.pipelinePlugin.settings.imageGenerationsUrl)
							.onChange(async (v) => {
								this.pipelinePlugin.settings.imageGenerationsUrl = v;
								await this.pipelinePlugin.saveSettings();
							}),
					);

				new Setting(imgEl)
					.setName("自定义：复用当前 LLM 的 API Key")
					.addToggle((tog) =>
						tog
							.setValue(
								this.pipelinePlugin.settings.useLlmApiKeyForImages,
							)
							.onChange(async (v) => {
								this.pipelinePlugin.settings.useLlmApiKeyForImages = v;
								await this.pipelinePlugin.saveSettings();
								this.display();
							}),
					);

				if (!this.pipelinePlugin.settings.useLlmApiKeyForImages) {
					new Setting(imgEl)
						.setName("自定义：独立作画 API Key")
						.addText((t) => {
							t.inputEl.type = "password";
							return t.setValue(this.pipelinePlugin.settings.imageApiKey).onChange(
								async (v) => {
									this.pipelinePlugin.settings.imageApiKey = v;
									await this.pipelinePlugin.saveSettings();
								},
							);
						});
				}
			}

			new Setting(imgEl)
				.setName("作图模型 model")
				.setDesc(
					"留空则使用内置默认（豆包 doubao-seedream、智谱 cogview-3-plus、GPT gpt-image-1）。",
				)
				.addText((t) =>
					t
						.setPlaceholder("可不填则用默认")
						.setValue(this.pipelinePlugin.settings.imageModel)
						.onChange(async (v) => {
							this.pipelinePlugin.settings.imageModel = v;
							await this.pipelinePlugin.saveSettings();
						}),
				);

			const addImgSizeRow = (
				name: string,
				desc: string,
				placeholder: string,
				get: () => string,
				set: (v: string) => void,
			) =>
				new Setting(imgEl).setName(name).setDesc(desc).addText((t) =>
					t
						.setPlaceholder(placeholder)
						.setValue(get())
						.onChange(async (v) => {
							set(v.trim());
							await this.pipelinePlugin.saveSettings();
						}),
				);

			imgEl.createEl("p", {
				text: "作图尺寸：分项。「豆包 · 火山 Seedream」总像素≥3 686 400；不足则自动偏大 WxH。「智谱/GPT」按需填写。小红书 HTTP 画布为备用项。",
				cls: "setting-item-description",
			});

			addImgSizeRow(
				"公众号 · 封面",
				"宽屏横幅。",
				"1792x1024",
				() => this.pipelinePlugin.settings.imageSizeWechatCover,
				(v) => {
					this.pipelinePlugin.settings.imageSizeWechatCover = v;
				},
			);
			addImgSizeRow(
				"公众号 · 正文配图",
				"文章内插图。",
				"1536x1024",
				() => this.pipelinePlugin.settings.imageSizeWechatIllustration,
				(v) => {
					this.pipelinePlugin.settings.imageSizeWechatIllustration = v;
				},
			);
			addImgSizeRow(
				"备用 · xhs_cover",
				"若使用 HTTP 生图场景。",
				"1024x1024",
				() => this.pipelinePlugin.settings.imageSizeXhsCover,
				(v) => {
					this.pipelinePlugin.settings.imageSizeXhsCover = v;
				},
			);
			addImgSizeRow(
				"备用 · xhs_body",
				"若使用 HTTP 生图场景。",
				"1024x1536",
				() => this.pipelinePlugin.settings.imageSizeXhsBody,
				(v) => {
					this.pipelinePlugin.settings.imageSizeXhsBody = v;
				},
			);
		});

		addFold(containerEl, "Moka 卡片 · 29 模板 × 8 配色（小红书 / 公众号）", true, (mokaEl) => {
			const s = this.pipelinePlugin.settings;
			const save = () => this.pipelinePlugin.saveSettings();
			const tplValues = orderedMokaTemplates();

			mokaEl.createEl("small", {
				text: "「图文卡片」：LLM 按 Moka 式结构产出 JSON → 插件用模板 + 调色板渲染 DOM → html-to-image 导出 PNG。Ribbon / 命令面板可分别选「小红书」或「公众号」；下方为两套独立默认（模板 + 配色）。工具栏按钮使用「默认平台」。",
			});
			mokaEl.createDiv();

			addStrEnumDropdown(
				mokaEl,
				"工具栏 / 未指定平台时的默认平台",
				"决定编辑器工具栏「Moka 图文」与命令「…默认平台…」走哪一套模板与配色。",
				MOKA_PLATFORM_OPTIONS,
				s.mokaCardsDefaultPlatform,
				(v) =>
					v === "xhs" ? "小红书" : "公众号",
				(v) => {
					s.mokaCardsDefaultPlatform = v;
				},
				async () => save(),
			);

			mokaEl.createEl("h3", { text: "小红书 · 拆卡气质" });
			mokaEl.createEl("p", {
				text: "共 29 种模板（经典、小红书热门、公众号垂直风格均可选），与公众号侧设置互不影响。",
				cls: "setting-item-description",
			});

			addStrEnumDropdown(
				mokaEl,
				"小红书 · 卡片模板",
				"保存值为英文 id（如 cream_soft），用于 JSON 与渲染。",
				tplValues,
				s.mokaCardTemplateXhs,
				(v) => tplDropdownLabel(v),
				(v) => {
					s.mokaCardTemplateXhs = v;
				},
				async () => save(),
			);

			addStrEnumDropdown(
				mokaEl,
				"小红书 · 配色",
				"珊瑚 / 抹茶 / 水墨等 8 套；与模板独立组合。",
				MOKA_PALETTE_IDS,
				s.mokaCardPaletteXhs,
				(v) => paletteDropdownLabel(v),
				(v) => {
					s.mokaCardPaletteXhs = v;
				},
				async () => save(),
			);

			mokaEl.createEl("h3", { text: "公众号 · 拆卡气质" });
			mokaEl.createEl("p", {
				text: "语气与版式提示按公众号侧独立配置；同样 29 模板 + 8 配色。",
				cls: "setting-item-description",
			});

			addStrEnumDropdown(
				mokaEl,
				"公众号 · 卡片模板",
				"保存值为英文 id；垂直行业风与经典风可混选。",
				tplValues,
				s.mokaCardTemplateWechat,
				(v) => tplDropdownLabel(v),
				(v) => {
					s.mokaCardTemplateWechat = v;
				},
				async () => save(),
			);

			addStrEnumDropdown(
				mokaEl,
				"公众号 · 配色",
				"8 套配色与小红书侧独立。",
				MOKA_PALETTE_IDS,
				s.mokaCardPaletteWechat,
				(v) => paletteDropdownLabel(v),
				(v) => {
					s.mokaCardPaletteWechat = v;
				},
				async () => save(),
			);

			mokaEl.createEl("h3", { text: "尺寸与页数" });

			new Setting(mokaEl)
				.setName("卡片逻辑尺寸 WxH")
				.setDesc("留空默认 1242×1660（小红书竖版）。示例：1080x1440")
				.addText((t) =>
					t
						.setPlaceholder("1242x1660")
						.setValue(s.mokaCardSizeWxH)
						.onChange(async (v) => {
							s.mokaCardSizeWxH = v.trim();
							await save();
						}),
				);

			new Setting(mokaEl)
				.setName("导出模糊度（devicePixelRatio）")
				.setDesc("2–4；越大 PNG 越清晰、体积越大。")
				.addDropdown((dd) => {
					for (const r of [2, 3, 4] as const) {
						dd.addOption(String(r), `${r}x`);
					}
					return dd
						.setValue(String(s.mokaCardExportPixelRatio))
						.onChange(async (v) => {
							const n = Number(v);
							if (n === 2 || n === 3 || n === 4) {
								s.mokaCardExportPixelRatio =
									n as MokaCardExportPixelRatio;
								await save();
							}
						});
				});

			new Setting(mokaEl)
				.setName("目标页数（4–10）")
				.setDesc("拆分提示会约束 cover + 若干 content + end。")
				.addText((t) =>
					t
						.setValue(String(s.mokaCardSlideCount))
						.onChange(async (v) => {
							const n = Number.parseInt(v, 10);
							if (!Number.isFinite(n)) return;
							s.mokaCardSlideCount = Math.min(10, Math.max(4, n));
							await save();
						}),
				);
		});

		addFold(containerEl, "安全与调试", false, (secEl) => {
			new Setting(secEl)
				.setName("覆盖已有阶段文件前确认（推荐开启）")
				.addToggle((toggle) =>
					toggle
						.setValue(this.pipelinePlugin.settings.confirmBeforeOverwrite)
						.onChange(async (v) => {
							this.pipelinePlugin.settings.confirmBeforeOverwrite = v;
							await this.pipelinePlugin.saveSettings();
						}),
				);

			new Setting(secEl)
				.setName("保留历史版本（会自动重命名旧文件）")
				.addToggle((toggle) =>
					toggle
						.setValue(this.pipelinePlugin.settings.keepHistoryVersions)
						.onChange(async (v) => {
							this.pipelinePlugin.settings.keepHistoryVersions = v;
							await this.pipelinePlugin.saveSettings();
						}),
				);

			new Setting(secEl)
				.setName("Debug 日志（输出到控制台）")
				.addToggle((toggle) =>
					toggle
						.setValue(this.pipelinePlugin.settings.enableDebugLog)
						.onChange(async (v) => {
							this.pipelinePlugin.settings.enableDebugLog = v;
							await this.pipelinePlugin.saveSettings();
						}),
				);
		});
	}
}

function addPromptArea(
	containerEl: HTMLElement,
	opts: {
		title: string;
		value: string;
		heightPx: number;
		onChange: (v: string) => Promise<void>;
	},
): void {
	new Setting(containerEl).setName(opts.title).addTextArea((area) => {
		area.inputEl.style.width = "100%";
		area.inputEl.style.height = `${opts.heightPx}px`;
		area.setValue(opts.value).onChange(async (v) => await opts.onChange(v));
	});
}
