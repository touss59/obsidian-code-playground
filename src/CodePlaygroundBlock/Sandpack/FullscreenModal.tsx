import {
	SandpackThemeProvider,
	useSandpack,
	type CodeEditorRef,
} from "@codesandbox/sandpack-react";
import {
	useMemo,
	useRef,
	useState,
	type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import type { Scope } from "obsidian";
import { useAppContext } from "CodePlaygroundBlock/AppContextProvider";
import { ManageFilesModal } from "CodePlaygroundBlock/ManageFilesModal";
import { rootStyle } from "CodePlaygroundBlock/rootStyle";
import { useObsidianModal } from "CodePlaygroundBlock/useObsidianModal";
import { ConsolePane } from "CodePlaygroundBlock/Sandpack/ConsolePane";
import { formatEditor } from "CodePlaygroundBlock/Sandpack/editorExtensions";
import { PlaygroundCodeEditor } from "CodePlaygroundBlock/Sandpack/PlaygroundCodeEditor";
import { PreviewPane } from "CodePlaygroundBlock/Sandpack/PreviewPane";
import { useEditorColumnResize } from "CodePlaygroundBlock/Sandpack/useEditorColumnResize";
import type { PreviewLoadState } from "CodePlaygroundBlock/Sandpack/usePreviewLoadState";
import { resolveTheme } from "themes";

const HIDDEN: CSSProperties = { display: "none" };
const PANE: CSSProperties = {
	flex: "1 1 0",
	minWidth: 0,
	minHeight: 0,
	position: "relative",
};
const EDITOR: CSSProperties = { flex: "1 1 auto", minHeight: 0, height: "100%" };

type Props = {
	open: boolean;
	onClose: () => void;
	previewLoadState: PreviewLoadState;
	isOnline: boolean;
};

/**
 * A large editor and preview for the block, in an Obsidian Modal. It shares
 * the block's Sandpack state, so edits save and show in the block too.
 */
export function FullscreenModal({
	open,
	onClose,
	previewLoadState,
	isOnline,
}: Props) {
	const { value: global } = useAppContext();
	const modal = useObsidianModal({
		app: global.ObsidianApp,
		open,
		onClose,
		title: "Code playground",
		className: "cp-fullscreen-modal",
	});
	// The modal's own saved width: a drag here must not resize the block.
	const columnResize = useEditorColumnResize("fullscreenEditorWidth");

	if (!modal) return null;

	return createPortal(
		<FullscreenContent
			previewLoadState={previewLoadState}
			isOnline={isOnline}
			columnResize={columnResize}
			modalScope={modal.scope}
		/>,
		modal.contentEl,
	);
}

function FullscreenContent({
	previewLoadState,
	isOnline,
	columnResize,
	modalScope,
}: Pick<Props, "previewLoadState" | "isOnline"> & {
	columnResize: ReturnType<typeof useEditorColumnResize>;
	modalScope: Scope;
}) {
	const { value: global } = useAppContext();
	const { sandpack } = useSandpack();
	const { showPreview, showConsole: consoleEnabled } = global.config;
	const hasPane = showPreview || consoleEnabled;
	// The portal is outside the block's theme element, so apply it again.
	const theme = useMemo(
		() => resolveTheme(global.config.theme),
		[global.config.theme],
	);

	const [consoleShown, setConsoleShown] = useState(
		!showPreview && consoleEnabled,
	);
	const [showManage, setShowManage] = useState(false);
	const editorRef = useRef<CodeEditorRef>(null);

	// The block's preview also runs while the modal is open. Show the logs of
	// this modal's preview only, so each log shows once.
	const [clientId, setClientId] = useState<string>();

	const format = () => {
		const view = editorRef.current?.getCodemirror();
		if (view) {
			void formatEditor(view, {
				path: sandpack.activeFile,
				files: sandpack.files,
			});
		}
	};

	return (
		<SandpackThemeProvider
			theme={theme}
			className="cp-root cp-fullscreen"
			style={rootStyle(global.config)}
		>
			<div className="cp-fullscreen-toolbar">
				<button onClick={format} title="Format the current file (Shift+Alt+F)">
					Format
				</button>
				<button onClick={() => setShowManage(true)}>Manage files</button>
			</div>
			<div
				className="cp-fullscreen-body"
				style={
					columnResize.editorWidth === "auto"
						? undefined
						: ({
								"--cp-fullscreen-editor": `${columnResize.editorWidth}px`,
							} as CSSProperties)
				}
			>
				<div className="cp-fullscreen-editor">
					<PlaygroundCodeEditor
						ref={editorRef}
						style={EDITOR}
						escapeScope={modalScope}
					/>
				</div>
				{hasPane && (
					<div
						className="cp-resizer"
						title="Drag to resize. Double-click to reset."
						onPointerDown={columnResize.startResize}
						onDoubleClick={columnResize.reset}
					/>
				)}
				{showPreview && (
					<PreviewPane
						onClientIdChange={setClientId}
						style={consoleShown ? HIDDEN : PANE}
						resizing={columnResize.dragging}
						previewLoadState={previewLoadState}
						isOnline={isOnline}
						onShowConsole={
							consoleEnabled ? () => setConsoleShown(true) : undefined
						}
					/>
				)}
				{consoleEnabled && (!showPreview || clientId) && (
					<ConsolePane
						style={consoleShown ? PANE : HIDDEN}
						clientId={clientId}
						onShowPreview={
							showPreview ? () => setConsoleShown(false) : undefined
						}
					/>
				)}
			</div>
			<ManageFilesModal
				open={showManage}
				onClose={() => setShowManage(false)}
			/>
		</SandpackThemeProvider>
	);
}
