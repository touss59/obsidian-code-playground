import { useDragResize } from "CodePlaygroundBlock/Sandpack/useDragResize";
import { useSavedSize } from "CodePlaygroundBlock/Sandpack/useSavedSize";

type HeightField = "rowHeight" | "editorHeight" | "paneHeight";

/**
 * A user-set panel height, saved per block. Dragging a handle placed right
 * below the panel sets it. Double-clicking the handle clears it, so the
 * panel sizes to its content again.
 */
export function usePanelHeightResize(field: HeightField, onStart: () => void) {
	const { size: height, set, reset } = useSavedSize(field);
	const { dragging, startResize } = useDragResize({
		measure: measurePanelHeight,
		onResize: set,
		onStart,
	});

	return { height, dragging, startResize, reset };
}

/**
 * The pointer's offset from the top of the panel's content box. The panel is
 * the closest visible element before the handle (a hidden preview or console
 * can sit between them).
 */
function measurePanelHeight(e: PointerEvent, handle: HTMLElement): number | null {
	let panel = handle.previousElementSibling;
	while (panel?.instanceOf(HTMLElement) && panel.offsetParent === null) {
		panel = panel.previousElementSibling;
	}
	if (!panel?.instanceOf(HTMLElement)) return null;
	const top = panel.getBoundingClientRect().top + panel.clientTop;
	return Math.max(0, e.clientY - top);
}
