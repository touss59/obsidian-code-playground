import type { CSSProperties } from "react";
import { SandpackConsole } from "@codesandbox/sandpack-react";

export function ConsolePane({
	style,
	onShowPreview,
}: {
	style: CSSProperties;
	/** Omitted when the preview is disabled. */
	onShowPreview?: () => void;
}) {
	// The wrapper takes the pane size. A console placed directly in the
	// layout gets Sandpack's fixed 300px height instead.
	return (
		<div className="cp-console-pane" style={style}>
			<SandpackConsole
				className="cp-console-content"
				actionsChildren={
					onShowPreview && (
						<button onClick={onShowPreview}>Show preview</button>
					)
				}
			/>
		</div>
	);
}
