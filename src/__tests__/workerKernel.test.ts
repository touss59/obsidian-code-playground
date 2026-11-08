import { describe, it, expect } from "vitest";
import { buildWorkerScript } from "../CodePlaygroundBlock/Runtime/workerKernel";
import type { PlaygroundRuntime } from "../CodePlaygroundBlock/Runtime/PlaygroundRuntime";
import { RUNTIME_MAX_OUTPUT_LINES } from "../appConstants";

type Message = { type: string; runId: number; [key: string]: unknown };

/**
 * Runs the kernel with a fake runtime in the test, in place of a worker.
 * `globals` adds properties to the worker's `self`.
 * `run` sends a job and resolves with the messages up to "done".
 * `run.cancel` cancels a job.
 */
function startKernel(workerSource: string, globals: Record<string, unknown> = {}) {
	const runtime: PlaygroundRuntime = {
		template: "fake",
		engineName: "Fake",
		entry: "/main.fake",
		starterFiles: {},
		workerSource,
	};
	let messages: Message[] = [];
	let resolveDone: (messages: Message[]) => void = () => {};
	const self: {
		postMessage: (m: Message) => void;
		onmessage?: (event: { data: unknown }) => void;
	} = {
		...globals,
		postMessage(m) {
			messages.push(m);
			if (m.type === "done") resolveDone(messages);
		},
	};
	new Function("self", buildWorkerScript(runtime))(self);

	let runId = 0;
	const run = (files: Record<string, string>, blockId = "b1") =>
		new Promise<Message[]>((resolve) => {
			messages = [];
			resolveDone = resolve;
			self.onmessage?.({ data: { type: "run", runId: ++runId, blockId, files } });
		});
	const cancel = (cancelled: number) =>
		self.onmessage?.({ data: { type: "cancel", runId: cancelled } });
	return Object.assign(run, { cancel });
}

const outputs = (messages: Message[]) =>
	messages
		.filter((m) => m.type === "output")
		.map((m) => `${String(m.stream)}:${String(m.text)}`);
const done = (messages: Message[]) => messages[messages.length - 1]!;
/** The smallest job that runs: the fake runtime's entry file only. */
const entryOnly = { "/main.fake": "" };

