import type { GzhWritingPipelineSettings, MokaCardPlatform } from "../types";
import {
	MOKA_CARD_TEMPLATE_HINTS,
	MOKA_CARD_TEMPLATE_LABELS_ZH,
	MOKA_PALETTE_HINTS,
	MOKA_PALETTE_LABELS_ZH,
	type MokaCardTemplateId,
	type MokaPaletteId,
} from "../settings/mokaCardPresets";
import { PLUGIN_PALETTE_UPSTREAM_THEME } from "./mokaCards/mokaUpstreamPalettes";
import { upstreamSplitForPluginTemplate } from "./mokaCards/mokaUpstreamSplitIds";

function templateLine(t: MokaCardTemplateId): string {
	const zh = MOKA_CARD_TEMPLATE_LABELS_ZH[t];
	const hint = MOKA_CARD_TEMPLATE_HINTS[t];
	return `所选模板「${zh}」（id=${t}）：${hint}。卡组视觉须与该气质一致（字体层级、留白、装饰密度）。`;
}

function paletteLine(p: MokaPaletteId): string {
	const zh = MOKA_PALETTE_LABELS_ZH[p];
	const hint = MOKA_PALETTE_HINTS[p];
	return `配色 palette「${zh}」（id=${p}）：${hint}；底色、正文与点缀色须层次分明、不脏不杂。`;
}

function pickTplPal(
	settings: GzhWritingPipelineSettings,
	platform: MokaCardPlatform,
): { tpl: MokaCardTemplateId; pal: MokaPaletteId } {
	return platform === "xhs"
		? { tpl: settings.mokaCardTemplateXhs, pal: settings.mokaCardPaletteXhs }
		: { tpl: settings.mokaCardTemplateWechat, pal: settings.mokaCardPaletteWechat };
}

export function nativeMokaSplitPrompt(
	settings: GzhWritingPipelineSettings,
	platform: MokaCardPlatform,
	articleMarkdown: string,
): string {
	const { tpl, pal } = pickTplPal(settings, platform);
	const configuredTarget = settings.mokaCardSlideCount || 6;
	const target =
		platform === "xhs"
			? clampInt(configuredTarget || 8, 7, 9)
			: clampInt(configuredTarget, 4, 10);
	const xhsContentPages = Math.max(5, Math.min(7, target - 2));

	const platformRules =
		platform === "xhs"
			? buildXhsFamilyEducationRules(target, xhsContentPages)
			: `平台：微信公众号（多图资产包）。语气专业、清晰、克制；少用网络梗；结构信息优先。\n首张 cover，中段 content，末张 end。`;

	return `你是「知识卡片 / 图文笔记」编辑。把文章拆成竖版多页「信息卡 JSON」，用于本地排版导出 PNG（不是画图 API）。

${platformRules}

## 硬性数量
默认共 ${target} 页（1 cover + ${Math.max(1, target - 2)} content + 1 end），${platform === "xhs" ? "小红书内容页须为 5–7 页。" : "最少 4 页最多 10 页。若信息量不足也不得少于 4 页（可拆分要点）。"}

## 渲染对齐（写作参考）
所选 template 会与 Moka 官网分页内核映射为拆分风格「${upstreamSplitForPluginTemplate(tpl)}」（仅作文风/版面节奏参考）；主色accent约 ${PLUGIN_PALETTE_UPSTREAM_THEME[pal].accentHex}。
JSON 顶层仍必须写插件枚举：platform、template (${tpl})、palette (${pal})。

${templateLine(tpl)}
${paletteLine(pal)}

## 单页字数上限（硬性）
cover：title≤18字、subtitle≤28字；
content：heading≤22字；text≤120字（可换行语义用 \\n）；extra≤40字（列表/小结，可空字符串）；
end：cta≤20字；sub≤36字；tags 数组 3–6 个短标签。

## JSON 顶层字段
必须包含：platform (${platform})、template (${tpl})、palette (${pal})，以及 slides：数组 ordered。

## slides 每项（三选一.kind）
• { "kind":"cover","emoji":"…","title":"…","subtitle":"…" }
• { "kind":"content","heading":"…","text":"…","extra":"" | "要点…" }
• { "kind":"end","cta":"…","sub":"…","tags":["#话题",…] }

## 文章 Markdown
${articleMarkdown.slice(0, 14000)}

仅输出单个 JSON（不要 Markdown 围栏、不要解释）。
`;
}

function buildXhsFamilyEducationRules(target: number, contentPages: number): string {
	return `平台：小红书。主题通常来自公众号长文，但必须改写成「图文卡片」，不是文章摘要。

## 角色
你是一位家庭教育创作者，同时是两个孩子的爸爸：
- 12岁女儿
- 9岁儿子

你的风格：真实、克制、有逻辑、有方法、不说教、不贩卖焦虑。

## 小红书目标
生成内容必须满足：
1. 强共鸣：让父母觉得“就是我家”
2. 强场景：有具体画面
3. 强节奏：短句、易扫读
4. 强方法：可以立即执行
5. 强传播：有可截图的金句

## 版本策略
先在脑中生成 3 个方向并比较：
1. 情绪冲突强版本
2. 方法清晰版本
3. 轻松共鸣版本

然后只选择「最容易在小红书被收藏/转发」的一套，输出为 slides JSON。
不要把 3 套都输出；当前渲染链路只会渲染一套 deck，输出多套会互相覆盖或无法解析。

## 页面结构
总页数：${target} 页。
首张必须是 cover。
中段必须是 ${contentPages} 张 content。
末尾必须是 1 张 end。

内容页顺序必须覆盖：
① 冲突场景（崩溃现场）
② 情绪放大（循环/无力）
③ 认知反转（问题不在孩子）
④ 原因解释（简单）
⑤ 方法（步骤化）
⑥ 行动引导

## 单页写法
- cover：title/subtitle 形成 2 行封面标题；要强冲突 / 强场景 / 强情绪，不能太“正确”
- content：每页 4–6 行；每行尽量 ≤12 个汉字；用 \\n 换行
- end：一句总结 + 一句行动 + 一点互动
- 多用短句，避免长句
- 多用对比：我 vs 孩子
- 多用重复强化情绪
- 每页必须“可截图”
- 不要写成文章，要写成卡片

## 风格限制
不要：说教、空话、专家语气、长解释。
要：像一个真实爸爸在讲，有点情绪但不过度，有反思，有方法。`;
}

function clampInt(n: number, lo: number, hi: number): number {
	return Math.max(lo, Math.min(hi, Math.floor(Number.isFinite(n) ? n : lo)));
}
