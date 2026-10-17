import { SandpackLayout } from "@codesandbox/sandpack-react";
import { useState, type CSSProperties } from "react";
import { useAppContext } from "CodePlaygroundBlock/AppContextProvider";
import { useCodeSaver } from "CodePlaygroundBlock/useCodeSaver";
import { useFilesVisibilityOn } from "CodePlaygroundBlock/useFilesVisibilityOn";
import {
	usePreviewLoadState,
	type PreviewLoadState,
} from "CodePlaygroundBlock/Sandpack/usePreviewLoadState";
import { SandpackEditorWrapper } from "CodePlaygroundBlock/Sandpack/SandpackEditorWrapper";
import { useEditorColumnResize } from "CodePlaygroundBlock/Sandpack/useEditorColumnResize";
import { PreviewPane } from "CodePlaygroundBlock/Sandpack/PreviewPane";
import { ConsolePane } from "CodePlaygroundBlock/Sandpack/ConsolePane";
import { usePaneSizing } from "CodePlaygroundBlock/Sandpack/usePaneSizing";

const HIDDEN: CSSProperties = { display: "none" };

export function SandpackWrapper() {
	useCodeSaver();
	useFilesVisibilityOn();
	const { previewLoadState, isOnline } = usePreviewLoadState();

	return (
		<SandpackContent
			previewLoadState={previewLoadState}
			isOnline={isOnline}
		/>
	);
}

function SandpackContent({
	previewLoadState,
	isOnline,
}: {
	previewLoadState: PreviewLoadState;
	isOnline: boolean;
}) {
	const { value: global } = useAppContext();
	const { showEditor, showPreview, showConsole: showConsoleButton } =
		global.config;
	const vertical = global.config.layout === "vertical";

	const [showConsole, setShowConsole] = useState(
		!showPreview && showConsoleButton,
	);
	const [expanded, setExpanded] = useState(false);
	const resize = useEditorColumnResize();
	const { editorMinHeight, paneStyle } = usePaneSizing({
		expanded,
		consoleShown: showConsole,
	});
	const showResizer = !vertical && (showPreview || showConsoleButton);

	return (
		<SandpackLayout className={vertical ? "cp-layout-vertical" : undefined}>
			{showEditor && (
				<>
					<SandpackEditorWrapper
						editorWidth={showResizer ? resize.editorWidth : "auto"}
						minHeightInPX={editorMinHeight}
						vertical={vertical}
						expanded={expanded}
					/>
					{showResizer && (
						<div
							ref={resize.resizerRef}
							className="cp-resizer"
							onPointerDown={resize.startResize}
						/>
					)}
				</>
			)}
			{showPreview && (
				<PreviewPane
					style={showConsole ? HIDDEN : paneStyle}
					resizing={resize.dragging}
					previewLoadState={previewLoadState}
					isOnline={isOnline}
					expanded={expanded}
					setExpanded={setExpanded}
					onShowConsole={
						showConsoleButton ? () => setShowConsole(true) : undefined
					}
				/>
			)}
			{showConsoleButton && (
				<ConsolePane
					style={showConsole ? paneStyle : HIDDEN}
					expanded={expanded}
					setExpanded={setExpanded}
					onShowPreview={
						showPreview ? () => setShowConsole(false) : undefined
					}
				/>
			)}
		</SandpackLayout>
	);
}
