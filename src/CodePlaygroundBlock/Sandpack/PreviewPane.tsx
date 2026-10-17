import type { CSSProperties } from "react";
import { SandpackPreview } from "@codesandbox/sandpack-react";
import { useAppContext } from "CodePlaygroundBlock/AppContextProvider";
import { ExpandableButton } from "CodePlaygroundBlock/ExpandableButton";
import { PreviewUnavailableBanner } from "CodePlaygroundBlock/Sandpack/PreviewUnavailableBanner";
import type { PreviewLoadState } from "CodePlaygroundBlock/Sandpack/usePreviewLoadState";

export function PreviewPane({
	style,
	resizing,
	previewLoadState,
	isOnline,
	expanded,
	setExpanded,
	onShowConsole,
}: {
	style: CSSProperties;
	resizing: boolean;
	previewLoadState: PreviewLoadState;
	isOnline: boolean;
	expanded: boolean;
	setExpanded: (value: boolean) => unknown;
	/** Omitted when the console button is disabled. */
	onShowConsole?: () => void;
}) {
	const { value: global } = useAppContext();
	const unavailable =
		previewLoadState !== "loaded" &&
		(!isOnline || previewLoadState === "timedOut");

	return (
		<div style={style}>
			<div
				className="cp-preview-overlay"
				style={{ zIndex: `${resizing ? 100 : -1}` }}
			></div>
			<div className="cp-preview-pane">
				{unavailable && <PreviewUnavailableBanner isOnline={isOnline} />}
				<SandpackPreview
					showOpenInCodeSandbox={global.config.showOpenInCodeSandbox}
					className="cp-preview-content"
					actionsChildren={
						<div className="cp-actions-row">
							<ExpandableButton
								expanded={expanded}
								setExpanded={setExpanded}
							/>
							{onShowConsole && (
								<button onClick={onShowConsole}>
									Show console
								</button>
							)}
						</div>
					}
				/>
			</div>
		</div>
	);
}
