import {
	useCallback,
	useEffect,
	useRef,
	useState,
	type PointerEvent as ReactPointerEvent,
} from "react";
import { useThrottle } from "CodePlaygroundBlock/useThrottle";
import { RESIZER_THROTTLE_MS } from "appConstants";

/**
 * Drag tracking shared by the resize handles. `measure` turns the pointer
 * position into the new size, using the dragged handle as reference, or
 * returns null to ignore the move.
 */
export function useDragResize({
	measure,
	onResize,
	onStart,
}: {
	measure: (e: PointerEvent, handle: HTMLElement) => number | null;
	onResize: (size: number) => void;
	onStart?: () => void;
}) {
	const [dragging, setDragging] = useState(false);
	const handleRef = useRef<HTMLElement | null>(null);
	const throttledResize = useThrottle(onResize, RESIZER_THROTTLE_MS); // ~60fps

	// Ref mirrors so the listener effect only re-runs when a drag starts or
	// ends, not on every render.
	const measureRef = useRef(measure);
	measureRef.current = measure;
	const resizeRef = useRef(throttledResize);
	resizeRef.current = throttledResize;
	const onStartRef = useRef(onStart);
	onStartRef.current = onStart;
	// onStart waits for the first move, so a click or a double-click on the
	// handle doesn't count as a drag.
	const movedRef = useRef(false);

	const startResize = useCallback((e: ReactPointerEvent<HTMLElement>) => {
		// Capture the pointer so the drag keeps tracking even when it moves
		// over the preview iframe or off the thin handle.
		e.currentTarget.setPointerCapture(e.pointerId);
		handleRef.current = e.currentTarget;
		movedRef.current = false;
		setDragging(true);
	}, []);

	useEffect(() => {
		if (!dragging) return;

		const onPointerUp = () => {
			setDragging(false);
		};

		const onPointerMove = (e: PointerEvent) => {
			// Ignore secondary pointers (a second finger) mid-drag.
			if (!e.isPrimary) return;
			const handle = handleRef.current;
			if (!handle) return;
			const size = measureRef.current(e, handle);
			if (size === null) return;
			if (!movedRef.current) {
				movedRef.current = true;
				onStartRef.current?.();
			}
			resizeRef.current(size);
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

	return { dragging, startResize };
}
