import { useDragResize } from "CodePlaygroundBlock/Sandpack/useDragResize";
import { useSavedSize } from "CodePlaygroundBlock/Sandpack/useSavedSize";

export type EditorWidth = number | "auto";

/**
 * The editor column width, saved per block. "auto" until the user drags.
 * The block and the full-screen modal each save their own field: the modal
 * is much wider, so one width cannot serve both.
 */
export function useEditorColumnResize(
	field: "editorWidth" | "fullscreenEditorWidth" = "editorWidth",
) {
	const { size, set, reset } = useSavedSize(field);
	const { dragging, startResize } = useDragResize({
		measure: measureColumnWidth,
		onResize: set,
	});

	const editorWidth: EditorWidth = size ?? "auto";
	return { editorWidth, dragging, startResize, reset };
}

/** The pointer's offset from the left edge of the handle's container. */
function measureColumnWidth(e: PointerEvent, handle: HTMLElement): number | null {
	const container = handle.parentElement;
	if (!container) return null;
	const width = e.clientX - container.getBoundingClientRect().left;
	return width <= 0 ? null : width;
}
