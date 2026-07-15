import { describe, it, expect } from "vitest";
import type { Editor, EditorChange } from "obsidian";
import { collectBlockIds, scanForMissingIds, __test } from "../idInjector";
import { ID_RE } from "../appConstants";

const { scanEditorForFences } = __test;

type StubEditor = Editor & { transactions: EditorChange[][] };

function makeEditor(lines: string[]): StubEditor {
	const transactions: EditorChange[][] = [];
	return {
		lineCount: () => lines.length,
		getLine: (i: number) => lines[i] ?? "",
		transaction: (tx: { changes?: EditorChange[] }) => {
			transactions.push(tx.changes ?? []);
		},
		transactions,
	} as unknown as StubEditor;
}

describe("scanEditorForFences", () => {
	it("finds top-level codePlayground fences", () => {
		const editor = makeEditor([
			"# Note",
			"```codePlayground",
			'{ "template": "react" }',
			"```",
		]);
		const fences = scanEditorForFences(editor);
		expect(fences).toHaveLength(1);
		expect(fences[0]!.body).toBe('{ "template": "react" }');
		expect(fences[0]!.bodyFrom).toEqual({ line: 2, ch: 0 });
		expect(fences[0]!.bodyTo).toEqual({ line: 3, ch: 0 });
	});

	it("finds top-level code-playground (kebab-case alias) fences", () => {
		const editor = makeEditor([
			"# Note",
			"```code-playground",
			'{ "template": "react" }',
			"```",
		]);
		const fences = scanEditorForFences(editor);
		expect(fences).toHaveLength(1);
		expect(fences[0]!.body).toBe('{ "template": "react" }');
	});

	it("skips a codePlayground example nested in a longer-marker fence", () => {
		const editor = makeEditor([
			"````markdown",
			"```codePlayground",
			"```",
			"````",
		]);
		expect(scanEditorForFences(editor)).toHaveLength(0);
	});

	it("skips a codePlayground example nested in a tilde fence", () => {
		const editor = makeEditor([
			"~~~markdown",
			"```codePlayground",
			"```",
			"~~~",
		]);
		expect(scanEditorForFences(editor)).toHaveLength(0);
	});

	it("accepts a longer closing marker but not a shorter one", () => {
		const editor = makeEditor([
			"````codePlayground",
			"```",
			"````",
			"```codePlayground",
			"````",
		]);
		const fences = scanEditorForFences(editor);
		expect(fences).toHaveLength(2);
		// The inner ``` line is content of the 4-backtick fence, not a close.
		expect(fences[0]!.body).toBe("```");
	});

	it("ignores an unterminated fence", () => {
		const editor = makeEditor(["```codePlayground", '{ "a": 1 }']);
		expect(scanEditorForFences(editor)).toHaveLength(0);
	});
});

describe("scanForMissingIds", () => {
	const doc = [
		"```codePlayground",
		"```",
		"",
		"```codePlayground",
		"{",
		'  "template": "react"',
		"}",
		"```",
	];

	it("emptyFencesOnly seeds empty fences and leaves id-less JSON alone", () => {
		const editor = makeEditor(doc);
		scanForMissingIds(
			editor,
			{ template: "react" },
			{ emptyFencesOnly: true },
		);
		expect(editor.transactions).toHaveLength(1);
		const changes = editor.transactions[0]!;
		expect(changes).toHaveLength(1);
		expect(changes[0]!.from).toEqual({ line: 1, ch: 0 });
		const seeded = JSON.parse(changes[0]!.text!) as Record<string, unknown>;
		expect(seeded.template).toBe("react");
		expect(ID_RE.test(seeded.id as string)).toBe(true);
	});

	it("full scan (manual command) also rewrites id-less JSON blocks", () => {
		const editor = makeEditor(doc);
		scanForMissingIds(editor, { template: "react" });
		expect(editor.transactions).toHaveLength(1);
		const changes = editor.transactions[0]!;
		expect(changes).toHaveLength(2);
		const rewritten = JSON.parse(changes[1]!.text!) as Record<
			string,
			unknown
		>;
		expect(rewritten.template).toBe("react");
		expect(ID_RE.test(rewritten.id as string)).toBe(true);
	});

	it("seeds an empty code-playground (kebab-case alias) fence", () => {
		const editor = makeEditor(["```code-playground", "```"]);
		scanForMissingIds(
			editor,
			{ template: "react" },
			{ emptyFencesOnly: true },
		);
		expect(editor.transactions).toHaveLength(1);
		const changes = editor.transactions[0]!;
		expect(changes).toHaveLength(1);
		const seeded = JSON.parse(changes[0]!.text!) as Record<string, unknown>;
		expect(seeded.template).toBe("react");
		expect(ID_RE.test(seeded.id as string)).toBe(true);
	});

	it("makes no transaction when blocks have ids or are malformed", () => {
		const editor = makeEditor([
			"```codePlayground",
			'{ "id": "abc", "template": "react" }',
			"```",
			"```codePlayground",
			"not json",
			"```",
		]);
		scanForMissingIds(editor, { template: "react" });
		expect(editor.transactions).toHaveLength(0);
	});
});

describe("collectBlockIds", () => {
	it("collects valid ids and skips id-less, malformed and invalid-id blocks", () => {
		const text = [
			"```codePlayground",
			'{ "id": "abc-123", "template": "react" }',
			"```",
			"```codePlayground",
			'{ "template": "react" }',
			"```",
			"```codePlayground",
			"not json",
			"```",
			"```codePlayground",
			'{ "id": "a b" }',
			"```",
		].join("\n");
		expect(collectBlockIds(text)).toEqual(new Set(["abc-123"]));
	});

	it("collects ids from code-playground (kebab-case alias) fences", () => {
		const text = [
			"```code-playground",
			'{ "id": "kebab-id", "template": "react" }',
			"```",
		].join("\n");
		expect(collectBlockIds(text)).toEqual(new Set(["kebab-id"]));
	});

	it("ignores a codePlayground example nested in a longer-marker fence", () => {
		const text = [
			"````markdown",
			"```codePlayground",
			'{ "id": "nested" }',
			"```",
			"````",
		].join("\n");
		expect(collectBlockIds(text).size).toBe(0);
	});

	it("handles tilde fences", () => {
		const text = ["~~~codePlayground", '{ "id": "tilde-id" }', "~~~"].join(
			"\n",
		);
		expect(collectBlockIds(text)).toEqual(new Set(["tilde-id"]));
	});

	it("handles CRLF line endings", () => {
		const text = [
			"```codePlayground",
			'{ "id": "crlf-id" }',
			"```",
		].join("\r\n");
		expect(collectBlockIds(text)).toEqual(new Set(["crlf-id"]));
	});

	it("deduplicates the same id across fences", () => {
		const text = [
			"```codePlayground",
			'{ "id": "dup" }',
			"```",
			"```codePlayground",
			'{ "id": "dup" }',
			"```",
		].join("\n");
		expect(collectBlockIds(text)).toEqual(new Set(["dup"]));
	});

	it("returns an empty set for empty text and unterminated fences", () => {
		expect(collectBlockIds("").size).toBe(0);
		expect(
			collectBlockIds('```codePlayground\n{ "id": "open" }').size,
		).toBe(0);
	});
});
