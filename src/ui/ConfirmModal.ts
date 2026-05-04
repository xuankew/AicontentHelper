import { App, Modal, Setting } from "obsidian";

export function confirmOverwrite(app: App, message: string): Promise<boolean> {
	return new Promise((resolve) => {
		let settled = false;
		const settle = (v: boolean) => {
			if (settled) return;
			settled = true;
			resolve(v);
		};

		const modal = new Modal(app);
		modal.titleEl.setText("确认覆盖");
		modal.contentEl.createEl("p", { text: message });

		new Setting(modal.contentEl)
			.addButton((btn) =>
				btn.setButtonText("取消").onClick(() => {
					modal.close();
				}),
			)
			.addButton((btn) =>
				btn.setButtonText("覆盖").setCta().onClick(() => {
					settle(true);
					modal.close();
				}),
			);

		modal.onClose = () => settle(false);
		modal.open();
	});
}

export function confirmYesNo(
	app: App,
	params: {
		title: string;
		message: string;
		okText: string;
		cancelText: string;
	},
): Promise<boolean> {
	return new Promise((resolve) => {
		let settled = false;
		const settle = (v: boolean) => {
			if (settled) return;
			settled = true;
			resolve(v);
		};

		const modal = new Modal(app);
		modal.titleEl.setText(params.title);
		modal.contentEl.createEl("p", { text: params.message });

		new Setting(modal.contentEl)
			.addButton((btn) =>
				btn.setButtonText(params.cancelText).onClick(() => modal.close()),
			)
			.addButton((btn) =>
				btn.setButtonText(params.okText).setCta().onClick(() => {
					settle(true);
					modal.close();
				}),
			);

		modal.onClose = () => settle(false);
		modal.open();
	});
}
