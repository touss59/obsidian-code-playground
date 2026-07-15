import { useSandpack } from "@codesandbox/sandpack-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Modal, Notice } from "obsidian";
import { useAppContext } from "CodePlaygroundBlock/AppContextProvider";
import { FILE_EXTENSION_RE, isValidPlaygroundFilePath } from "validators";

type Props = {
	open: boolean;
	onClose: () => void;
};

export function ManageFilesModal({ open, onClose }: Props) {
	const { sandpack } = useSandpack();
	const { value: global } = useAppContext();
	const app = global.ObsidianApp;
	const [newFilePath, setNewFilePath] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [pendingDelete, setPendingDelete] = useState<string | null>(null);
	const [containerEl, setContainerEl] = useState<HTMLElement | null>(null);

	// Keep the latest onClose without re-creating the modal on every render.
	const onCloseRef = useRef(onClose);
	onCloseRef.current = onClose;

	// Host the React contents inside a native Obsidian Modal so we inherit its
	// theming, focus management, Escape handling, click-outside, and animations.
	useEffect(() => {
		if (!open) return;
		const modal = new Modal(app);
		modal.titleEl.setText("Manage files");
		modal.onClose = () => {
			setContainerEl(null);
			onCloseRef.current();
		};
		modal.open();
		setContainerEl(modal.contentEl);
		return () => {
			modal.close();
		};
	}, [open, app]);

	useEffect(() => {
		if (!open) {
			setNewFilePath("");
			setError(null);
			setPendingDelete(null);
		}
	}, [open]);

	if (!open || !containerEl) return null;

	const allPaths = Object.keys(sandpack.files);
	const visibleSet = new Set(sandpack.visibleFiles);

	const handleCreate = () => {
		const trimmed = newFilePath.trim();
		if (!trimmed) {
			setError("File path is required");
			return;
		}
		const normalized = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
		if (!FILE_EXTENSION_RE.test(normalized)) {
			setError("File must have an extension (e.g. .js, .ts, .css)");
			return;
		}
		if (!isValidPlaygroundFilePath(normalized)) {
			setError(
				'File path must not contain backslashes or empty, "." or ".." segments',
			);
			return;
		}
		if (sandpack.files[normalized]) {
			setError("A file with this path already exists");
			return;
		}
		sandpack.addFile(normalized, "");
		sandpack.openFile(normalized);
		setNewFilePath("");
		setError(null);
	};

	const handleDelete = (path: string) => {
		const isActive = sandpack.activeFile === path;
		sandpack.deleteFile(path);
		setPendingDelete(null);
		if (isActive) {
			new Notice(
				"File deleted. Bundler may show an error if this was your entry file.",
			);
		}
	};

	return createPortal(
		<div className="cp-manage-files">
			<div className="cp-manage-add-row">
				<input
					type="text"
					className="cp-manage-input"
					aria-label="New file path"
					placeholder="/path/to/file.js"
					value={newFilePath}
					onChange={(e) => {
						setNewFilePath(e.target.value);
						if (error) setError(null);
					}}
					onKeyDown={(e) => {
						if (e.key === "Enter") handleCreate();
					}}
				/>
				<button onClick={handleCreate}>+ Create</button>
			</div>
			{error && <div className="cp-manage-error">{error}</div>}

			<div className="cp-manage-list">
				{allPaths.map((path) => {
					const isHidden = !visibleSet.has(path);
					return (
						<div
							key={path}
							className={
								isHidden
									? "cp-manage-item cp-manage-item-hidden"
									: "cp-manage-item"
							}
						>
							<span className="cp-manage-path">
								{path}
								{isHidden && " (hidden)"}
							</span>
							{pendingDelete === path ? (
								<>
									<span className="cp-manage-confirm">
										Delete file?
									</span>
									<button onClick={() => handleDelete(path)}>
										Confirm
									</button>
									<button
										onClick={() => setPendingDelete(null)}
									>
										Cancel
									</button>
								</>
							) : (
								<>
									{isHidden ? (
										<button
											onClick={() =>
												sandpack.openFile(path)
											}
										>
											Show
										</button>
									) : (
										<button
											onClick={() =>
												sandpack.closeFile(path)
											}
										>
											Hide
										</button>
									)}
									<button
										onClick={() => setPendingDelete(path)}
									>
										Delete
									</button>
								</>
							)}
						</div>
					);
				})}
			</div>
		</div>,
		containerEl,
	);
}
