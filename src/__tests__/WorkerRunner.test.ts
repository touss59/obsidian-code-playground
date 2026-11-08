import { describe, it, expect, beforeEach, vi } from "vitest";
import { RUNTIME_DROPPED_RUN_GRACE_MS } from "../appConstants";
import {
	RuntimeRunners,
	WorkerRunner,
	type RunEvent,
	type WorkerLike,
} from "../CodePlaygroundBlock/Runtime/WorkerRunner";
import type { PlaygroundRuntime } from "../CodePlaygroundBlock/Runtime/PlaygroundRuntime";

type Posted = {
	type: "run" | "cancel";
	runId: number;
	blockId?: string;
	files: Record<string, string>;
};

class FakeWorker implements WorkerLike {
	posted: Posted[] = [];
	terminated = false;
	onmessage: ((event: MessageEvent) => void) | null = null;
	onerror: ((event: ErrorEvent) => void) | null = null;

	postMessage(message: unknown) {
		this.posted.push(message as Posted);
	}
	terminate() {
		this.terminated = true;
	}
	/** Sends a message from the worker to the runner. */
	send(data: unknown) {
		this.onmessage?.({ data } as MessageEvent);
	}
	finish(runId: number, extra: Record<string, unknown> = {}) {
		this.send({ type: "done", runId, ok: true, timings: {}, ...extra });
	}
}

/** A worker factory that keeps the workers it creates. */
const fakeWorkers = () => {
	const workers: FakeWorker[] = [];
	const create = () => {
		const w = new FakeWorker();
		workers.push(w);
		return w;
	};
	return { workers, create };
};

const record = () => {
	const events: RunEvent[] = [];
	return { events, listener: (e: RunEvent) => events.push(e) };
};

