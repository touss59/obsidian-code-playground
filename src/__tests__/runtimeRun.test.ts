import { describe, it, expect } from "vitest";
import {
	formatTimings,
	INITIAL_RUN_STATE,
	reduceRunEvent,
	type RunState,
} from "../CodePlaygroundBlock/Runtime/useRuntimeRun";
import {
	codeFiles,
	withoutPackageJson,
} from "../CodePlaygroundBlock/Runtime/runtimeFiles";
import { RUNTIME_MAX_OUTPUT_LINES } from "../appConstants";

const withOutput: RunState = {
	phase: "done",
	status: "run 3 ms",
	lines: [{ stream: "stdout", text: "old" }],
	truncated: false,
};

describe("reduceRunEvent", () => {
	it("keeps the last output while the run waits, and clears it when it starts", () => {
		const queued = reduceRunEvent(withOutput, { type: "queued" });
		expect(queued.phase).toBe("queued");
		expect(queued.lines).toEqual(withOutput.lines);

		const started = reduceRunEvent(queued, { type: "started" });
		expect(started).toMatchObject({ phase: "running", lines: [] });
	});

	it("appends output and shows the timings when done", () => {
		let state = reduceRunEvent(INITIAL_RUN_STATE, { type: "started" });
		state = reduceRunEvent(state, { type: "output", stream: "stdout", text: "a" });
		state = reduceRunEvent(state, {
			type: "done",
			ok: true,
			timings: { packages: 1.4, run: 12.6 },
		});
		expect(state).toEqual({
			phase: "done",
			status: "packages 1 ms · run 13 ms",
			lines: [{ stream: "stdout", text: "a" }],
			truncated: false,
		});
	});

	it("adds the error to the output as stderr", () => {
		const state = reduceRunEvent(withOutput, {
			type: "done",
			ok: false,
			error: "NameError: x",
			timings: {},
		});
		expect(state.phase).toBe("failed");
		expect(state.status).toBe("Error");
		expect(state.lines.at(-1)).toEqual({ stream: "stderr", text: "NameError: x" });
	});

	it("stops adding lines at the limit", () => {
		const full: RunState = {
			...INITIAL_RUN_STATE,
			lines: Array.from({ length: RUNTIME_MAX_OUTPUT_LINES }, () => ({
				stream: "stdout" as const,
				text: "x",
			})),
		};
		const state = reduceRunEvent(full, { type: "output", stream: "stdout", text: "y" });
		expect(state.lines).toHaveLength(RUNTIME_MAX_OUTPUT_LINES);
		expect(state.truncated).toBe(true);

		const failed = reduceRunEvent(state, {
			type: "done",
			ok: false,
			error: "ZeroDivisionError",
			timings: {},
		});
		expect(failed.lines.at(-1)).toEqual({
			stream: "stderr",
			text: "ZeroDivisionError",
		});
	});
});

describe("formatTimings", () => {
	it("lists the timings in their order", () => {
		expect(formatTimings({ Pyodide: 1840.2, packages: 0, run: 5 })).toBe(
			"Pyodide 1840 ms · packages 0 ms · run 5 ms",
		);
		expect(formatTimings({})).toBe("");
	});
});

describe("runtime files", () => {
	const files = {
		"/main.py": { code: "import util" },
		"/util.py": { code: "x = 1" },
		"/package.json": { code: "{}" },
	};

	it("leaves out Sandpack's /package.json", () => {
		expect(codeFiles(files)).toEqual({
			"/main.py": "import util",
			"/util.py": "x = 1",
		});
		expect(Object.keys(withoutPackageJson(files))).toEqual(["/main.py", "/util.py"]);
	});
});
