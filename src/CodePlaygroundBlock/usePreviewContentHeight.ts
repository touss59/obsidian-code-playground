import { useEffect, useRef, useState, type RefObject } from "react";
import { useSandpack } from "@codesandbox/sandpack-react";
import {
	nextContentHeight,
	type PreviewReport,
} from "CodePlaygroundBlock/previewContentHeight";

/**
 * Preview content height in px, padded so the content is not clipped. 0
 * until the preview reports a height, or while the content follows the
 * viewport (see nextContentHeight).
 */
export function usePreviewContentHeight(
	enabled: boolean,
	previewRef: RefObject<HTMLElement>,
): number {
	const { listen } = useSandpack();
	const [height, setHeight] = useState(0);
	const lastReportRef = useRef<PreviewReport | null>(null);

	useEffect(() => {
		if (!enabled) return;
		lastReportRef.current = null;
		const unsubscribe = listen((message) => {
			if (message.type === "resize" && typeof message.height === "number") {
				const iframe = previewRef.current?.querySelector("iframe");
				const report = {
					height: message.height,
					viewport: iframe?.clientHeight ?? null,
				};
				const contentHeight = nextContentHeight(lastReportRef.current, report);
				lastReportRef.current = { ...report, contentHeight };
				setHeight(contentHeight);
			}
		});
		return unsubscribe;
	}, [enabled, listen, previewRef]);

	return enabled ? height : 0;
}