describe("WorkerRunner", () => {
	let workers: FakeWorker[];
	let create: () => FakeWorker;
	let runner: WorkerRunner;
	const worker = () => workers[workers.length - 1]!;

	beforeEach(() => {
		({ workers, create } = fakeWorkers());
		runner = new WorkerRunner(create);
	});

	it("creates the worker once and reuses it for later runs", () => {
		runner.run("a", { "/main.py": "print(1)" }, record().listener);
		expect(workers).toHaveLength(1);
		expect(worker().posted[0]).toEqual({
			type: "run",
			runId: 1,
			blockId: "a",
			files: { "/main.py": "print(1)" },
		});
		worker().finish(1);

		runner.run("b", { "/main.py": "print(2)" }, record().listener);
		expect(workers).toHaveLength(1);
		expect(worker().posted).toHaveLength(2);
	});

	it("runs one block at a time and queues the others", () => {
		const b = record();
		runner.run("a", {}, record().listener);
		runner.run("b", {}, b.listener);
		expect(worker().posted).toHaveLength(1);
		expect(b.events).toEqual([{ type: "queued" }]);

		worker().finish(1);
		expect(worker().posted.map((p) => p.runId)).toEqual([1, 2]);
		expect(b.events).toEqual([{ type: "queued" }, { type: "started" }]);
	});

	it("runs each copy of a block, e.g. the same note in two panes", () => {
		const copy1 = record();
		const copy2 = record();
		runner.run("a", {}, record().listener);
		runner.run("b", { "/main.py": "1" }, copy1.listener);
		runner.run("b", { "/main.py": "2" }, copy2.listener);
		worker().finish(1);
		worker().finish(2);
		expect(worker().posted.map((p) => p.files["/main.py"])).toEqual([
			undefined,
			"1",
			"2",
		]);
		expect(copy1.events.at(-1)).toMatchObject({ type: "done" });
		expect(copy2.events.at(-1)).toEqual({ type: "started" });
	});

	it("stops the run of one copy of a block only", () => {
		const copy1 = record();
		const copy2 = record();
		const run1 = runner.run("b", {}, copy1.listener);
		runner.run("b", {}, copy2.listener);
		run1.stop();

		expect(copy1.events.at(-1)).toEqual({ type: "stopped" });
		expect(copy2.events).toEqual([{ type: "queued" }, { type: "started" }]);
	});

	it("passes the events of the active run to its listener only", () => {
		const a = record();
		runner.run("a", {}, a.listener);
		worker().send({ type: "output", runId: 1, stream: "stdout", text: "hi" });
		worker().send({ type: "output", runId: 99, stream: "stdout", text: "stale" });
		worker().finish(1, { timings: { run: 4 } });
		expect(a.events).toEqual([
			{ type: "started" },
			{ type: "output", stream: "stdout", text: "hi" },
			{ type: "done", ok: true, error: undefined, timings: { run: 4 } },
		]);
	});

	it("formats the error with the runtime's formatter", () => {
		const a = record();
		const formatting = new WorkerRunner(
			create,
			(message, blockId) => `${blockId}: ${message}`,
		);
		formatting.run("a", {}, a.listener);
		worker().finish(1, { ok: false, error: "boom" });
		expect(a.events.at(-1)).toMatchObject({ error: "a: boom" });
	});

	it("sends no more events after a run is dropped", () => {
		const a = record();
		const { drop } = runner.run("a", {}, a.listener);
		drop();
		workers[0]!.send({ type: "output", runId: 1, stream: "stdout", text: "late" });
		workers[0]!.finish(1);
		expect(a.events).toEqual([{ type: "started" }]);
	});

	it("cancels a dropped run whose code has not started, and keeps the worker", () => {
		const { drop } = runner.run("a", {}, record().listener);
		const b = record();
		runner.run("b", {}, b.listener);
		drop();

		expect(worker().terminated).toBe(false);
		expect(worker().posted.at(-1)).toEqual({ type: "cancel", runId: 1 });
		expect(b.events).toEqual([{ type: "queued" }]);

		worker().finish(1, { ok: false, error: "The run was cancelled." });
		expect(workers).toHaveLength(1);
		expect(worker().posted.at(-1)).toMatchObject({ type: "run", runId: 2 });
		expect(b.events).toEqual([{ type: "queued" }, { type: "started" }]);
	});

	it("keeps the status of a block that waits for its own cancelled run", () => {
		const a = record();
		runner.run("a", {}, a.listener).drop();
		runner.run("a", {}, a.listener);
		expect(a.events).toEqual([{ type: "started" }]);
	});

	describe("a dropped run whose code started", () => {
		beforeEach(() => {
			vi.useFakeTimers();
			return () => vi.useRealTimers();
		});

		it("keeps the worker when no other run waits", () => {
			const { drop } = runner.run("a", {}, record().listener);
			worker().send({ type: "running", runId: 1 });
			drop();
			vi.advanceTimersByTime(RUNTIME_DROPPED_RUN_GRACE_MS * 10);
			expect(worker().terminated).toBe(false);
		});

		it("keeps the worker when it ends within the grace time", () => {
			const { drop } = runner.run("a", {}, record().listener);
			const b = record();
			runner.run("b", {}, b.listener);
			worker().send({ type: "running", runId: 1 });
			drop();

			vi.advanceTimersByTime(RUNTIME_DROPPED_RUN_GRACE_MS - 1);
			expect(worker().terminated).toBe(false);
			worker().finish(1);
			vi.advanceTimersByTime(RUNTIME_DROPPED_RUN_GRACE_MS);

			expect(workers).toHaveLength(1);
			expect(worker().terminated).toBe(false);
			expect(worker().posted.at(-1)).toMatchObject({ type: "run", runId: 2 });
			expect(b.events).toEqual([{ type: "queued" }, { type: "started" }]);
		});

		it("stops with its worker after the grace time when another run waits, and the next run starts in a new one", () => {
			const { drop } = runner.run("a", {}, record().listener);
			const b = record();
			runner.run("b", {}, b.listener);
			worker().send({ type: "running", runId: 1 });
			drop();
			vi.advanceTimersByTime(RUNTIME_DROPPED_RUN_GRACE_MS);

			expect(workers[0]!.terminated).toBe(true);
			expect(workers).toHaveLength(2);
			expect(workers[1]!.posted.map((p) => p.runId)).toEqual([2]);
			expect(b.events).toEqual([{ type: "queued" }, { type: "started" }]);
		});

		it("starts the grace time when a run is queued after the drop", () => {
			const { drop } = runner.run("a", {}, record().listener);
			worker().send({ type: "running", runId: 1 });
			drop();
			vi.advanceTimersByTime(RUNTIME_DROPPED_RUN_GRACE_MS * 10);
			runner.run("b", {}, record().listener);

			vi.advanceTimersByTime(RUNTIME_DROPPED_RUN_GRACE_MS - 1);
			expect(workers[0]!.terminated).toBe(false);
			vi.advanceTimersByTime(1);
			expect(workers[0]!.terminated).toBe(true);
		});

		it("keeps the worker when the waiting run is stopped", () => {
			const { drop } = runner.run("a", {}, record().listener);
			const runB = runner.run("b", {}, record().listener);
			worker().send({ type: "running", runId: 1 });
			drop();
			runB.stop();
			vi.advanceTimersByTime(RUNTIME_DROPPED_RUN_GRACE_MS);
			expect(worker().terminated).toBe(false);
		});

		it("applies when a cancelled run starts its code before it gets the cancel", () => {
			const { drop } = runner.run("a", {}, record().listener);
			runner.run("b", {}, record().listener);
			drop();
			worker().send({ type: "running", runId: 1 });

			expect(workers[0]!.terminated).toBe(false);
			vi.advanceTimersByTime(RUNTIME_DROPPED_RUN_GRACE_MS);
			expect(workers[0]!.terminated).toBe(true);
		});
	});

	it("does nothing when a run that already ended is dropped", () => {
		const { drop } = runner.run("a", {}, record().listener);
		worker().finish(1);
		runner.run("b", {}, record().listener);
		drop();
		expect(worker().terminated).toBe(false);
		expect(workers).toHaveLength(1);
	});

	it("removes a dropped run from the queue", () => {
		runner.run("a", {}, record().listener);
		const { drop } = runner.run("b", {}, record().listener);
		drop();
		worker().finish(1);
		expect(worker().posted).toHaveLength(1);
	});

	it("stops a running block with its worker and starts the next run in a new one", () => {
		const a = record();
		const runA = runner.run("a", {}, a.listener);
		runner.run("b", {}, record().listener);
		runA.stop();

		expect(workers[0]!.terminated).toBe(true);
		expect(a.events.at(-1)).toEqual({ type: "stopped" });
		expect(workers).toHaveLength(2);
		expect(workers[1]!.posted.map((p) => p.runId)).toEqual([2]);
	});

	it("leaves the worker alive when the stopped block is only queued", () => {
		const b = record();
		runner.run("a", {}, record().listener);
		runner.run("b", {}, b.listener).stop();

		expect(worker().terminated).toBe(false);
		expect(b.events).toEqual([{ type: "queued" }, { type: "stopped" }]);
		worker().finish(1);
		expect(worker().posted).toHaveLength(1);
	});

	it("drops the worker when the engine fails to load, so the next run retries", () => {
		const a = record();
		runner.run("a", {}, a.listener);
		worker().finish(1, { ok: false, fatal: true, error: "offline" });
		expect(workers[0]!.terminated).toBe(true);
		expect(a.events.at(-1)).toMatchObject({ type: "done", ok: false, error: "offline" });

		runner.run("a", {}, record().listener);
		expect(workers).toHaveLength(2);
	});

	it("fails the active run when the worker crashes", () => {
		const a = record();
		runner.run("a", {}, a.listener);
		worker().onerror?.({ message: "boom", preventDefault() {} } as ErrorEvent);
		expect(a.events.at(-1)).toEqual({
			type: "done",
			ok: false,
			error: "The worker failed: boom",
			timings: {},
		});
		expect(workers[0]!.terminated).toBe(true);
	});
});

describe("RuntimeRunners", () => {
	const runtime = (template: string) =>
		({ template }) as PlaygroundRuntime;

	it("keeps one runner per runtime and disposes them all", () => {
		const { workers, create } = fakeWorkers();
		const runners = new RuntimeRunners(() => create);
		const a = runners.get(runtime("a"));
		expect(runners.get(runtime("a"))).toBe(a);
		expect(runners.get(runtime("b"))).not.toBe(a);

		a.run("block", {}, () => {});
		runners.dispose();
		expect(workers[0]!.terminated).toBe(true);
	});
});
