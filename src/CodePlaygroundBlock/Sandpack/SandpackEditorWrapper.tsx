import { SandpackCodeEditor } from "@codesandbox/sandpack-react";
import { useEffect, useRef, useState } from "react";
import { useAppContext } from "CodePlaygroundBlock/AppContextProvider";
import { useEditorMaxHeight } from "CodePlaygroundBlock/useEditorMaxHeight";
import { useDebounce } from "CodePlaygroundBlock/useDebounce";
import { useStorage } from "CodePlaygroundBlock/useStorage";
import { EDITOR_WIDTH_DEBOUNCE_MS } from "appConstants";

export function SandpackEditorWrapper({
	editorWidthInPX,
	minHeightInPX,
	vertical,
	expanded,
	onManageFiles,
}: {
	editorWidthInPX: number;
	minHeightInPX: number;
	vertical: boolean;
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

	useSavedEditorWidth(editorWidthInPX);

	const editorWidth =
		editorWidthInPX === -1 ? "auto" : `${editorWidthInPX}px`;

	const wrapperStyle = vertical
		? { flex: "none", width: "100%" }
		: {
				flex: editorWidth === "auto" ? "1" : "0",
				minWidth: editorWidth === "auto" ? "0" : editorWidth,
				minHeight:
					minHeightInPX > 0 ? `${minHeightInPX}px` : undefined,
			};

	return (
		<div ref={editorRef} style={wrapperStyle}>
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
