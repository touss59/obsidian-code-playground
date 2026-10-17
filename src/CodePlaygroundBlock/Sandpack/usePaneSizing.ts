import type { CSSProperties } from "react";
import { useAppContext } from "CodePlaygroundBlock/AppContextProvider";
import { usePreviewContentHeight } from "CodePlaygroundBlock/usePreviewContentHeight";
import { stackedPaneHeight } from "CodePlaygroundBlock/stackedPaneHeight";

/**
 * Sizes the editor and the right pane (preview or console) so the preview
 * content fits.
 *
 * - Side by side: the pane stretches to the editor's height. When expanded,
 *   the editor grows to the preview content height so all of it shows.
 * - Stacked: nothing stretches the pane, so it gets a fixed height from
 *   `stackedPaneHeight`.
 */
export function usePaneSizing({
	expanded,
	consoleShown,
}: {
	expanded: boolean;
	consoleShown: boolean;
}): { editorMinHeight: number; paneStyle: CSSProperties } {
	const { value: global } = useAppContext();
	const { layout, showPreview, minEditorHeight, maxEditorHeight } =
		global.config;
	const previewContentHeight = usePreviewContentHeight(showPreview);

	if (layout !== "vertical") {
		const previewVisible = showPreview && !consoleShown;
		return {
			editorMinHeight:
				expanded && previewVisible ? previewContentHeight : 0,
			paneStyle: { flex: "1" },
		};
	}

	return {
		editorMinHeight: 0,
		paneStyle: {
			flex: "none",
			width: "100%",
			height: `${stackedPaneHeight(
				previewContentHeight,
				minEditorHeight,
				maxEditorHeight,
				expanded,
			)}px`,
		},
	};
}
