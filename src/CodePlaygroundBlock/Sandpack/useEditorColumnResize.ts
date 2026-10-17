import {
	useCallback,
	useEffect,
	useRef,
	useState,
	type PointerEvent as ReactPointerEvent,
	type RefObject,
} from "react";
import { useStorage } from "CodePlaygroundBlock/useStorage";
import { useThrottle } from "CodePlaygroundBlock/useThrottle";
import { RESIZER_THROTTLE_MS } from "appConstants";

export type EditorWidth = number | "auto";

export function useEditorColumnResize() {
	const { getItem } = useStorage("editorWidth");
	const [editorWidth, setEditorWidth] = useState<EditorWidth>(
		getItem() ?? "auto",
	);
	const [dragging, setDragging] = useState(false);
	const stopResize = useCallback(() => setDragging(false), []);
	const resizerRef = useRef<HTMLDivElement | null>(null);
	useDragTracking(dragging, stopResize, setEditorWidth, resizerRef);

	const startResize = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
		// Capture the pointer so the drag keeps tracking even when it moves
		// over the preview iframe or off the thin handle.
		e.currentTarget.setPointerCapture(e.pointerId);
		setDragging(true);
	}, []);

	return { editorWidth, dragging, resizerRef, startResize };
}

function useDragTracking(
	dragging: boolean,
	stopResize: () => unknown,
	setEditorWidth: (newWidth: number) => unknown,
	resizerRef: RefObject<HTMLDivElement | null>,
) {
	const throttledSetEditorWidth = useThrottle(setEditorWidth, RESIZER_THROTTLE_MS); // ~60fps

	// Ref mirrors so the listener effect only re-runs when a drag starts or
	// ends, not on every render.
	const throttledRef = useRef(throttledSetEditorWidth);
	throttledRef.current = throttledSetEditorWidth;
	const stopResizeRef = useRef(stopResize);
	stopResizeRef.current = stopResize;

	useEffect(() => {
		if (!dragging) return;

		const onPointerUp = () => {
			stopResizeRef.current();
		};

		const onPointerMove = (e: PointerEvent) => {
			// Ignore secondary pointers (a second finger) mid-drag.
			if (!e.isPrimary) return;
			const resizer = resizerRef.current;
			if (!resizer?.parentElement) return;
			const containerRect = resizer.parentElement.getBoundingClientRect();
			const newLeftWidth = e.clientX - containerRect.left;
			if (newLeftWidth < 0) return;
			throttledRef.current(newLeftWidth);
		};

		// Pointer events unify mouse/touch/pen; combined with setPointerCapture
		// on the handle (see startResize above) the drag keeps tracking over
		// the preview iframe. Captured events still bubble to window.
		window.addEventListener("pointermove", onPointerMove);
		window.addEventListener("pointerup", onPointerUp);
		window.addEventListener("pointercancel", onPointerUp);

		return () => {
			window.removeEventListener("pointermove", onPointerMove);
			window.removeEventListener("pointerup", onPointerUp);
			window.removeEventListener("pointercancel", onPointerUp);
		};
	}, [dragging]);
}
