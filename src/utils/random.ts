export function randomSixDigits(): string {
	return String(Math.floor(100000 + Math.random() * 900000));
}

export function createArticleId(): string {
	return `art-${Date.now()}-${randomSixDigits()}`;
}
