import { describe, it, expect } from "vitest";
import {
	HEX_COLOR_RE,
	isHttpUrl,
	isSafeVaultFolder,
	isValidPlaygroundFilePath,
} from "../validators";

describe("HEX_COLOR_RE", () => {
	it("accepts 3- and 6-digit hex colors, case-insensitive", () => {
		expect(HEX_COLOR_RE.test("#fff")).toBe(true);
		expect(HEX_COLOR_RE.test("#FFFFFF")).toBe(true);
		expect(HEX_COLOR_RE.test("#1a2B3c")).toBe(true);
	});

	it("rejects malformed colors", () => {
		expect(HEX_COLOR_RE.test("fff")).toBe(false);
		expect(HEX_COLOR_RE.test("#ff")).toBe(false);
		expect(HEX_COLOR_RE.test("#ffff")).toBe(false);
		expect(HEX_COLOR_RE.test("#gggggg")).toBe(false);
		expect(HEX_COLOR_RE.test("red")).toBe(false);
	});
});

describe("isHttpUrl", () => {
	it("accepts absolute http(s) URLs, including localhost/LAN", () => {
		expect(isHttpUrl("https://my-bundler.example.com")).toBe(true);
		expect(isHttpUrl("https://5-1-0-sandpack.codesandbox.io")).toBe(true);
		expect(isHttpUrl("http://localhost:3000")).toBe(true);
		expect(isHttpUrl("http://192.168.1.10:8080/bundler")).toBe(true);
	});

	it("rejects empty, relative, and malformed input", () => {
		expect(isHttpUrl("")).toBe(false);
		expect(isHttpUrl("my-bundler.example.com")).toBe(false);
		expect(isHttpUrl("/relative/path")).toBe(false);
		expect(isHttpUrl("not a url")).toBe(false);
	});

	it("rejects non-http(s) schemes", () => {
		expect(isHttpUrl("javascript:alert(1)")).toBe(false);
		expect(isHttpUrl("data:text/html,<script>1</script>")).toBe(false);
		expect(isHttpUrl("file:///etc/passwd")).toBe(false);
		expect(isHttpUrl("ftp://example.com")).toBe(false);
	});

	it("rejects a disallowed scheme even with surrounding whitespace", () => {
		// new URL() trims leading/trailing whitespace, so the scheme check
		// still has to catch a smuggled javascript: URL.
		expect(isHttpUrl("  javascript:alert(1)  ")).toBe(false);
	});
});

describe("isSafeVaultFolder", () => {
	it("accepts plain and nested vault-relative folders", () => {
		expect(isSafeVaultFolder("_playgrounds")).toBe(true);
		expect(isSafeVaultFolder("a/b")).toBe(true);
		expect(isSafeVaultFolder("notes/sub/playgrounds")).toBe(true);
		// A name that merely starts with dots is not a traversal segment.
		expect(isSafeVaultFolder("..dotdot-prefixed-name")).toBe(true);
		// Backslash nesting is normalized later by normalizePath.
		expect(isSafeVaultFolder("a\\b")).toBe(true);
	});

	it("rejects traversal segments", () => {
		expect(isSafeVaultFolder(".")).toBe(false);
		expect(isSafeVaultFolder("..")).toBe(false);
		expect(isSafeVaultFolder("../outside")).toBe(false);
		expect(isSafeVaultFolder("a/../b")).toBe(false);
		expect(isSafeVaultFolder("a/..")).toBe(false);
		expect(isSafeVaultFolder("./a")).toBe(false);
	});

	it("rejects absolute paths", () => {
		expect(isSafeVaultFolder("/abs")).toBe(false);
		expect(isSafeVaultFolder("\\\\server/share")).toBe(false);
		expect(isSafeVaultFolder("C:/x")).toBe(false);
		expect(isSafeVaultFolder("c:\\x")).toBe(false);
	});

	it("rejects empty values and empty segments", () => {
		expect(isSafeVaultFolder("")).toBe(false);
		expect(isSafeVaultFolder("a//b")).toBe(false);
		expect(isSafeVaultFolder("a/")).toBe(false);
	});
});

describe("isValidPlaygroundFilePath", () => {
	it("accepts leading-slash paths with an extension", () => {
		expect(isValidPlaygroundFilePath("/App.js")).toBe(true);
		expect(isValidPlaygroundFilePath("/src/App.tsx")).toBe(true);
		expect(isValidPlaygroundFilePath("/styles/main.css")).toBe(true);
		// A name that merely starts with dots is not a traversal segment.
		expect(isValidPlaygroundFilePath("/.eslintrc.json")).toBe(true);
	});

	it("rejects paths without a leading slash or extension", () => {
		expect(isValidPlaygroundFilePath("App.js")).toBe(false);
		expect(isValidPlaygroundFilePath("/App")).toBe(false);
		expect(isValidPlaygroundFilePath("/src/")).toBe(false);
	});

	it("rejects traversal and empty segments", () => {
		expect(isValidPlaygroundFilePath("/../App.js")).toBe(false);
		expect(isValidPlaygroundFilePath("/src/../App.js")).toBe(false);
		expect(isValidPlaygroundFilePath("/./App.js")).toBe(false);
		expect(isValidPlaygroundFilePath("//App.js")).toBe(false);
		expect(isValidPlaygroundFilePath("")).toBe(false);
	});

	it("rejects backslashes", () => {
		expect(isValidPlaygroundFilePath("/src\\App.js")).toBe(false);
		expect(isValidPlaygroundFilePath("\\App.js")).toBe(false);
	});
});
