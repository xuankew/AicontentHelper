/**
 * 公众号封面走 HTTP 生图或简易模板；正文配图优先使用终稿中的 `gzh-figure://` 伪链接或 \`\`\`gzh-figure\`\`\` 占位，
 * 发布时按文中画面描写直连 HTTP 生图；若无占位则仍用下方 JSON 规划。
 */
import type { GzhWritingPipelineSettings } from "../types";

export function coverWorkflowUserPrompt(
	_settings: GzhWritingPipelineSettings,
	finalMd: string,
): string {
	return `你是「公众号封面」视觉主编。请基于文章终稿产出 *单张* 横幅封面图的英文生图 prompt（适配标准文生图 API）。

## 终稿 Markdown
${finalMd.slice(0, 12000)}

## 画面要求（自然写入英文 prompt，不要使用 URL）
• 宽幅、适合推文首图构图；可读性强的主体与留白  
• 与文章主旨一致的象征 / 隐喻 / 场景之一即可，避免花哨叠字堆砌  
• 若需要文字，只允许少量主标题占位，避免密集正文

## 输出（只输出一个 YAML 围栏，不要有其他解释）
\`\`\`yaml
image_prompt: |-
  <完整英文图像提示词>
notes_zh: <一两句构图说明（中文）>
\`\`\`
`;
}

/**
 * 简易封面：用 LLM 把文章标题压缩为 ≤10 字的醒目封面主标题 + 副标题（≤30字）。
 * 参考公众号爆款封面：主标题要有「悬念感 / 痛点感」，副标题补充背景。
 */
export function shortCoverTitlePrompt(articleTitle: string, firstParagraph: string): string {
	return `你是公众号封面文案专家。请根据以下信息生成封面文案。

文章标题：${articleTitle}
文章开头：${firstParagraph.slice(0, 300)}

要求：
1. 主标题：≤10 个汉字（不含标点），能让人一眼想点进去，用「痛点 / 疑问 / 数字 / 反常识」手法，不要加破折号
2. 副标题：≤28 个汉字，补充主标题背后的背景或利益点，可以稍微完整一点
3. 禁止废话："这篇文章讲的是…" 等套话

只输出 JSON，不要其他内容：
{"title":"...","subtitle":"..."}`;
}

/** @deprecated unused param kept for compat with old call sites */
export function articleIllustrationsUserPrompt(
	_settings: GzhWritingPipelineSettings,
	articleMarkdown: string,
): string {
	return articleIllustrationsUserPromptPlain(articleMarkdown);
}

export function articleIllustrationsUserPromptPlain(
	articleMarkdown: string,
): string {
	return `你是文章配图编辑。只有当终稿**没有任何**形如 \`gzh-figure://\` 或 \`\`\`gzh-figure\`\`\` 的配图占位时使用本流程。

阅读终稿，规划**至少 1 张、至多 3 张**「正文插图」，每张须插在指定小节之后，不要全部堆在文末。

## 终稿
${articleMarkdown.slice(0, 14000)}

## 输出规则
只输出 JSON（不要 markdown 代码围栏），items 数组**长度 1–3**。结构：
{
  "outline_md": "# Illustration plan\\n...",
  "items": [
    {
      "file_base": "01-short-slug",
      "caption_zh": "中文图注",
      "prompt_en": "English image generation prompt",
      "section_after_zh": "该图应插在哪个 ## 小节标题文字之后（完整复制标题文字，不含 ## 号）"
    }
  ]
}
要求：
- file_base 用两位数字前缀，如 01-scene；
- prompt_en 为英文生图指令，单行；
- section_after_zh 为小节标题原文，无则填空字符串；
`;
}
