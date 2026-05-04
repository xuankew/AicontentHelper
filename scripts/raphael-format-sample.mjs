#!/usr/bin/env node
/**
 * Renders `scripts/raphael-sample.md` through the plugin's RaphaelWechatFormatter
 * and writes the resulting HTML to `scripts/raphael-sample.html`. Use this to
 * eyeball the public-account formatter output without booting Obsidian.
 *
 * Usage:
 *   npm run raphael-sample
 *   open scripts/raphael-sample.html
 */
import esbuild from "esbuild";
import { JSDOM } from "jsdom";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

const sampleMdPath = path.join(__dirname, "raphael-sample.md");
const outputHtmlPath = path.join(__dirname, "raphael-sample.html");
const tmpBundlePath = path.join(__dirname, ".raphael-sample.bundle.cjs");

const dom = new JSDOM("<!doctype html><html><body></body></html>");
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.DOMParser = dom.window.DOMParser;
globalThis.Node = dom.window.Node;
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.Element = dom.window.Element;

const themeId = process.env.RAPHAEL_THEME ?? "wechat";

const md = await fs
	.readFile(sampleMdPath, "utf8")
	.catch(() =>
		[
			"# 演示标题",
			"",
			"这是一段**加粗**说明，含有*斜体*与 [链接](https://example.com)。",
			"",
			"## 列表",
			"",
			"- 列项一",
			"- 列项二",
			"  - 嵌套列项",
			"",
			"1. 顺序列项一",
			"2. 顺序列项二",
			"",
			"## 引用",
			"",
			"> 这是一段引用，用于检查 blockquote 的内联样式。",
			"",
			"## 代码",
			"",
			"```ts",
			"function add(a: number, b: number): number {",
			"  return a + b;",
			"}",
			"```",
			"",
			"## 配图",
			"",
			"![示例图](https://example.com/sample.png)",
			"",
		].join("\n"),
	);

await esbuild.build({
	entryPoints: [
		path.join(projectRoot, "src/services/RaphaelWechatFormatter.ts"),
	],
	bundle: true,
	format: "cjs",
	platform: "node",
	target: "es2018",
	outfile: tmpBundlePath,
	logLevel: "warning",
});

const mod = await import(pathToFileURL(tmpBundlePath).href);
const { formatMarkdownForWechat } = mod;

const result = formatMarkdownForWechat(md, { themeId });

const wrapper =
	`<!doctype html>` +
	`<html><head><meta charset="utf-8"><title>Raphael Wechat Sample · ${result.themeName}</title></head>` +
	`<body style="margin:0;padding:24px;background:#eef0f3;display:flex;justify-content:center;">` +
	`<div style="max-width:720px;width:100%;background:#fff;box-shadow:0 8px 24px rgba(0,0,0,0.08);border-radius:8px;padding:24px;">` +
	result.html +
	`</div></body></html>`;

await fs.writeFile(outputHtmlPath, wrapper, "utf8");
await fs.unlink(tmpBundlePath).catch(() => undefined);

console.log(
	`[raphael-sample] theme=${result.themeId} (${result.themeName})`,
);
console.log(
	`[raphael-sample] html length = ${result.html.length} chars`,
);
console.log(`[raphael-sample] wrote ${path.relative(projectRoot, outputHtmlPath)}`);
