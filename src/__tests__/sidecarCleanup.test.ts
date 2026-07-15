import { describe, it, expect } from "vitest";
import type { TFile } from "obsidian";
import {
	collectUsedBlockIds,
	findOrphanIds,
	parseSidecarBasename,
	type VaultLike,
} from "../sidecarCleanup";

describe("parseSidecarBasename", () => {
	it("extracts valid ids from .json basenames", () => {
		expect(parseSidecarBasename("abc.json")).toBe("abc");
		expect(parseSidecarBasename("UUID-x_1.json")).toBe("UUID-x_1");
	});

	it("rejects foreign or malformed basenames", () => {
		expect(parseSidecarBasename("notes.txt")).toBeNull();
		expect(parseSidecarBasename("we.ird.json")).toBeNull();
		expect(parseSidecarBasename(".json")).toBeNull();
		expect(parseSidecarBasename("abc.tmp")).toBeNull();
		expect(parseSidecarBasename("abc.json.tmp")).toBeNull();
	});
});

describe("findOrphanIds", () => {
	it("excludes used ids and ignores foreign files", () => {
		const files = [
			"orphan.json",
			"used.json",
			"stray.json.tmp",
			"notes.txt",
			"we.ird.json",
		];
		expect(findOrphanIds(files, new Set(["used"]))).toEqual(["orphan"]);
	});

	it("returns a sorted list", () => {
		const files = ["zzz.json", "aaa.json", "mmm.json"];
		expect(findOrphanIds(files, new Set())).toEqual([
			"aaa",
			"mmm",
			"zzz",
		]);
	});
});

describe("collectUsedBlockIds", () => {
	function file(path: string, extension: string): TFile {
		return { path, extension } as TFile;
	}

	function makeVault(contents: Record<string, string>): VaultLike {
		const paths = Object.keys(contents);
		return {
			getMarkdownFiles: () =>
				paths
					.filter((p) => p.endsWith(".md"))
					.map((p) => file(p, "md")),
			getFiles: () =>
				paths.map((p) => file(p, p.split(".").pop() ?? "")),
			cachedRead: (f: TFile) => {
				const text = contents[f.path];
				if (text === undefined) {
					return Promise.reject(new Error(`missing ${f.path}`));
				}
				return Promise.resolve(text);
			},
		};
	}

	const block = (id: string) =>
		["```codePlayground", `{ "id": "${id}" }`, "```"].join("\n");

	it("unions ids across markdown files and canvas text nodes", async () => {
		const vault = makeVault({
			"a.md": block("md-one"),
			"b.md": `intro\n${block("md-two")}\noutro`,
			"board.canvas": JSON.stringify({
				nodes: [
					{ type: "text", text: block("canvas-one") },
					{ type: "file", file: "a.md" },
					{ type: "text", text: "no blocks here" },
				],
			}),
		});
		expect(await collectUsedBlockIds(vault)).toEqual(
			new Set(["md-one", "md-two", "canvas-one"]),
		);
	});

	it("skips malformed canvas files", async () => {
		const vault = makeVault({
			"a.md": block("md-one"),
			"broken.canvas": "not json",
			"odd.canvas": JSON.stringify({ nodes: "not an array" }),
		});
		expect(await collectUsedBlockIds(vault)).toEqual(new Set(["md-one"]));
	});

	it("rejects when any file read fails (fail-closed)", async () => {
		const vault = makeVault({ "a.md": block("md-one") });
		vault.cachedRead = () => Promise.reject(new Error("io error"));
		await expect(collectUsedBlockIds(vault)).rejects.toThrow("io error");
	});
});
