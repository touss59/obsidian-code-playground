import { describe, expect, it } from "vitest";
import {
	formatCode,
	prettierParserFor,
	readPrettierOptions,
} from "CodePlaygroundBlock/formatCode";

describe("prettierParserFor", () => {
	it("maps file extensions to Prettier parsers", () => {
		expect(prettierParserFor("/App.js")).toBe("babel");
		expect(prettierParserFor("/components/Button.tsx")).toBe("babel-ts");
		expect(prettierParserFor("/styles.CSS")).toBe("css");
		expect(prettierParserFor("/index.html")).toBe("html");
		expect(prettierParserFor("/package.json")).toBe("json");
	});

	it("returns null for unsupported or missing extensions", () => {
		expect(prettierParserFor("/README.md")).toBeNull();
		expect(prettierParserFor("/Makefile")).toBeNull();
		expect(prettierParserFor("/.prettierrc")).toBeNull();
	});
});

describe("readPrettierOptions", () => {
	it("reads allowed options from .prettierrc", () => {
		const options = readPrettierOptions({
			"/.prettierrc": {
				code: JSON.stringify({ semi: false, tabWidth: 4, plugins: ["x"] }),
			},
		});
		expect(options).toEqual({ semi: false, tabWidth: 4 });
	});

	it("falls back to .prettierrc.json", () => {
		const options = readPrettierOptions({
			"/.prettierrc.json": { code: '{ "singleQuote": true }' },
		});
		expect(options).toEqual({ singleQuote: true });
	});

	it("returns no options for a missing or invalid file", () => {
		expect(readPrettierOptions({})).toEqual({});
		expect(readPrettierOptions({ "/.prettierrc": { code: "semi: false" } })).toEqual({});
		expect(readPrettierOptions({ "/.prettierrc": { code: "42" } })).toEqual({});
	});
});

describe("formatCode", () => {
	it("formats JSX and keeps the cursor on the same token", async () => {
		const code = "export default function App(){return <h1 className='x'>Hi</h1>}";
		const cursor = code.indexOf("Hi");
		const result = await formatCode(code, "/App.js", cursor);
		expect(result?.formatted).toBe(
			'export default function App() {\n  return <h1 className="x">Hi</h1>;\n}\n',
		);
		expect(result?.formatted.slice(result.cursorOffset, result.cursorOffset + 2)).toBe("Hi");
	});

	it("formats TypeScript, CSS and HTML", async () => {
		const ts = await formatCode("const a:number=1", "/a.ts", 0);
		expect(ts?.formatted).toBe("const a: number = 1;\n");
		const css = await formatCode("a{color:red}", "/a.css", 0);
		expect(css?.formatted).toBe("a {\n  color: red;\n}\n");
		const html = await formatCode("<div><p>Hi</p></div>", "/index.html", 0);
		expect(html?.formatted).toBe("<div><p>Hi</p></div>\n");
	});

	it("applies the given options", async () => {
		const result = await formatCode('const a = "x";', "/a.js", 0, {
			semi: false,
			singleQuote: true,
		});
		expect(result?.formatted).toBe("const a = 'x'\n");
	});

	it("returns null for unsupported files", async () => {
		expect(await formatCode("# Title", "/README.md", 0)).toBeNull();
	});

	it("throws on syntax errors", async () => {
		await expect(formatCode("const = ;", "/a.js", 0)).rejects.toThrow();
	});
});
