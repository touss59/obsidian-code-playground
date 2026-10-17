import type { CSSProperties } from "react";
import { SandpackConsole } from "@codesandbox/sandpack-react";
import { ExpandableButton } from "CodePlaygroundBlock/ExpandableButton";

export function ConsolePane({
	style,
	expanded,
	setExpanded,
	onShowPreview,
}: {
	style: CSSProperties;
	expanded: boolean;
	setExpanded: (value: boolean) => unknown;
	/** Omitted when the preview is disabled. */
	onShowPreview?: () => void;
}) {
	return (
		<SandpackConsole
			style={style}
			actionsChildren={
				<div style={{ display: "flex", gap: "5px" }}>
					<ExpandableButton
						expanded={expanded}
						setExpanded={setExpanded}
					/>
					{onShowPreview && (
						<button onClick={onShowPreview}>Show preview</button>
					)}
				</div>
			}
		/>
	);
}
