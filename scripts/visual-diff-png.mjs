#!/usr/bin/env node
/**
 * Compare two PNGs of identical dimensions (e.g. Moka web export vs Obsidian plugin export).
 * Usage: npm run visual-diff -- a.png b.png [thresholdPixels]
 */

import fs from "node:fs";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";

function loadPng(path) {
	const buf = fs.readFileSync(path);
	return PNG.sync.read(buf);
}

const aPath = process.argv[2];
const bPath = process.argv[3];
const maxDiffBudget = Number(process.argv[4] ?? "500");

if (!aPath || !bPath) {
	console.error(
		"用法: npm run visual-diff -- <baseline.png> <candidate.png> [maxDiffBudget]",
	);
	process.exit(2);
}

const imgA = loadPng(aPath);
const imgB = loadPng(bPath);

if (imgA.width !== imgB.width || imgA.height !== imgB.height) {
	console.error(
		`尺寸不一致: ${imgA.width}x${imgA.height} vs ${imgB.width}x${imgB.height}`,
	);
	process.exit(1);
}

const { width, height } = imgA;
const diff = new PNG({ width, height });

const numDiffPixels = pixelmatch(
	imgA.data,
	imgB.data,
	diff.data,
	width,
	height,
	{ threshold: 0.1, includeAA: false },
);

const out = `${aPath}-diff-${Date.now()}.png`;
fs.writeFileSync(out, PNG.sync.write(diff));

console.info("visual-diff", {
	width,
	height,
	diffPixels: numDiffPixels,
	totalPixels: width * height,
	ratio: (numDiffPixels / (width * height)).toFixed(6),
	diffPng: out,
	maxAllowed: maxDiffBudget,
});

process.exit(numDiffPixels <= maxDiffBudget ? 0 : 1);
