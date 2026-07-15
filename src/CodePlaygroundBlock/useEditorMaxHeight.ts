import { useLayoutEffect, type RefObject } from "react";

export function useEditorMaxHeight(
	editorHeight: number | string,
	maxEditorHeight: number,
	minEditorHeight: number,
	setEditorHeight: (height: string) => void,
	expanded: boolean,
	containerRef: RefObject<HTMLDivElement | null>,
) {
	useLayoutEffect(() => {
		const editor = containerRef.current;
		if (!editor) return;

		const check = () => {
			if (expanded) return;
			if (
				editor.clientHeight > maxEditorHeight &&
				editorHeight === "auto"
			) {
				const clamped = Math.max(maxEditorHeight, minEditorHeight);
				setEditorHeight(`${clamped}px`);
			}
		};

		const observer = new ResizeObserver(check);
		observer.observe(editor);
		check();

		return () => observer.disconnect();
	}, [editorHeight, maxEditorHeight, minEditorHeight, setEditorHeight, containerRef, expanded]);

	useLayoutEffect(() => {
		if (expanded) {
			setEditorHeight("auto");
		}
	}, [expanded, setEditorHeight]);
}
