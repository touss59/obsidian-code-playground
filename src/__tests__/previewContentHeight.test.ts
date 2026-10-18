import { describe, it, expect } from "vitest";
import {
	nextContentHeight,
	type PreviewReport,
} from "../CodePlaygroundBlock/previewContentHeight";
import { PREVIEW_HEIGHT_EXTRA_PX as EXTRA } from "../appConstants";

/**
 * Feeds reports through nextContentHeight in order, as the hook does, and
 * returns each content height.
 */
function run(reports: { height: number; viewport: number | null }[]): number[] {
	let prev: PreviewReport | null = null;
	return reports.map((report) => {
		const contentHeight = nextContentHeight(prev, report);
		prev = { ...report, contentHeight };
		return contentHeight;
	});
}

describe("nextContentHeight", () => {
	it("pads a content height that differs from the viewport", () => {
		expect(run([{ height: 250, viewport: 100 }])).toEqual([250 + EXTRA]);
		expect(run([{ height: 50, viewport: 100 }])).toEqual([50 + EXTRA]);
	});

	it("pads when the iframe is not found", () => {
		expect(run([{ height: 250, viewport: null }])).toEqual([250 + EXTRA]);
	});

	it("uses a first report equal to the viewport unpadded", () => {
		// Content that fills the viewport, or content of exactly that height.
		expect(run([{ height: 300, viewport: 300 }])).toEqual([300]);
	});

	it("stays stable for min-height: 100vh content taller than the pane", () => {
		// The pane grows to the padded height, and the document then fills
		// the new viewport. The content height must not change.
		expect(
			run([
				{ height: 500, viewport: 300 },
				{ height: 500 + EXTRA, viewport: 500 + EXTRA },
			]),
		).toEqual([500 + EXTRA, 500 + EXTRA]);
	});

	it("keeps the content height when the pane collapses and expands again", () => {
		expect(
			run([
				{ height: 900, viewport: 400 },
				{ height: 900 + EXTRA, viewport: 900 + EXTRA },
				{ height: 900, viewport: 400 },
			]),
		).toEqual([900 + EXTRA, 900 + EXTRA, 900 + EXTRA]);
	});

	it("drops content that follows the viewport with margins", () => {
		// height: 100vh with the default 8px body margin.
		expect(
			run([
				{ height: 316, viewport: 300 },
				{ height: 316 + 16 + EXTRA, viewport: 316 + EXTRA },
				{ height: 116, viewport: 100 },
			]),
		).toEqual([316 + EXTRA, 0, 0]);
	});

	it("drops height: 100% content once the viewport changes", () => {
		expect(
			run([
				{ height: 300, viewport: 300 },
				{ height: 500, viewport: 500 },
			]),
		).toEqual([300, 0]);
	});

	it("uses new content after a viewport-following report", () => {
		expect(
			run([
				{ height: 300, viewport: 300 },
				{ height: 500, viewport: 500 },
				{ height: 800, viewport: 500 },
			]),
		).toEqual([300, 0, 800 + EXTRA]);
	});
});
