import { Modal, type App } from "obsidian";
import { useEffect, useRef, useState } from "react";

/**
 * Hosts React content in a native Obsidian Modal while `open` is true, so it
 * inherits Obsidian's theming, focus management, Escape handling,
 * click-outside, and animations. Returns the modal (portal into its
 * `contentEl`), or null while the modal is closed.
 */
export function useObsidianModal({
	app,
	open,
	onClose,
	title,
	className,
}: {
	app: App;
	open: boolean;
	onClose: () => void;
	title: string;
	className?: string;
}): Modal | null {
	const [shownModal, setShownModal] = useState<Modal | null>(null);

	// Keep the latest onClose without re-creating the modal on every render.
	const onCloseRef = useRef(onClose);
	onCloseRef.current = onClose;

	useEffect(() => {
		if (!open) return;
		const modal = new Modal(app);
		if (className) modal.modalEl.addClass(className);
		modal.titleEl.setText(title);
		// Obsidian closes the modal itself on Escape, click-outside and the
		// close button. The cleanup must not close it a second time then,
		// or onClose would run twice.
		let closedByObsidian = false;
		modal.onClose = () => {
			closedByObsidian = true;
			setShownModal(null);
			onCloseRef.current();
		};
		modal.open();
		setShownModal(modal);
		return () => {
			if (!closedByObsidian) modal.close();
		};
	}, [open, app, title, className]);

	return open ? shownModal : null;
}
