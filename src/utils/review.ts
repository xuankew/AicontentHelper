export function splitReviewOutput(raw: string): { final: string; report: string } {
	const m1 = raw.indexOf("===FINAL_ARTICLE===");
	const m2 = raw.indexOf("===REVIEW_REPORT===");
	if (m1 === -1 || m2 === -1 || m2 <= m1) {
		throw new Error("审稿返回格式异常，未写入文件，请重试。");
	}
	const afterFinal = m1 + "===FINAL_ARTICLE===".length;
	const final = raw.slice(afterFinal, m2).trim();
	const afterReport = m2 + "===REVIEW_REPORT===".length;
	const report = raw.slice(afterReport).trim();
	if (final.length === 0 || report.length === 0) {
		throw new Error("审稿返回格式异常，未写入文件，请重试。");
	}
	return { final, report };
}
