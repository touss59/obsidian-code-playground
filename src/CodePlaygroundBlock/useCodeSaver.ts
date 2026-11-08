import { SandpackBundlerFiles, SandpackMessage } from "@codesandbox/sandpack-client";
import { useCallback, useEffect, useRef } from "react";
import { useAppContext } from "CodePlaygroundBlock/AppContextProvider";
import { useDebounce } from "CodePlaygroundBlock/useDebounce";
import { useStorage } from "CodePlaygroundBlock/useStorage";
import { useSandpack } from "@codesandbox/sandpack-react";
import { HIDDEN_FILES_DEBOUNCE_MS, SAVE_FILES_DEBOUNCE_MS } from "appConstants";
import { withoutPackageJson } from "CodePlaygroundBlock/Runtime/runtimeFiles";

export function useCodeSaver() {
	const { value: global } = useAppContext();
	const { listen, sandpack } = useSandpack();
	const { saveItem } = useStorage("files");
	const latestFilesRef = useRef<SandpackBundlerFiles | null>(null);
	useActiveFileStorage(sandpack);
	useHiddenFilesStorage(sandpack);
	const initialFilesSavedRef = useRef(false);

	const saveFiles = useCallback(() => {
		if (latestFilesRef.current == null) return;
		saveItem(latestFilesRef.current);
	}, [saveItem]);

	const debouncedSaveFiles = useDebounce(saveFiles, SAVE_FILES_DEBOUNCE_MS);

	const saveNewState = useCallback(
		(msg: SandpackMessage) => {
			if (msg.type === "state" || msg.type === "urlchange") {
				const sandFiles = sandpack.files;
				if (sandFiles !== undefined) {
					latestFilesRef.current = sandFiles;
				}
			}

			debouncedSaveFiles();
		},
		[sandpack.files, debouncedSaveFiles],
	);

	useEffect(() => {
		const stopListening = listen((msg) => {
			if(!global.hasBeenCorrectlyLoaded) return;
			saveNewState(msg);
		});

		return () => {
			stopListening();
		};
	}, [listen, saveNewState, global.hasBeenCorrectlyLoaded]);

	// Save initial state, needed to display all files correctly
	useEffect(() => {
		if (!global.hasBeenCorrectlyLoaded) return;
		if (initialFilesSavedRef.current) return;
		initialFilesSavedRef.current = true;
		saveNewState({
			type: "state",
			state: { entry: "", transpiledModules: {} },
		});
	}, [global.hasBeenCorrectlyLoaded, saveNewState]);
}

/**
 * Runtime blocks (e.g. Python) have no bundler, so no bundler message
 * triggers a save. This saves the files after each change instead, without
 * Sandpack's /package.json.
 */
export function useRuntimeCodeSaver() {
	const { value: global } = useAppContext();
	const { sandpack } = useSandpack();
	const { saveItem } = useStorage("files");
	useActiveFileStorage(sandpack);
	useHiddenFilesStorage(sandpack);

	const saveFiles = useCallback(
		(files: SandpackBundlerFiles) => saveItem(withoutPackageJson(files)),
		[saveItem],
	);

	const debouncedSaveFiles = useDebounce(saveFiles, SAVE_FILES_DEBOUNCE_MS);

	useEffect(() => {
		if (!global.hasBeenCorrectlyLoaded) return;
		debouncedSaveFiles(sandpack.files);
	}, [global.hasBeenCorrectlyLoaded, sandpack.files, debouncedSaveFiles]);
}

function useHiddenFilesStorage(
	sandpack: ReturnType<typeof useSandpack>["sandpack"],
) {
	const { value: global } = useAppContext();
	const { saveItem } = useStorage("hiddenFiles");
	const timeoutIdRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

	const visibleFilesKey = (sandpack.visibleFiles ?? []).join("|");
	const filesKey = Object.keys(sandpack.files ?? {}).join("|");
	const isRuntime = global.runtime !== undefined;

	useEffect(() => {
		if (!global.hasBeenCorrectlyLoaded) return;
		const files = sandpack.files ?? {};
		// A runtime block never saves Sandpack's /package.json.
		const allPaths = Object.keys(isRuntime ? withoutPackageJson(files) : files);
		const visible = new Set(sandpack.visibleFiles ?? []);
		const hidden = allPaths.filter((p) => !visible.has(p));

		clearTimeout(timeoutIdRef.current);
		timeoutIdRef.current = setTimeout(() => {
			saveItem(hidden);
		}, HIDDEN_FILES_DEBOUNCE_MS);

		return () => clearTimeout(timeoutIdRef.current);
	}, [
		global.hasBeenCorrectlyLoaded,
		visibleFilesKey,
		filesKey,
		isRuntime,
		sandpack,
		saveItem,
	]);
}

function useActiveFileStorage(
	sandpack: ReturnType<typeof useSandpack>["sandpack"],
) {
	const { value: global } = useAppContext();
	const { getItem, saveItem } = useStorage("activeFile");
	const activeFileRestoredRef = useRef(false);

	useEffect(() => {
		if (!global.hasBeenCorrectlyLoaded || activeFileRestoredRef.current)
			return;
		activeFileRestoredRef.current = true;
		const storedActiveFile = getItem();
		if (storedActiveFile && sandpack.files[storedActiveFile]) {
			sandpack.setActiveFile(storedActiveFile);
		}
	}, [global.hasBeenCorrectlyLoaded, sandpack.files, sandpack.setActiveFile, getItem]);

	useEffect(() => {
		if (!global.hasBeenCorrectlyLoaded) return;
		const activeFile = sandpack.activeFile;
		if (activeFile) {
			saveItem(activeFile);
		}
	}, [global.hasBeenCorrectlyLoaded, sandpack.activeFile, saveItem]);
}

