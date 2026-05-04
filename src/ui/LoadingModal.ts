import { App, Modal } from "obsidian";

export type WorkingModalOptions = {
	/** 弹窗标题，建议与当前步骤名称一致 */
	title?: string;
	/** 正文说明：当前在做哪件事、在读/写哪个文件 */
	message: string;
};

export class WorkingModal {
	private modal: Modal;

	private paragraphContainer: HTMLElement;

	constructor(app: App, messageOrOptions: string | WorkingModalOptions) {
		this.modal = new Modal(app);

		const opts: WorkingModalOptions =
			typeof messageOrOptions === "string"
				? { message: messageOrOptions }
				: messageOrOptions;

		this.modal.titleEl.setText(opts.title ?? "处理中");
		this.paragraphContainer = this.modal.contentEl.createDiv();
		this.renderMessage(opts.message);
		this.modal.open();
	}

	updateMessage(opts: Partial<WorkingModalOptions>): void {
		if (opts.title !== undefined) {
			this.modal.titleEl.setText(opts.title);
		}
		if (opts.message !== undefined) {
			this.paragraphContainer.empty();
			this.renderMessage(opts.message);
		}
	}

	private renderMessage(message: string): void {
		const lines = message.trim().split("\n").filter(Boolean);
		for (const line of lines) {
			this.paragraphContainer.createEl("p", { text: line });
		}
	}

	close(): void {
		this.modal.close();
	}
}
