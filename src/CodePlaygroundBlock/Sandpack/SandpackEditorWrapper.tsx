import { SandpackCodeEditor } from "@codesandbox/sandpack-react";
import { useEffect, useRef, useState } from "react";
import { useAppContext } from "CodePlaygroundBlock/AppContextProvider";
import { useEditorMaxHeight } from "CodePlaygroundBlock/useEditorMaxHeight";
import { useDebounce } from "CodePlaygroundBlock/useDebounce";
import { useStorage } from "CodePlaygroundBlock/useStorage";
import { usePreviewContentHeight } from "CodePlaygroundBlock/usePreviewContentHeight";
import { EDITOR_WIDTH_DEBOUNCE_MS } from "appConstants";

export function SandpackEditorWrapper({
	editorWidthInPX,
	previewVisible,
	expanded,
	onManageFiles,
}: {
	editorWidthInPX: number;
	previewVisible: boolean;
	expanded: boolean;
	onManageFiles: () => void;
}) {
	const { value: global } = useAppContext();
	const editorRef = useRef<HTMLDivElement | null>(null);
	const minEditorHeight = global.config.minEditorHeight;
	const maxEditorHeight = global.config.maxEditorHeight;
	const [editorHeight, setEditorHeight] = useState("auto");

	useEditorMaxHeight(
		editorHeight,
		maxEditorHeight,
		minEditorHeight,
		setEditorHeight,
		expanded,
		editorRef,
	);

	const previewHeight = usePreviewContentHeight(previewVisible);

	useSavedEditorWidth(editorWidthInPX);

	const editorWidth =
		editorWidthInPX === -1 ? "auto" : `${editorWidthInPX}px`;

	return (
		<div
			ref={editorRef}
			style={{
				flex: editorWidth === "auto" ? "1" : "0",
				minWidth: editorWidth === "auto" ? "0" : editorWidth,
				minHeight:
					expanded && previewHeight > 0
						? `${previewHeight}px`
						: undefined,
			}}
		>
			<div className="cp-editor-wrap">
				<SandpackCodeEditor
					showTabs={global.config.showFileTabs}
					closableTabs={true}
					style={{
						height: editorHeight,
						minHeight: `${minEditorHeight}px`,
						width: editorWidth,
					}}
				/>
				<div className="cp-manage-files-button">
					<button onClick={onManageFiles}>Manage files</button>
				</div>
			</div>
		</div>
	);
}

function useSavedEditorWidth(currentEditorWidth: number) {
	const { value: global } = useAppContext();
	const { saveItem } = useStorage("editorWidth");
	const debouncedSaveItem = useDebounce(saveItem, EDITOR_WIDTH_DEBOUNCE_MS);
	useEffect(() => {
		if (
			!global.hasBeenCorrectlyLoaded ||
			!currentEditorWidth ||
			currentEditorWidth <= 0
		) {
			return;
		}
		debouncedSaveItem(currentEditorWidth);
	}, [currentEditorWidth, debouncedSaveItem, global.hasBeenCorrectlyLoaded]);
}
