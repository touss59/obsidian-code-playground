import type { PlaygroundLayout } from "config";

/**
 * Heights the user set by dragging a resize handle. An undefined height
 * means "size to the content".
 */
export type ManualHeights = {
	/** Horizontal layout: the editor/preview row. */
	row?: number;
	/** Vertical layout: the editor. */
	editor?: number;
	/** Vertical layout: the preview/console pane. */
	pane?: number;
};

export type BlockSizingInput = {
	layout: PlaygroundLayout;
	hasEditor: boolean;
	minHeight: number;
	maxHeight: number;
	expanded: boolean;
	/** Padded preview document height; 0 while unknown. */
	previewContentHeight: number;
	/** The preview, not the console, fills the pane. */
	previewVisible: boolean;
	/** The code doesn't fit the editor, so the editor scrolls. */
	editorOverflows: boolean;
	manual: ManualHeights;
};

export type BlockSizes = {
	/** Box around the editor. A fixed `height` makes the editor fill it and scroll. */
	editorBox: { minHeight?: number; height?: number };
	/** Bounds on the code editor, which otherwise grows with its code. */
	editor: { minHeight: number; maxHeight?: number };
	/** Fixed pane height, or undefined to stretch the pane to the editor row. */
	paneHeight?: number;
	/**
	 * Show the expand button: content is cut off by the max height, or the
	 * block is expanded and can collapse again.
	 */
	showExpand: boolean;
};

/**
 * Sizes every panel of a block. Each panel follows the first rule that
 * applies:
 *
 * 1. Dragged by the user: the dragged height, with the min as floor.
 * 2. Expanded ("Show more"): size to the content, with no max.
 * 3. Otherwise: size to the content, between the min and the max.
 *
 * Side by side, the editor and the pane share one row. Its content height is
 * the taller of the code and the preview content. Stacked (or without an
 * editor), nothing stretches the pane, so it gets a fixed height.
 *
 * Clipping only offers the expand button for panels without a dragged
 * height: the user chose that height on purpose.
 */
export function computeBlockSizes(input: BlockSizingInput): BlockSizes {
	const { minHeight: min, expanded, manual } = input;
	// Merged configs can end up with min > max (block max below the vault
	// min); the min wins.
	const max = Math.max(input.maxHeight, min);
	const fixed = (height: number) => Math.max(height, min);
	const content = input.previewVisible ? input.previewContentHeight : 0;
	const previewClipped = content > max;

	if (input.layout === "horizontal" && input.hasEditor) {
		if (manual.row !== undefined) {
			return {
				editorBox: { height: fixed(manual.row) },
				editor: { minHeight: 0 },
				showExpand: expanded,
			};
		}
		const showExpand =
			expanded || input.editorOverflows || previewClipped;
		// The editor box min-height carries the preview content into the
		// row height; the pane stretches to the row.
		if (expanded) {
			return {
				editorBox: content > 0 ? { minHeight: content } : {},
				editor: { minHeight: min },
				showExpand,
			};
		}
		return {
			editorBox: content > 0 ? { minHeight: clamp(content, min, max) } : {},
			editor: { minHeight: min, maxHeight: max },
			showExpand,
		};
	}

	const paneManual = input.layout === "horizontal" ? manual.row : manual.pane;
	const editorManual = input.layout === "horizontal" ? undefined : manual.editor;
	const paneHeight =
		paneManual !== undefined
			? fixed(paneManual)
			: contentPaneHeight(content, min, expanded ? Infinity : max);
	const showExpand =
		expanded ||
		(editorManual === undefined && input.editorOverflows) ||
		(paneManual === undefined && previewClipped);

	if (editorManual !== undefined) {
		return {
			editorBox: { height: fixed(editorManual) },
			editor: { minHeight: 0 },
			paneHeight,
			showExpand,
		};
	}
	return {
		editorBox: {},
		editor: expanded ? { minHeight: min } : { minHeight: min, maxHeight: max },
		paneHeight,
		showExpand,
	};
}

/**
 * A content height of 0 means the bundler hasn't reported yet (or never
 * will, e.g. an offline preview); fall back to the min so the pane grows to
 * fit the content instead of showing a tall empty pane that then shrinks.
 */
function contentPaneHeight(content: number, min: number, max: number): number {
	return content > 0 ? clamp(content, min, max) : min;
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(Math.max(value, min), max);
}
