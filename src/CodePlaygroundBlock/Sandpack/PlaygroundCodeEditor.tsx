import { SandpackCodeEditor, type CodeEditorRef } from "@codesandbox/sandpack-react";
import type { Scope } from "obsidian";
import { forwardRef, type CSSProperties } from "react";
import { useAppContext } from "CodePlaygroundBlock/AppContextProvider";
import { useEditorExtensions } from "CodePlaygroundBlock/Sandpack/editorExtensions";

/** Sandpack's code editor with the editor settings and extensions applied. */
export const PlaygroundCodeEditor = forwardRef<
	CodeEditorRef,
	{
		style?: CSSProperties;
		/**
		 * The Obsidian scope that handles Escape around the editor, e.g. a
		 * modal's. Escape closes the editor's search or autocomplete first.
		 */
		escapeScope?: Scope;
	}
>(function PlaygroundCodeEditor({ style, escapeScope }, ref) {
	const { value: global } = useAppContext();
	const { showFileTabs, showLineNumbers, showInlineErrors, wrapLines, autocomplete } =
		global.config;
	const extensions = useEditorExtensions(escapeScope);

	return (
		<SandpackCodeEditor
			// Sandpack never removes extensions, so a new set needs a new
			// editor. It also applies showInlineErrors only when it creates
			// the editor, so a change needs a new editor too.
			key={`${autocomplete ? "autocomplete" : "plain"}-${
				showInlineErrors ? "inline-errors" : "no-inline-errors"
			}`}
			ref={ref}
			showTabs={showFileTabs}
			closableTabs={true}
			showLineNumbers={showLineNumbers}
			showInlineErrors={showInlineErrors}
			wrapContent={wrapLines}
			extensions={extensions}
			style={style}
		/>
	);
});
