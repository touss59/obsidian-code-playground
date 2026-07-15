import { App, Modal, Setting } from "obsidian";

type ConfirmModalOptions = {
	title: string;
	message: string;
	/** Optional list of affected items, rendered as a scrollable list. */
	items?: string[];
	/** Label of the destructive, warning-styled confirm button. */
	confirmText: string;
	onConfirm: () => void;
};

export class ConfirmModal extends Modal {
	constructor(
		app: App,
		private options: ConfirmModalOptions,
	) {
		super(app);
	}

	onOpen(): void {
		const { title, message, items, confirmText, onConfirm } = this.options;
		this.titleEl.setText(title);
		this.contentEl.createEl("p", { text: message });
		if (items && items.length > 0) {
			const list = this.contentEl.createEl("ul", {
				cls: "cp-confirm-list",
			});
			for (const item of items) {
				list.createEl("li", { text: item });
			}
		}
		new Setting(this.contentEl)
			.addButton((btn) =>
				btn.setButtonText("Cancel").onClick(() => this.close()),
			)
			.addButton((btn) =>
				btn
					.setButtonText(confirmText)
					.setWarning()
					.onClick(() => {
						this.close();
						onConfirm();
					}),
			);
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
