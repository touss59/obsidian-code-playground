import { useEffect, useState } from "react";
import { useSandpack } from "@codesandbox/sandpack-react";

export function usePreviewContentHeight(enabled: boolean): number {
	const { listen } = useSandpack();
	const [height, setHeight] = useState(0);

	useEffect(() => {
		if (!enabled) return;
		const unsubscribe = listen((message) => {
			if (message.type === "resize" && typeof message.height === "number") {
				setHeight(message.height);
			}
		});
		return unsubscribe;
	}, [enabled, listen]);

	return enabled ? height : 0;
}
