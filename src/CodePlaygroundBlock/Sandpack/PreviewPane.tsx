import type { CSSProperties, RefObject } from "react";
import { SandpackPreview } from "@codesandbox/sandpack-react";
import { useAppContext } from "CodePlaygroundBlock/AppContextProvider";
import { OpenInCodeSandboxButton } from "CodePlaygroundBlock/Sandpack/OpenInCodeSandboxButton";
import { PreviewUnavailableBanner } from "CodePlaygroundBlock/Sandpack/PreviewUnavailableBanner";
import type { PreviewLoadState } from "CodePlaygroundBlock/Sandpack/usePreviewLoadState";

export function PreviewPane({
	containerRef,
	style,
	resizing,
	previewLoadState,
	isOnline,
	onShowConsole,
}: {
	containerRef: RefObject<HTMLDivElement>;
	style: CSSProperties;
	resizing: boolean;
	previewLoadState: PreviewLoadState;
	isOnline: boolean;
	/** Omitted when the console button is disabled. */
	onShowConsole?: () => void;
}) {
	const { value: global } = useAppContext();
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
