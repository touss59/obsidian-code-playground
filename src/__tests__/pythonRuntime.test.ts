import { describe, it, expect } from "vitest";
import {
	cleanTraceback,
	pythonRuntime,
} from "../CodePlaygroundBlock/Runtime/python/pythonRuntime";
import { buildWorkerScript } from "../CodePlaygroundBlock/Runtime/workerKernel";
import { getRuntime } from "../CodePlaygroundBlock/Runtime/runtimes";
import { getConfigErrors } from "../config";

describe("pythonRuntime", () => {
	it("is registered as the python template", () => {
		expect(getRuntime("python")).toBe(pythonRuntime);
		expect(getConfigErrors({ id: "py-1", template: "python" })).toEqual([]);
	});

	it("gives a valid worker script", () => {
		expect(() => new Function(buildWorkerScript(pythonRuntime))).not.toThrow();
	});

	it("starts new blocks with its entry file", () => {
		expect(Object.keys(pythonRuntime.starterFiles)).toEqual([pythonRuntime.entry]);
	});
});

describe("getRuntime", () => {
	it("returns nothing for Sandpack templates and object keys", () => {
		expect(getRuntime("react")).toBeUndefined();
		expect(getRuntime("toString")).toBeUndefined();
	});
});

describe("cleanTraceback", () => {
	const folder = "/home/pyodide/playgrounds/b1/";

	it("drops Pyodide's frames and shortens the block's paths", () => {
		const message = [
			"Traceback (most recent call last):",
			'  File "/lib/python313.zip/_pyodide/_base.py", line 597, in eval_code_async',
			"    await CodeRunner(",
			'  File "/lib/python313.zip/_pyodide/_base.py", line 411, in run_async',
			"    coroutine = eval(self.code, globals, locals)",
			"                ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^",
			'  File "/home/pyodide/playgrounds/b1/main.py", line 2, in <module>',
			"    1 / 0",
			"ZeroDivisionError: division by zero",
			"",
		].join("\n");
		expect(cleanTraceback(message, folder)).toBe(
			[
				"Traceback (most recent call last):",
				'  File "main.py", line 2, in <module>',
				"    1 / 0",
				"ZeroDivisionError: division by zero",
			].join("\n"),
		);
	});

	it("keeps a syntax error's caret lines", () => {
		const message = [
			'  File "/lib/python313.zip/_pyodide/_base.py", line 1, in parse',
			"    return ast.parse(source)",
			'  File "/home/pyodide/playgrounds/b1/main.py", line 1',
			"    print(",
			"         ^",
			"SyntaxError: '(' was never closed",
		].join("\n");
		expect(cleanTraceback(message, folder)).toBe(
			[
				'  File "main.py", line 1',
				"    print(",
				"         ^",
				"SyntaxError: '(' was never closed",
			].join("\n"),
		);
	});

	it("leaves other messages unchanged", () => {
		expect(cleanTraceback("Could not load Pyodide.", folder)).toBe(
			"Could not load Pyodide.",
		);
	});
});
