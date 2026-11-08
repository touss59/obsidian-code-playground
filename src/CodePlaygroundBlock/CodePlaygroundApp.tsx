import {
	SandpackProvider,
	type SandpackThemeProp,
} from "@codesandbox/sandpack-react";
import type { SandpackBundlerFiles } from "@codesandbox/sandpack-client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { App } from "obsidian";
import { ResolvedCodePlaygroundConfig } from "config";
import { resolveTheme } from "themes";
import {
	AppContextProvider,
	useAppContext,
} from "CodePlaygroundBlock/AppContextProvider";
import {
	RuntimePlayground,
	SandpackWrapper,
} from "CodePlaygroundBlock/Sandpack/SandpackWrapper";
import { STATIC_RESIZE_REPORTER_URL } from "CodePlaygroundBlock/Sandpack/staticResizeReporter";
import { useStorage } from "CodePlaygroundBlock/useStorage";
import { PlaygroundErrorBoundary } from "CodePlaygroundBlock/ErrorBoundary";
import { rootStyle } from "CodePlaygroundBlock/rootStyle";
import { SidecarStore } from "storage/SidecarStore";
import type { RuntimeRunners } from "CodePlaygroundBlock/Runtime/WorkerRunner";
import type { PlaygroundRuntime } from "CodePlaygroundBlock/Runtime/PlaygroundRuntime";
import {
	getRuntime,
	isRuntimeTemplate,
	RUNTIMES,
} from "CodePlaygroundBlock/Runtime/runtimes";

type CodePlaygroundAppProps = {
	config: ResolvedCodePlaygroundConfig;
	app: App;
	store: SidecarStore;
	runtimes: RuntimeRunners;
};

export function CodePlaygroundApp({
	config,
	app,
	store,
	runtimes,
}: CodePlaygroundAppProps) {
	const contextValue = useMemo(
		() => ({
			config,
			ObsidianApp: app,
			hasBeenCorrectlyLoaded: false,
			store,
			runtimes,
			runtime: getRuntime(config.template),
		}),
		[config, app, store, runtimes],
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
	const { template } = global.config;

	return (
		<div id={rootId} className="cp-root" style={rootStyle(global.config)}>
			{loadState.status === "loading" ? (
				<div className="cp-loading">Loading playground…</div>
			) : loadState.status === "error" ? (
				<div className="cp-load-error">
					This playground's saved data could not be loaded. The editor
					was not opened so your saved code is left untouched. Reload
					the note or restart Obsidian to try again.
				</div>
			) : isRuntimeTemplate(template) ? (
				<RuntimeSandpackProvider
					runtime={RUNTIMES[template]}
					savedFiles={loadState.files}
					theme={theme}
				/>
			) : (
				/* initMode "user-visible": only blocks near the viewport keep
				   a live bundler iframe, which caps concurrent bundlers on
				   notes with many playgrounds. It also self-heals Obsidian's
				   reading view detaching/reattaching section DOM (a
				   reattached iframe goes blank; the intersection observer
				   fires again and re-creates the client into it). */
				<SandpackProvider
					template={template}
					files={loadState.files}
					theme={theme}
					options={{
						initMode: "user-visible",
						...(global.config.bundlerURL
							? { bundlerURL: global.config.bundlerURL }
							: {}),
						...(template === "static"
							? { externalResources: [STATIC_RESIZE_REPORTER_URL] }
							: {}),
					}}
				>
					<SandpackWrapper />
				</SandpackProvider>
			)}
		</div>
	);
}

/**
 * No template and no preview: Sandpack only holds the files for the editor.
 * The runtime's shared worker runs them.
 */
function RuntimeSandpackProvider({
	runtime,
	savedFiles,
	theme,
}: {
	runtime: PlaygroundRuntime;
	savedFiles: SandpackBundlerFiles;
	theme: SandpackThemeProp;
}) {
	const files =
		Object.keys(savedFiles).length > 0 ? savedFiles : runtime.starterFiles;
	// Sandpack needs an entry and dependencies even without a template. It
	// then adds a /package.json, which runtime blocks hide and never save.
	// Sandpack throws when the entry is not one of the files (e.g. the user
	// deleted /main.py). It only writes the entry into /package.json, so any
	// file does: the worker reports the missing entry when the block runs.
	// Keep the object stable: Sandpack resets its files on a new one.
	const setup = useMemo(
		() => ({
			entry: runtime.entry in files ? runtime.entry : Object.keys(files)[0],
			dependencies: {},
		}),
		[runtime, files],
	);
	return (
		<SandpackProvider
			customSetup={setup}
			files={files}
			theme={theme}
			options={{ autorun: false }}
		>
			<RuntimePlayground runtime={runtime} />
		</SandpackProvider>
	);
}

function useGetStoredFile() {
	const { getItem } = useStorage("files");
	return useCallback(
		(): SandpackBundlerFiles => getItem() ?? {},
		[getItem],
	);
}
