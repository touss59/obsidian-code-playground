import type { SandpackBundlerFiles } from "@codesandbox/sandpack-client";
import { useSandpack } from "@codesandbox/sandpack-react";
import {
	autocompletion,
	closeCompletion,
	completionStatus,
} from "@codemirror/autocomplete";
import { codeFolding, foldGutter, foldKeymap } from "@codemirror/language";
import {
	closeSearchPanel,
	highlightSelectionMatches,
	search,
	searchKeymap,
	searchPanelOpen,
} from "@codemirror/search";
import { EditorState, Prec, type Extension } from "@codemirror/state";
import {
	crosshairCursor,
	drawSelection,
	EditorView,
	keymap,
	rectangularSelection,
	ViewPlugin,
} from "@codemirror/view";
import { Notice, Scope, type App } from "obsidian";
import { useMemo, useRef } from "react";
import { useAppContext } from "CodePlaygroundBlock/AppContextProvider";
import {
	formatCode,
	prettierParserFor,
	readPrettierOptions,
} from "CodePlaygroundBlock/formatCode";

type FormatTarget = { path: string; files: SandpackBundlerFiles };

/**
 * Formats the editor content with Prettier, in place. One undo step reverts
 * it. Does nothing if the user types while Prettier runs. With `quiet`, a
 * failure shows no notice.
 */
export async function formatEditor(
	view: EditorView,
	{ path, files }: FormatTarget,
	{ quiet = false }: { quiet?: boolean } = {},
): Promise<void> {
	const code = view.state.doc.toString();
	let result: Awaited<ReturnType<typeof formatCode>>;
	try {
		result = await formatCode(
			code,
			path,
			view.state.selection.main.head,
			readPrettierOptions(files),
		);
	} catch (error) {
		if (quiet) return;
		const message = error instanceof Error ? error.message : String(error);
		new Notice(`Could not format ${path}: ${message.split("\n")[0]}`);
		return;
	}
	if (!result) {
		if (!quiet) new Notice(`No formatter for ${path}.`);
		return;
	}
	if (view.state.doc.toString() !== code || result.formatted === code) return;
	view.dispatch({
		changes: { from: 0, to: code.length, insert: result.formatted },
		selection: {
			// Prettier reports -1 when it could not place the cursor.
			anchor: Math.max(
				0,
				Math.min(result.cursorOffset, result.formatted.length),
			),
		},
		scrollIntoView: true,
		userEvent: "format",
	});
}

/**
 * Obsidian handles Escape in its own scope, even after CodeMirror used the
 * key. So Escape in a modal closes the search panel and the modal too. While
 * the search panel or the autocomplete list is open, this pushes a scope
 * above `parent`. That scope closes them and keeps Escape from `parent`.
 */
function escapeClosesPanelsFirst(app: App, parent: Scope): Extension {
	// "pending" shows no list yet, so Escape must still close the modal.
	const panelOpen = (state: EditorState) =>
		searchPanelOpen(state) || completionStatus(state) === "active";

	return ViewPlugin.fromClass(
		class {
			private scope: Scope | null = null;
			private popTimer: number | undefined;

			constructor(private view: EditorView) {
				this.sync();
			}

			update() {
				this.sync();
			}

			destroy() {
				window.clearTimeout(this.popTimer);
				this.pop();
			}

			private sync() {
				if (panelOpen(this.view.state)) {
					window.clearTimeout(this.popTimer);
					if (!this.scope) this.push();
				} else if (this.scope) {
					// CodeMirror can close the panel on this Escape before
					// Obsidian sees the key. Keep the scope until the key
					// event is over, so that Obsidian ignores it.
					window.clearTimeout(this.popTimer);
					this.popTimer = window.setTimeout(() => this.pop());
				}
			}

			private push() {
				const scope = new Scope(parent);
				scope.register(null, "Escape", () => {
					closeSearchPanel(this.view);
					closeCompletion(this.view);
					return false;
				});
				app.keymap.pushScope(scope);
				this.scope = scope;
			}

			private pop() {
				if (!this.scope) return;
				app.keymap.popScope(this.scope);
				this.scope = null;
			}
		},
	);
}

/**
 * Sandpack's editor already has syntax colors, undo, bracket matching and
 * Tab indent. This adds search, folding, multi-cursor, autocomplete and the
 * format keys, styled with the Sandpack theme colors.
 */
