import { SandpackProvider } from "@codesandbox/sandpack-react";
import type { SandpackBundlerFiles } from "@codesandbox/sandpack-client";
import { CSSProperties, useCallback, useEffect, useMemo, useState } from "react";
import { App } from "obsidian";
import { ResolvedCodePlaygroundConfig } from "config";
import { resolveTheme } from "themes";
import {
	AppContextProvider,
	useAppContext,
} from "CodePlaygroundBlock/AppContextProvider";
import { SandpackWrapper } from "CodePlaygroundBlock/Sandpack/SandpackWrapper";
import { useStorage } from "CodePlaygroundBlock/useStorage";
import { PlaygroundErrorBoundary } from "CodePlaygroundBlock/ErrorBoundary";
import { SidecarStore } from "storage/SidecarStore";

type CodePlaygroundAppProps = {
	config: ResolvedCodePlaygroundConfig;
	app: App;
	store: SidecarStore;
};

export function CodePlaygroundApp({ config, app, store }: CodePlaygroundAppProps) {
	const contextValue = useMemo(
		() => ({
			config,
			ObsidianApp: app,
			hasBeenCorrectlyLoaded: false,
			store,
		}),
		[config, app, store],
	);

	return (
		<AppContextProvider value={contextValue}>
			<PlaygroundErrorBoundary>
				<AppContent />
			</PlaygroundErrorBoundary>
		</AppContextProvider>
	);
}

type LoadState =
	| { status: "loading" }
	| { status: "error" }
	| { status: "ready"; files: SandpackBundlerFiles };

function AppContent() {
	const { value: global } = useAppContext();
	const getStoredFile = useGetStoredFile();
	const [loadState, setLoadState] = useState<LoadState>({ status: "loading" });

	const store = global.store;
	const id = global.config.id;

	useEffect(() => {
		let cancelled = false;
		store
			.load(id)
			.then(() => {
				if (!cancelled) {
					setLoadState({ status: "ready", files: getStoredFile() });
				}
			})
			.catch((err: unknown) => {
				// The sidecar exists but couldn't be read/parsed. Do NOT mount
				// the editor: if we did, its initial auto-save would overwrite
				// the still-present-on-disk sidecar with template defaults and
				// permanently destroy the user's saved code.
				if (cancelled) return;
				console.error(
					`[CodePlayground] Failed to load saved block ${id}:`,
					err,
				);
				setLoadState({ status: "error" });
			});
		return () => {
			cancelled = true;
		};
	}, [store, id, getStoredFile]);

	const theme = useMemo(
		() => resolveTheme(global.config.theme),
		[global.config.theme],
	);
	const rootId = `${global.config.id}-root`;
	const rootStyle = {
		"--cp-border": global.config.borderColor,
		"--cp-button-bg": global.config.buttonBackgroundColor,
		"--cp-button-text": global.config.buttonTextColor,
	} as CSSProperties;

	return (
		<div id={rootId} className="cp-root" style={rootStyle}>
			{loadState.status === "loading" ? (
				<div className="cp-loading">Loading playground…</div>
			) : loadState.status === "error" ? (
				<div className="cp-load-error">
					This playground's saved data could not be loaded. The editor
					was not opened so your saved code is left untouched. Reload
					the note or restart Obsidian to try again.
				</div>
			) : (
				/* initMode "user-visible": only blocks near the viewport keep
				   a live bundler iframe, which caps concurrent bundlers on
				   notes with many playgrounds. It also self-heals Obsidian's
				   reading view detaching/reattaching section DOM (a
				   reattached iframe goes blank; the intersection observer
				   fires again and re-creates the client into it). */
				<SandpackProvider
					template={global.config.template}
					files={loadState.files}
					theme={theme}
					options={{
						initMode: "user-visible",
						...(global.config.bundlerURL
							? { bundlerURL: global.config.bundlerURL }
							: {}),
					}}
				>
					<SandpackWrapper />
				</SandpackProvider>
			)}
		</div>
	);
}

function useGetStoredFile() {
	const { getItem } = useStorage("files");
	return useCallback(
		(): SandpackBundlerFiles => getItem() ?? {},
		[getItem],
	);
}
