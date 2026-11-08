import type { PlaygroundRuntime } from "CodePlaygroundBlock/Runtime/PlaygroundRuntime";
import type { WorkerLike } from "CodePlaygroundBlock/Runtime/WorkerRunner";
import { createSandboxedWorker } from "CodePlaygroundBlock/Runtime/sandboxedWorker";
import { RUNTIME_MAX_OUTPUT_LINES } from "appConstants";

/**
 * The worker script of a runtime: the shared kernel around the runtime's
 * `workerSource`.
 *
 * The kernel runs nothing in a worker that can reach Node.js: the code of a
 * note could then reach the disk. Each run fails with a fatal error.
 * A run without the entry file fails at once. The kernel loads the engine
 * with `load()` on the first run and keeps it.
 * For each run it calls `execute(engine, job)`, then sends the rest of the
 * output and a "done" message. An error thrown by `execute` fails the run.
 * An error thrown by `load` is fatal: WorkerRunner drops the worker, so the
 * next run loads the engine again.
 *
 * A "cancel" message skips a run whose code has not started: the engine
 * loads on and stays loaded for the next run. `execute` must call
 * `job.startCode()` just before the block's code runs.
 *
 * The runtime code can use:
 * - `ENTRY`: the runtime's entry path, e.g. "/main.py".
 * - `output.text(stream, text)`: prints text to "stdout" or "stderr". Text
 *   after the last newline waits for the next newline or the end of the run.
 *   A run sends RUNTIME_MAX_OUTPUT_LINES lines plus one, which tells the
 *   block that the output is truncated. It drops the lines after that, so
 *   an endless loop of prints cannot flood the plugin with messages.
 * - `output.bytes(stream, buffer)`: the same for UTF-8 bytes. It returns
 *   the byte count, as engine write handlers expect.
 * - `job.blockId`, `job.files` (path to code, with the entry file).
 * - `job.status(text)`: shows text in the block's toolbar.
 * - `job.time(label, fn)`: runs `fn` and adds its duration to the timings.
 * - `job.startCode()`: throws if the run is cancelled. Otherwise it tells
 *   WorkerRunner that the code starts: only the end of the worker stops it.
 * - `post(message)` and `errorText(error)`.
 */
export function buildWorkerScript(runtime: PlaygroundRuntime): string {
	return `"use strict";
// Obsidian's own workers get Node.js. The sandbox removes it. If Node.js is
// still here, fail closed.
const NODE_ACCESS =
	typeof self.require !== "undefined" ||
	(typeof self.process !== "undefined" && !!self.process && !!self.process.versions && !!self.process.versions.node);

const ENTRY = ${JSON.stringify(runtime.entry)};
const ENGINE = ${JSON.stringify(runtime.engineName)};
const MAX_LINES = ${JSON.stringify(RUNTIME_MAX_OUTPUT_LINES)};
let currentRunId = 0;
let cancelledRunId = 0;
let loading = null;

const post = (message) => self.postMessage(message);
const errorText = (error) => (error instanceof Error ? error.message : String(error));

const decoders = { stdout: new TextDecoder(), stderr: new TextDecoder() };
const partial = { stdout: "", stderr: "" };
// Lines sent in the current run. The line after MAX_LINES is the last one
// sent: the block marks its output as truncated when it gets it.
let sentLines = 0;

const postLine = (stream, text) => {
	if (sentLines > MAX_LINES) return;
	sentLines += 1;
	post({ type: "output", runId: currentRunId, stream, text });
};

const output = {
	text(stream, text) {
		const lines = (partial[stream] + text).split("\\n");
		partial[stream] = lines.pop();
		for (const line of lines) postLine(stream, line);
	},
	bytes(stream, buffer) {
		output.text(stream, decoders[stream].decode(buffer, { stream: true }));
		return buffer.length;
	},
	// Sends a line that has no newline yet, so it shows in its own run.
	flush() {
		for (const stream of ["stdout", "stderr"]) {
			const text = partial[stream] + decoders[stream].decode();
			partial[stream] = "";
			if (text) postLine(stream, text);
		}
	},
};

// --- Runtime code --------------------------------------------------------
${runtime.workerSource}
// -------------------------------------------------------------------------

async function run({ runId, blockId, files }) {
	currentRunId = runId;
	sentLines = 0;
	if (NODE_ACCESS) {
		post({
			type: "done", runId, ok: false, fatal: true, timings: {},
			error: "This block cannot run: its worker can reach Node.js, so the code of a note could reach your files.",
		});
		return;
	}
	// Without its entry file, a run has nothing to run: fail before the
	// engine loads.
	if (!Object.prototype.hasOwnProperty.call(files, ENTRY)) {
		post({
			type: "done", runId, ok: false, timings: {},
			error: "There is no " + ENTRY + " file to run. Add it with Manage files.",
		});
		return;
	}
	const timings = {};
	const job = {
		blockId,
		files,
		status: (text) => post({ type: "status", runId, text }),
		async time(label, fn) {
			const start = performance.now();
			try {
				return await fn();
			} finally {
				timings[label] = performance.now() - start;
			}
		},
		startCode() {
			if (cancelledRunId === runId) throw new Error("The run was cancelled.");
			post({ type: "running", runId });
		},
	};

	let engine;
	try {
		if (!loading) {
			job.status("Loading " + ENGINE + "...");
			loading = job.time(ENGINE, load);
		}
		engine = await loading;
	} catch (error) {
		post({
			type: "done", runId, ok: false, fatal: true, timings,
			error: "Could not load " + ENGINE + ". It needs a network connection the first time. " + errorText(error),
		});
		return;
	}

	let ok = true;
	let error;
	try {
		await execute(engine, job);
	} catch (caught) {
		ok = false;
		error = errorText(caught);
	}
	output.flush();
	post({ type: "done", runId, ok, error, timings });
}

self.onmessage = (event) => {
	const message = event.data;
	if (message.type === "cancel") cancelledRunId = message.runId;
	else void run(message);
};
`;
}

/**
 * Creates the sandboxed workers of the runtime. The script is built once:
 * a stopped worker is created again from it.
 */
export function runtimeWorkerFactory(runtime: PlaygroundRuntime): () => WorkerLike {
	let script: string | undefined;
	return () => {
		script ??= buildWorkerScript(runtime);
		return createSandboxedWorker(script);
	};
}
