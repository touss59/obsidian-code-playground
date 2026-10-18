import { describe, it, expect } from "vitest";
import {
	computeBlockSizes,
	type BlockSizingInput,
} from "../CodePlaygroundBlock/blockSizes";

const base: BlockSizingInput = {
	layout: "horizontal",
	hasEditor: true,
	minHeight: 100,
	maxHeight: 400,
	expanded: false,
	previewContentHeight: 0,
	previewVisible: true,
	editorOverflows: false,
	manual: {},
};

const sizes = (overrides: Partial<BlockSizingInput>) =>
	computeBlockSizes({ ...base, ...overrides });

describe("computeBlockSizes, side by side", () => {
	it("bounds the editor and stretches the pane to the row", () => {
		expect(sizes({})).toEqual({
			editorBox: {},
			editor: { minHeight: 100, maxHeight: 400 },
			showExpand: false,
		});
	});

	it("lets the preview content set the row height, within the bounds", () => {
		expect(sizes({ previewContentHeight: 250 }).editorBox).toEqual({
			minHeight: 250,
		});
		expect(sizes({ previewContentHeight: 900 }).editorBox).toEqual({
			minHeight: 400,
		});
		expect(sizes({ previewContentHeight: 40 }).editorBox).toEqual({
			minHeight: 100,
		});
	});

	it("ignores the preview content while the console fills the pane", () => {
		const hidden = sizes({ previewContentHeight: 900, previewVisible: false });
		expect(hidden.editorBox).toEqual({});
		expect(hidden.showExpand).toBe(false);
	});

	it("lifts the max when expanded", () => {
		expect(sizes({ expanded: true, previewContentHeight: 900 })).toEqual({
			editorBox: { minHeight: 900 },
			editor: { minHeight: 100 },
			showExpand: true,
		});
	});

	it("uses a dragged row height, with the min as floor", () => {
		expect(sizes({ manual: { row: 250 } })).toEqual({
			editorBox: { height: 250 },
			editor: { minHeight: 0 },
			showExpand: false,
		});
		expect(sizes({ manual: { row: 20 } }).editorBox).toEqual({ height: 100 });
	});

	it("keeps a dragged row height when expanded", () => {
		expect(
			sizes({ expanded: true, manual: { row: 250 } }).editorBox,
		).toEqual({ height: 250 });
	});

	it("gives the pane a fixed height when there is no editor", () => {
		expect(sizes({ hasEditor: false }).paneHeight).toBe(100);
		expect(
			sizes({ hasEditor: false, previewContentHeight: 250 }).paneHeight,
		).toBe(250);
		expect(
			sizes({ hasEditor: false, manual: { row: 300 } }).paneHeight,
		).toBe(300);
	});
});

describe("computeBlockSizes, stacked", () => {
	const stacked = (overrides: Partial<BlockSizingInput>) =>
		sizes({ layout: "vertical", ...overrides });

	it("falls back to the min while the content height is unknown", () => {
		expect(stacked({}).paneHeight).toBe(100);
		expect(stacked({ expanded: true }).paneHeight).toBe(100);
	});

	it("sizes the pane to the content within the bounds", () => {
		expect(stacked({ previewContentHeight: 250 }).paneHeight).toBe(250);
		expect(stacked({ previewContentHeight: 40 }).paneHeight).toBe(100);
		expect(stacked({ previewContentHeight: 900 }).paneHeight).toBe(400);
	});

	it("lifts the cap when expanded but keeps the floor", () => {
		expect(
			stacked({ expanded: true, previewContentHeight: 900 }).paneHeight,
		).toBe(900);
		expect(
			stacked({ expanded: true, previewContentHeight: 40 }).paneHeight,
		).toBe(100);
		expect(stacked({ expanded: true }).editor).toEqual({ minHeight: 100 });
	});

	it("ignores the preview content while the console fills the pane", () => {
		const hidden = stacked({ previewContentHeight: 900, previewVisible: false });
		expect(hidden.paneHeight).toBe(100);
		expect(hidden.showExpand).toBe(false);
		expect(
			stacked({
				expanded: true,
				previewContentHeight: 900,
				previewVisible: false,
			}).paneHeight,
		).toBe(100);
	});

	it("uses dragged editor and pane heights independently", () => {
		expect(stacked({ manual: { editor: 300 } })).toEqual({
			editorBox: { height: 300 },
			editor: { minHeight: 0 },
			paneHeight: 100,
			showExpand: false,
		});
		expect(
			stacked({ previewContentHeight: 250, manual: { pane: 600 } }),
		).toEqual({
			editorBox: {},
			editor: { minHeight: 100, maxHeight: 400 },
			paneHeight: 600,
			showExpand: false,
		});
	});

	it("expands only the panels without a dragged height", () => {
		const result = stacked({
			expanded: true,
			previewContentHeight: 900,
			manual: { editor: 300 },
		});
		expect(result.editorBox).toEqual({ height: 300 });
		expect(result.paneHeight).toBe(900);
	});

	it("ignores the row height", () => {
		expect(stacked({ manual: { row: 300 } }).paneHeight).toBe(100);
	});

	it("treats the min as the cap when a merged config has min > max", () => {
		expect(stacked({ minHeight: 500 }).paneHeight).toBe(500);
		expect(
			stacked({ minHeight: 500, previewContentHeight: 450 }).paneHeight,
		).toBe(500);
		expect(stacked({ minHeight: 500 }).editor).toEqual({
			minHeight: 500,
			maxHeight: 500,
		});
	});
});

describe("computeBlockSizes, expand button", () => {
	it("hides when everything fits", () => {
		expect(sizes({ previewContentHeight: 300 }).showExpand).toBe(false);
		expect(
			sizes({ layout: "vertical", previewContentHeight: 300 }).showExpand,
		).toBe(false);
	});

	it("shows when the code or the preview is cut off", () => {
		expect(sizes({ editorOverflows: true }).showExpand).toBe(true);
		expect(sizes({ previewContentHeight: 900 }).showExpand).toBe(true);
		expect(
			sizes({ hasEditor: false, previewContentHeight: 900 }).showExpand,
		).toBe(true);
		expect(
			sizes({ layout: "vertical", editorOverflows: true }).showExpand,
		).toBe(true);
		expect(
			sizes({ layout: "vertical", previewContentHeight: 900 }).showExpand,
		).toBe(true);
	});

	it("stays while expanded so the block can collapse", () => {
		expect(sizes({ expanded: true }).showExpand).toBe(true);
		expect(sizes({ layout: "vertical", expanded: true }).showExpand).toBe(
			true,
		);
	});

	it("ignores clipping in panels with a dragged height", () => {
		expect(
			sizes({ editorOverflows: true, manual: { row: 200 } }).showExpand,
		).toBe(false);
		expect(
			sizes({
				hasEditor: false,
				previewContentHeight: 900,
				manual: { row: 200 },
			}).showExpand,
		).toBe(false);
		expect(
			sizes({
				layout: "vertical",
				editorOverflows: true,
				manual: { editor: 200 },
			}).showExpand,
		).toBe(false);
		expect(
			sizes({
				layout: "vertical",
				previewContentHeight: 900,
				manual: { pane: 200 },
			}).showExpand,
		).toBe(false);
	});

	it("still shows for a clipped panel next to a dragged one", () => {
		expect(
			sizes({
				layout: "vertical",
				previewContentHeight: 900,
				manual: { editor: 200 },
			}).showExpand,
		).toBe(true);
	});
});
