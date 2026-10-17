import { describe, it, expect } from "vitest";
import { stackedPaneHeight } from "../CodePlaygroundBlock/stackedPaneHeight";

describe("stackedPaneHeight", () => {
	it("falls back to the cap while the content height is unknown", () => {
		expect(stackedPaneHeight(0, 100, 400, false)).toBe(400);
		expect(stackedPaneHeight(0, 100, 400, true)).toBe(400);
	});

	it("sizes to content within the editor bounds", () => {
		expect(stackedPaneHeight(250, 100, 400, false)).toBe(250);
		expect(stackedPaneHeight(40, 100, 400, false)).toBe(100);
		expect(stackedPaneHeight(900, 100, 400, false)).toBe(400);
	});

	it("lifts the cap when expanded but keeps the floor", () => {
		expect(stackedPaneHeight(900, 100, 400, true)).toBe(900);
		expect(stackedPaneHeight(40, 100, 400, true)).toBe(100);
	});

	it("treats the min as the cap when a merged config has min > max", () => {
		expect(stackedPaneHeight(0, 500, 400, false)).toBe(500);
		expect(stackedPaneHeight(450, 500, 400, false)).toBe(500);
	});
});
