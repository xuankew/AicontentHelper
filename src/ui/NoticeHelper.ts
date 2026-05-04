import { Notice } from "obsidian";

export function showSuccessNotice(message: string): void {
	new Notice(message, 5000);
}

export function showErrorNotice(message: string): void {
	new Notice(message, 12000);
}
