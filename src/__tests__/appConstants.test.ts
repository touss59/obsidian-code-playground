import { describe, it, expect } from "vitest";
import { isValidId, ID_RE } from "../appConstants";

describe("isValidId", () => {
	it("accepts filename-friendly identifiers", () => {
		expect(isValidId("abc123")).toBe(true);
		expect(isValidId("my-block_01")).toBe(true);
		expect(isValidId("A")).toBe(true);
	});

	it("rejects non-string and empty values", () => {
		expect(isValidId(undefined)).toBe(false);
		expect(isValidId(null)).toBe(false);
		expect(isValidId(42)).toBe(false);
		expect(isValidId("")).toBe(false);
	});

	it("rejects path-traversal and unsafe filename characters", () => {
		expect(isValidId("..")).toBe(false);
		expect(isValidId("../secret")).toBe(false);
		expect(isValidId("a/b")).toBe(false);
		expect(isValidId("a\\b")).toBe(false);
		expect(isValidId(".hidden")).toBe(false);
		expect(isValidId("a b")).toBe(false);
		expect(isValidId("a.b")).toBe(false);
	});

	it("ID_RE is anchored at both ends", () => {
		expect(ID_RE.test("ok\n../bad")).toBe(false);
	});
});
