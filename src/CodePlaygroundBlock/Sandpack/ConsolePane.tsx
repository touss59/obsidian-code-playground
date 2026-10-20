import {
	SandpackConsole,
	SandpackReactContext,
	type SandpackContext,
} from "@codesandbox/sandpack-react";
import { useContext, useMemo, type CSSProperties, type ReactNode } from "react";
import { useClientListen } from "CodePlaygroundBlock/Sandpack/useClientListen";

export function ConsolePane({
	style,
	clientId,
	onShowPreview,
}: {
	style: CSSProperties;
	/** Show the logs of this preview only. Omit to show the logs of all. */
	clientId?: string;
	/** Omitted when the preview is disabled. */
	onShowPreview?: () => void;
}) {
	const consoleView = (
		<SandpackConsole
			className="cp-console-content"
			actionsChildren={
				onShowPreview && (
					<button onClick={onShowPreview}>Show preview</button>
				)
			}
		/>
	);
	// The wrapper takes the pane size. A console placed directly in the
	// layout gets Sandpack's fixed 300px height instead.
	return (
		<div className="cp-console-pane" style={style}>
			{clientId ? (
				<ClientScope clientId={clientId}>{consoleView}</ClientScope>
			) : (
				consoleView
			)}
		</div>
	);
}

/**
 * SandpackConsole declares a `clientId` prop but ignores it: it reads the
 * logs through the context's `listen`, which gets the messages of every
 * client. Scoping that `listen` to one client shows its logs only.
 */
function ClientScope({
	clientId,
	children,
}: {
	clientId: string;
	children: ReactNode;
}) {
	const context = useContext(SandpackReactContext);
	const listen = useClientListen(clientId);
	const value = useMemo<SandpackContext | null>(
		() => context && { ...context, listen },
		[context, listen],
	);
	return (
		<SandpackReactContext.Provider value={value}>
			{children}
		</SandpackReactContext.Provider>
	);
}