describe("buildWorkerScript", () => {
	describe("refuses to run in a worker that can reach Node.js", () => {
		const source = `
			let loads = 0;
			async function load() { loads += 1; return {}; }
			async function execute() { output.text("stdout", "ran\\n"); }
		`;

		it.each([
			["require", { require: () => ({}) }],
			["process", { process: { versions: { node: "22.0.0" } } }],
		])("with Node's %s", async (_name, globals) => {
			const run = startKernel(source, globals);
			const messages = await run(entryOnly);
			expect(messages).toHaveLength(1);
			expect(done(messages)).toMatchObject({ ok: false, fatal: true });
			expect(done(messages).error).toContain("can reach Node.js");
		});

		it("but runs with a browser-like process object", async () => {
			const run = startKernel(source, { process: { env: {} } });
			expect(outputs(await run(entryOnly))).toEqual(["stdout:ran"]);
		});
	});

	it("splits output into lines and sends a partial line at the end of its run", async () => {
		const run = startKernel(`
			async function load() { return {}; }
			async function execute(engine, job) {
				output.text("stdout", "a\\nb");
				output.text("stdout", "c\\n");
				output.bytes("stderr", new TextEncoder().encode("err"));
				output.text("stdout", job.files[ENTRY]);
			}
		`);
		const first = await run({ "/main.fake": "partial" });
		expect(outputs(first)).toEqual([
			"stdout:a",
			"stdout:bc",
			"stdout:partial",
			"stderr:err",
		]);
		const second = await run({ "/main.fake": "" });
		expect(outputs(second)).toEqual(["stdout:a", "stdout:bc", "stderr:err"]);
	});

	it("sends one line past the limit per run, then drops the rest", async () => {
		const run = startKernel(`
			async function load() { return {}; }
			async function execute(engine, job) {
				const count = Number(job.files[ENTRY]);
				for (let i = 0; i < count; i++) output.text("stdout", i + "\\n");
				output.text("stderr", "partial");
			}
		`);
		const flooded = await run({ "/main.fake": String(RUNTIME_MAX_OUTPUT_LINES + 50) });
		const lines = outputs(flooded);
		expect(lines).toHaveLength(RUNTIME_MAX_OUTPUT_LINES + 1);
		expect(lines[0]).toBe("stdout:0");
		expect(lines[RUNTIME_MAX_OUTPUT_LINES]).toBe(`stdout:${RUNTIME_MAX_OUTPUT_LINES}`);
		expect(done(flooded)).toMatchObject({ ok: true });

		// The limit is per run: the next run sends its lines again.
		expect(outputs(await run({ "/main.fake": "2" }))).toEqual([
			"stdout:0",
			"stdout:1",
			"stderr:partial",
		]);
	});

	it("loads the engine once and times the load on the first run only", async () => {
		const run = startKernel(`
			let loads = 0;
			async function load() { loads += 1; return { loads }; }
			async function execute(engine, job) {
				await job.time("run", async () => output.text("stdout", "loads " + engine.loads + "\\n"));
			}
		`);
		const first = await run(entryOnly);
		expect(first[0]).toMatchObject({ type: "status", text: "Loading Fake..." });
		expect(Object.keys(done(first).timings as object)).toEqual(["Fake", "run"]);

		const second = await run(entryOnly);
		expect(outputs(second)).toEqual(["stdout:loads 1"]);
		expect(Object.keys(done(second).timings as object)).toEqual(["run"]);
	});

	it("skips a run cancelled before its code starts, and keeps the engine", async () => {
		let finishLoad = () => {};
		const loaded = new Promise<void>((resolve) => {
			finishLoad = resolve;
		});
		const run = startKernel(
			`
			let loads = 0;
			async function load() { loads += 1; await self.loaded; return {}; }
			async function execute(engine, job) {
				job.startCode();
				output.text("stdout", "loads " + loads + "\\n");
			}
		`,
			{ loaded },
		);
		const first = run(entryOnly);
		run.cancel(1);
		finishLoad();
		const cancelled = await first;
		expect(cancelled.map((m) => m.type)).toEqual(["status", "done"]);
		expect(done(cancelled)).toMatchObject({ ok: false, error: "The run was cancelled." });

		const second = await run(entryOnly);
		expect(second.map((m) => m.type)).toEqual(["running", "output", "done"]);
		expect(outputs(second)).toEqual(["stdout:loads 1"]);
	});

	it("fails the run when execute throws", async () => {
		const run = startKernel(`
			async function load() { return {}; }
			async function execute() { throw new Error("bad code"); }
		`);
		expect(done(await run(entryOnly))).toMatchObject({ ok: false, error: "bad code" });
	});

	it("fails a run without the entry file before the engine loads", async () => {
		const run = startKernel(`
			let loads = 0;
			async function load() { loads += 1; return {}; }
			async function execute() { output.text("stdout", "loads " + loads + "\\n"); }
		`);
		const missing = await run({ "/other.fake": "" });
		expect(missing).toHaveLength(1);
		expect(done(missing)).toMatchObject({ ok: false });
		expect(done(missing).error).toContain("There is no /main.fake file to run.");
		expect(done(missing).fatal).toBeUndefined();

		expect(outputs(await run(entryOnly))).toEqual(["stdout:loads 1"]);
	});

	it("reports a load error as fatal", async () => {
		const run = startKernel(`
			async function load() { throw new Error("offline"); }
			async function execute() {}
		`);
		const result = done(await run(entryOnly));
		expect(result).toMatchObject({ ok: false, fatal: true });
		expect(result.error).toContain("Could not load Fake.");
		expect(result.error).toContain("offline");
	});
});