function buildEditorExtensions(options: {
	autocomplete: boolean;
	getFormatTarget: () => FormatTarget & { formatOnSave: boolean };
	escape?: { app: App; parent: Scope };
}): Extension[] {
	const format = (view: EditorView, quiet = false) => {
		void formatEditor(view, options.getFormatTarget(), { quiet });
		return true;
	};
	return [
		EditorState.allowMultipleSelections.of(true),
		drawSelection(),
		rectangularSelection(),
		crosshairCursor(),
		highlightSelectionMatches(),
		search({ top: true }),
		codeFolding(),
		foldGutter(),
		...(options.autocomplete ? [autocompletion()] : []),
		...(options.escape
			? [escapeClosesPanelsFirst(options.escape.app, options.escape.parent)]
			: []),
		// Keep these above Sandpack's own keymap (Escape, Tab), whatever
		// order Sandpack gives the two lists.
		Prec.high(
			keymap.of([
				...searchKeymap,
				...foldKeymap,
				{ key: "Shift-Alt-f", run: (view) => format(view) },
				{
					// A save by habit must not show a notice: on a file type
					// with no formatter or on code with a syntax error.
					key: "Mod-s",
					run: (view) => {
						const target = options.getFormatTarget();
						return (
							target.formatOnSave &&
							prettierParserFor(target.path) !== null &&
							format(view, true)
						);
					},
				},
			]),
		),
		editorTheme,
	];
}

const editorTheme = EditorView.theme({
	".cm-cursor, .cm-dropCursor": {
		borderLeftColor: "var(--sp-colors-accent)",
	},
	"&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection":
		{
			backgroundColor:
				"color-mix(in srgb, var(--sp-colors-accent) 25%, transparent)",
		},
	".cm-selectionMatch": {
		backgroundColor:
			"color-mix(in srgb, var(--sp-colors-accent) 15%, transparent)",
	},
	".cm-searchMatch": {
		backgroundColor:
			"color-mix(in srgb, var(--sp-colors-warning) 30%, transparent)",
		outline: "none",
	},
	".cm-searchMatch.cm-searchMatch-selected": {
		backgroundColor:
			"color-mix(in srgb, var(--sp-colors-warning) 60%, transparent)",
	},
	".cm-panels": {
		backgroundColor: "var(--sp-colors-surface2)",
		color: "var(--sp-colors-base)",
	},
	".cm-panels.cm-panels-top": {
		borderBottom: "1px solid var(--sp-colors-surface3)",
	},
	".cm-panel.cm-search input, .cm-panel.cm-search button, .cm-panel.cm-search label":
		{
			fontSize: "12px",
		},
	".cm-textfield": {
		backgroundColor: "var(--sp-colors-surface1)",
		color: "var(--sp-colors-base)",
		border: "1px solid var(--sp-colors-surface3)",
	},
	".cm-button": {
		backgroundImage: "none",
		backgroundColor: "var(--sp-colors-surface3)",
		color: "var(--sp-colors-base)",
		border: "none",
	},
	".cm-tooltip": {
		backgroundColor: "var(--sp-colors-surface2)",
		color: "var(--sp-colors-base)",
		border: "1px solid var(--sp-colors-surface3)",
	},
	".cm-tooltip-autocomplete > ul > li[aria-selected]": {
		backgroundColor: "var(--sp-colors-accent)",
		color: "var(--sp-colors-surface1)",
	},
	".cm-foldPlaceholder": {
		backgroundColor: "var(--sp-colors-surface3)",
		color: "var(--sp-colors-base)",
		border: "none",
	},
	".cm-foldGutter .cm-gutterElement": {
		cursor: "pointer",
	},
});

/**
 * Editor extensions for one editor. The array stays the same for the
 * editor's life: Sandpack appends a new array to the editor config instead
 * of replacing the old one. Remount the editor when `autocomplete` changes.
 * `escapeScope` must stay the same for the editor's life.
 */
export function useEditorExtensions(escapeScope?: Scope): Extension[] {
	const { sandpack } = useSandpack();
	const { value: global } = useAppContext();
	const targetRef = useRef({
		path: sandpack.activeFile,
		files: sandpack.files,
		formatOnSave: global.config.formatOnSave,
	});
	targetRef.current = {
		path: sandpack.activeFile,
		files: sandpack.files,
		formatOnSave: global.config.formatOnSave,
	};
	const { autocomplete } = global.config;
	const app = global.ObsidianApp;
	return useMemo(
		() =>
			buildEditorExtensions({
				autocomplete,
				getFormatTarget: () => targetRef.current,
				escape: escapeScope && { app, parent: escapeScope },
			}),
		[autocomplete, app, escapeScope],
	);
}
