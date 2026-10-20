import type { RefObject } from "react";
import { useAppContext } from "CodePlaygroundBlock/AppContextProvider";
import { usePreviewContentHeight } from "CodePlaygroundBlock/usePreviewContentHeight";
import { useEditorOverflow } from "CodePlaygroundBlock/Sandpack/useEditorOverflow";
import {
	computeBlockSizes,
	type BlockSizes,
	type ManualHeights,
} from "CodePlaygroundBlock/blockSizes";

/** Feeds the block config and the measured content to computeBlockSizes. */
export function useBlockSizes({
	expanded,
	consoleShown,
	manual,
	previewRef,
	editorBoxRef,
	previewClientId,
}: {
	expanded: boolean;
	consoleShown: boolean;
	manual: ManualHeights;
	previewRef: RefObject<HTMLElement>;
	editorBoxRef: RefObject<HTMLElement>;
	/** The block's preview. The full-screen modal's preview is ignored. */
	previewClientId: string | undefined;
}): BlockSizes {
	const { value: global } = useAppContext();
	const { layout, showEditor, showPreview, minEditorHeight, maxEditorHeight } =
		global.config;
	const previewContentHeight = usePreviewContentHeight(
		showPreview,
		previewRef,
		previewClientId,
	);
	const editorOverflows = useEditorOverflow(editorBoxRef, showEditor);

	return computeBlockSizes({
		layout,
		hasEditor: showEditor,
		minHeight: minEditorHeight,
		maxHeight: maxEditorHeight,
		expanded,
		previewContentHeight,
		previewVisible: showPreview && !consoleShown,
		editorOverflows,
		manual,
	});
}
