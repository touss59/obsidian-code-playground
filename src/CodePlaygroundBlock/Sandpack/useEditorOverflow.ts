import { useEffect, useState, type RefObject } from "react";

/**
 * Whether the code doesn't fit the editor, so the editor scrolls. Depending
 * on how its height is bound, Sandpack's editor container or CodeMirror's own
 * scroller does the scrolling, so both are checked.
 */
export function useEditorOverflow(
	boxRef: RefObject<HTMLElement>,
	enabled: boolean,
): boolean {
	const [overflows, setOverflows] = useState(false);

	useEffect(() => {
		const box = boxRef.current;
		if (!enabled || !box) {
			setOverflows(false);
			return;
		}

		// Coalesce bursts (every keystroke mutates the editor DOM) into one
		// layout read per frame.
		let frame = 0;
		const check = () => {
			cancelAnimationFrame(frame);
			frame = requestAnimationFrame(() => {
				const scrollers = box.querySelectorAll(".sp-code-editor, .cm-scroller");
				setOverflows(
					Array.from(scrollers).some(
						(el) => el.scrollHeight > el.clientHeight + 1,
					),
				);
			});
		};

		// The box resizes with the height bounds; typing, file switches and
		// tab changes only mutate the editor DOM inside it.
		const resizeObserver = new ResizeObserver(check);
		resizeObserver.observe(box);
		const mutationObserver = new MutationObserver(check);
		mutationObserver.observe(box, {
			childList: true,
			subtree: true,
			characterData: true,
		});
		check();

		return () => {
			cancelAnimationFrame(frame);
			resizeObserver.disconnect();
			mutationObserver.disconnect();
		};
	}, [boxRef, enabled]);

	return overflows;
}
