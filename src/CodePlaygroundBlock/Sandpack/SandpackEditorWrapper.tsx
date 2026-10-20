import { useState, type CSSProperties, type RefObject } from "react";
import { ManageFilesModal } from "CodePlaygroundBlock/ManageFilesModal";
import type { BlockSizes } from "CodePlaygroundBlock/blockSizes";
import { PlaygroundCodeEditor } from "CodePlaygroundBlock/Sandpack/PlaygroundCodeEditor";
import type { EditorWidth } from "CodePlaygroundBlock/Sandpack/useEditorColumnResize";

export function SandpackEditorWrapper({
	boxRef,
	editorWidth,
	sizes,
	vertical,
	onOpenFullscreen,
}: {
	boxRef: RefObject<HTMLDivElement>;
	editorWidth: EditorWidth;
	sizes: Pick<BlockSizes, "editorBox" | "editor">;
	vertical: boolean;
	onOpenFullscreen: () => void;
}) {
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
				<PlaygroundCodeEditor
					style={{
						flex: "1 1 auto",
						minHeight: sizes.editor.minHeight,
						maxHeight: sizes.editor.maxHeight,
						width: cssWidth,
					}}
				/>
				<div className="cp-editor-buttons">
					<button onClick={onOpenFullscreen} title="Open in a large editor">
						Full screen
					</button>
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
