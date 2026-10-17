import { SandpackCodeEditor } from "@codesandbox/sandpack-react";
import { useEffect, useRef, useState } from "react";
import { useAppContext } from "CodePlaygroundBlock/AppContextProvider";
import { useEditorMaxHeight } from "CodePlaygroundBlock/useEditorMaxHeight";
import { useDebounce } from "CodePlaygroundBlock/useDebounce";
import { useStorage } from "CodePlaygroundBlock/useStorage";
import { ManageFilesModal } from "CodePlaygroundBlock/ManageFilesModal";
import type { EditorWidth } from "CodePlaygroundBlock/Sandpack/useEditorColumnResize";
import { EDITOR_WIDTH_DEBOUNCE_MS } from "appConstants";

export function SandpackEditorWrapper({
	editorWidth,
	minHeightInPX,
	vertical,
	expanded,
}: {
	editorWidth: EditorWidth;
	minHeightInPX: number;
	vertical: boolean;
	expanded: boolean;
}) {
	const { value: global } = useAppContext();
	const [showManage, setShowManage] = useState(false);
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

	useSavedEditorWidth(editorWidth);

	const auto = editorWidth === "auto";
	const cssWidth = auto ? "auto" : `${editorWidth}px`;

	const wrapperStyle = vertical
		? { flex: "none", width: "100%" }
		: {
				flex: auto ? "1" : "0",
				minWidth: auto ? "0" : cssWidth,
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
						width: cssWidth,
					}}
				/>
				<div className="cp-manage-files-button">
					<button onClick={() => setShowManage(true)}>
						Manage files
					</button>
				</div>
			</div>
			<ManageFilesModal
				open={showManage}
				onClose={() => setShowManage(false)}
			/>
		</div>
	);
}

function useSavedEditorWidth(currentEditorWidth: EditorWidth) {
	const { value: global } = useAppContext();
	const { saveItem } = useStorage("editorWidth");
	const debouncedSaveItem = useDebounce(saveItem, EDITOR_WIDTH_DEBOUNCE_MS);
	useEffect(() => {
		if (
			!global.hasBeenCorrectlyLoaded ||
			currentEditorWidth === "auto" ||
			currentEditorWidth <= 0
		) {
			return;
		}
		debouncedSaveItem(currentEditorWidth);
	}, [currentEditorWidth, debouncedSaveItem, global.hasBeenCorrectlyLoaded]);
}
