import { describe, it, expect } from "vitest";
import {
	getConfigErrors,
	isPlaygroundLayout,
	VALID_CONFIG_KEYS,
} from "../config";

const base = { id: "block-1", template: "react" };

describe("layout config key", () => {
	it("is an accepted per-block key", () => {
		expect(VALID_CONFIG_KEYS).toContain("layout");
		expect(getConfigErrors({ ...base, layout: "horizontal" })).toEqual([]);
		expect(getConfigErrors({ ...base, layout: "vertical" })).toEqual([]);
	});

	it("rejects unknown layout values and non-strings", () => {
		expect(getConfigErrors({ ...base, layout: "stacked" })).toEqual([
			"invalid_layout",
		]);
		expect(getConfigErrors({ ...base, layout: true })).toEqual([
			"invalid_layout",
		]);
	});

	it("is optional", () => {
		expect(getConfigErrors(base)).toEqual([]);
	});
});

describe("isPlaygroundLayout", () => {
	it("narrows to the two supported layouts", () => {
		expect(isPlaygroundLayout("horizontal")).toBe(true);
		expect(isPlaygroundLayout("vertical")).toBe(true);
		expect(isPlaygroundLayout("Vertical")).toBe(false);
		expect(isPlaygroundLayout(undefined)).toBe(false);
	});
});
