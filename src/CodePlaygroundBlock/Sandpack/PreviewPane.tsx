import { useEffect, useRef, type CSSProperties, type RefObject } from "react";
import {
	SandpackPreview,
	useSandpack,
	type SandpackPreviewRef,
} from "@codesandbox/sandpack-react";
import { useAppContext } from "CodePlaygroundBlock/AppContextProvider";
import { OpenInCodeSandboxButton } from "CodePlaygroundBlock/Sandpack/OpenInCodeSandboxButton";
import { PreviewUnavailableBanner } from "CodePlaygroundBlock/Sandpack/PreviewUnavailableBanner";
import type { PreviewLoadState } from "CodePlaygroundBlock/Sandpack/usePreviewLoadState";

export function PreviewPane({
	containerRef,
	onClientIdChange,
	style,
	resizing,
	previewLoadState,
	isOnline,
	onShowConsole,
}: {
	/** The block measures the preview through it. The modal does not. */
	containerRef?: RefObject<HTMLDivElement>;
	/** Gets the preview's clientId on mount, and undefined on unmount. */
	onClientIdChange: (clientId: string | undefined) => void;
	style: CSSProperties;
	resizing: boolean;
	previewLoadState: PreviewLoadState;
	isOnline: boolean;
	/** Omitted when the console button is disabled. */
	onShowConsole?: () => void;
}) {
	const { value: global } = useAppContext();
	const { sandpack } = useSandpack();
	const previewRef = useRef<SandpackPreviewRef>(null);
	// Run the effect below on mount and unmount only: its cleanup removes
	// the client.
	const latestRef = useRef({
		onClientIdChange,
		unregisterBundler: sandpack.unregisterBundler,
	});
	latestRef.current = {
		onClientIdChange,
		unregisterBundler: sandpack.unregisterBundler,
	};

	useEffect(() => {
		const clientId = previewRef.current?.clientId;
		if (!clientId) return;
		latestRef.current.onClientIdChange(clientId);
		return () => {
			latestRef.current.onClientIdChange(undefined);
			// SandpackPreview's own cleanup destroys the client but keeps its
			// iframe registered, and each later run builds a client on that
			// detached iframe. A second call removes the iframe. The two
			// calls do both steps in either order.
			latestRef.current.unregisterBundler(clientId);
		};
	}, []);

	const unavailable =
		previewLoadState !== "loaded" &&
		(!isOnline || previewLoadState === "timedOut");

	return (
		<div ref={containerRef} style={style}>
			<div
				className="cp-preview-overlay"
				style={{ zIndex: `${resizing ? 100 : -1}` }}
			></div>
			<div className="cp-preview-pane">
				{unavailable && <PreviewUnavailableBanner isOnline={isOnline} />}
				<SandpackPreview
					ref={previewRef}
					showOpenInCodeSandbox={false}
					className="cp-preview-content"
					actionsChildren={
						<>
							{global.config.showOpenInCodeSandbox && (
								<OpenInCodeSandboxButton />
							)}
							{onShowConsole && (
								<button onClick={onShowConsole}>Show console</button>
							)}
						</>
					}
				/>
			</div>
		</div>
	);
}
