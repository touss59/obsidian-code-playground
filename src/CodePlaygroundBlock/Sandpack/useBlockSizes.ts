import type { RefObject } from "react";
import { useAppContext } from "CodePlaygroundBlock/AppContextProvider";
import { useEditorOverflow } from "CodePlaygroundBlock/Sandpack/useEditorOverflow";
import {
	computeBlockSizes,
	type BlockSizes,
	type ManualHeights,
} from "CodePlaygroundBlock/blockSizes";

/** Feeds the block config and the measured content to computeBlockSizes. */
export function useBlockSizes({
	expanded,
	manual,
	editorBoxRef,
	contentHeight,
	contentVisible,
}: {
	expanded: boolean;
	manual: ManualHeights;
	editorBoxRef: RefObject<HTMLElement>;
	/** The height of the pane content: the preview's, or a runtime's output. */
	contentHeight: number;
	/** False while the console hides the preview. */
	contentVisible: boolean;
}): BlockSizes {
	const { value: global } = useAppContext();
	const { layout, showEditor, minEditorHeight, maxEditorHeight } = global.config;
	const editorOverflows = useEditorOverflow(editorBoxRef, showEditor);

	return computeBlockSizes({
		layout,
		hasEditor: showEditor,
		minHeight: minEditorHeight,
		maxHeight: maxEditorHeight,
		expanded,
		previewContentHeight: contentHeight,
		previewVisible: contentVisible,
		editorOverflows,
		manual,
	});
}
