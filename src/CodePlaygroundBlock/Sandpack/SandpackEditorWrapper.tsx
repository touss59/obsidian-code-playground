import { SandpackCodeEditor } from "@codesandbox/sandpack-react";
import { useState, type CSSProperties, type RefObject } from "react";
import { useAppContext } from "CodePlaygroundBlock/AppContextProvider";
import { ManageFilesModal } from "CodePlaygroundBlock/ManageFilesModal";
import type { BlockSizes } from "CodePlaygroundBlock/blockSizes";
import type { EditorWidth } from "CodePlaygroundBlock/Sandpack/useEditorColumnResize";

export function SandpackEditorWrapper({
	boxRef,
	editorWidth,
	sizes,
	vertical,
}: {
	boxRef: RefObject<HTMLDivElement>;
	editorWidth: EditorWidth;
	sizes: Pick<BlockSizes, "editorBox" | "editor">;
	vertical: boolean;
}) {
	const { value: global } = useAppContext();
	const [showManage, setShowManage] = useState(false);

	const auto = editorWidth === "auto";
	const cssWidth = auto ? "auto" : `${editorWidth}px`;

	// A flex column so the editor fills the box when the box is taller than
	// the code (a dragged height, or a taller preview in the same row).
	const boxStyle: CSSProperties = {
		display: "flex",
		flexDirection: "column",
		...(vertical
			? { flex: "none", width: "100%" }
			: { flex: auto ? "1" : "0", minWidth: auto ? "0" : cssWidth }),
		...sizes.editorBox,
	};

	return (
		<div ref={boxRef} style={boxStyle}>
			<div className="cp-editor-wrap">
				<SandpackCodeEditor
					showTabs={global.config.showFileTabs}
					closableTabs={true}
					style={{
						flex: "1 1 auto",
						minHeight: sizes.editor.minHeight,
						maxHeight: sizes.editor.maxHeight,
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
