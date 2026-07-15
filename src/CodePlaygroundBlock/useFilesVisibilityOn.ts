import { useSandpack } from "@codesandbox/sandpack-react";
import { useRef, useEffect } from "react";
import { useStorage } from "CodePlaygroundBlock/useStorage";

export function useFilesVisibilityOn() {
	const { sandpack } = useSandpack();
	const filesStorage = useStorage("files");
	const hiddenStorage = useStorage("hiddenFiles");
	const savedCodeRef = useRef(filesStorage.getItem());
	const savedHiddenRef = useRef(hiddenStorage.getItem());
	const ranRef = useRef(false);

	useEffect(() => {
		if (ranRef.current) return;
		ranRef.current = true;

		const originalActiveFile = sandpack.activeFile;

		// Template files like /package.json live in state.files but are
		// kept out of state.visibleFiles by getSandpackStateFromProps when
		// the user-supplied files prop is empty. Promote them to tabs by
		// calling openFile per path. openFile sets activeFile as a side
		// effect, so restore the original at the end.
		if (!savedCodeRef.current) {
			for (const path of Object.keys(sandpack.files)) {
				sandpack.openFile(path);
			}
		}

		// Reapply persisted hidden state. Must run after the promotion
		// pass so closeFile actually flips the file out of visibleFiles.
		for (const path of savedHiddenRef.current ?? []) {
			if (sandpack.files[path]) {
				sandpack.closeFile(path);
			}
		}

		if (originalActiveFile) sandpack.setActiveFile(originalActiveFile);
	}, [sandpack]);
}
