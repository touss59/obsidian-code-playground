import type { PlaygroundRuntime } from "CodePlaygroundBlock/Runtime/PlaygroundRuntime";
import { runtimeWorkerFactory } from "CodePlaygroundBlock/Runtime/workerKernel";
import { RUNTIME_DROPPED_RUN_GRACE_MS } from "appConstants";

export type OutputStream = "stdout" | "stderr";

/**
 * Durations in ms, by label, in the order they ran. The engine load time
 * (labeled with the engine name) is set on the run that loaded it only.
 */
export type RunTimings = Record<string, number>;

export type RunEvent =
	/** Another block's run uses the worker. */
	| { type: "queued" }
	| { type: "started" }
	| { type: "status"; text: string }
	| { type: "output"; stream: OutputStream; text: string }
	| { type: "done"; ok: boolean; error?: string; timings: RunTimings }
	| { type: "stopped" };

type WorkerMessage =
	/** The block's code starts: from now on, only the end of the worker stops it. */
	| { type: "running"; runId: number }
	| { type: "status"; runId: number; text: string }
	| { type: "output"; runId: number; stream: OutputStream; text: string }
	| {
			type: "done";
			runId: number;
			ok: boolean;
			error?: string;
			/** The engine did not load: the worker cannot run anything. */
			fatal?: boolean;
			timings: RunTimings;
	  };

/** The part of Worker that the runner uses. Tests pass a fake. */
export type WorkerLike = {
	postMessage(message: unknown): void;
	terminate(): void;
	onmessage: ((event: MessageEvent) => void) | null;
	onerror: ((event: ErrorEvent) => void) | null;
};

type Job = {
	runId: number;
	blockId: string;
	files: Record<string, string>;
	listener: (event: RunEvent) => void;
	/** The listener gets no more events. */
	dropped: boolean;
	/** The worker sent "running": the block's code runs. */
	codeStarted: boolean;
};

/** One run of a block. Copies of a block (e.g. in two panes) each have their own. */
export type RunHandle = {
	/** Stops the run. A running run stops with its worker. */
	stop(): void;
	/**
	 * Drops the run: the listener then gets no more events. The worker
	 * skips a run whose code has not started. A run whose code started
	 * goes on, so the engine stays loaded. When another run waits, the
	 * dropped run has RUNTIME_DROPPED_RUN_GRACE_MS to end. After that, it
	 * stops with its worker, so it cannot keep the worker from the other
	 * blocks after its block is gone.
	 */
	drop(): void;
};

/**
 * Runs the blocks of one runtime one at a time, in one Web Worker. The
 * engine loads on the first run and stays loaded, so later runs and other
 * blocks start at once.
 */
export class WorkerRunner {
	private worker: WorkerLike | null = null;
	private queue: Job[] = [];
	private active: Job | null = null;
	private nextRunId = 1;
	/** Stops a dropped run that keeps the worker from a waiting run. */
	private evictTimer = 0;

	constructor(
		private readonly createWorker: () => WorkerLike,
		private readonly formatError: (message: string, blockId: string) => string = (
			message,
		) => message,
	) {}

	/** Queues a run of the block's files. */
	run(
		blockId: string,
		files: Record<string, string>,
		listener: (event: RunEvent) => void,
	): RunHandle {
		const job: Job = {
			runId: this.nextRunId++,
			blockId,
			files,
			listener,
			dropped: false,
			codeStarted: false,
		};
		this.queue.push(job);
		// A run that waits for its own dropped run (e.g. after an edit while
		// the engine loads) keeps that run's status.
		const waitsForItself =
			this.active?.dropped === true && this.active.listener === listener;
		if (this.active && !waitsForItself) listener({ type: "queued" });
		this.startNext();
		this.evictDroppedRun();
		return { stop: () => this.stopJob(job), drop: () => this.dropJob(job) };
	}

	dispose(): void {
		this.clearEvictTimer();
		this.queue = [];
		this.active = null;
		this.discardWorker();
	}

	/** Stops a queued run at once. A running run stops with its worker. */
	private stopJob(job: Job): void {
		if (this.queue.includes(job)) {
			this.queue = this.queue.filter((queued) => queued !== job);
			this.send(job, { type: "stopped" });
		} else if (this.active === job) {
			this.endActive({ type: "stopped" }, true);
		}
	}

	private dropJob(job: Job): void {
		job.dropped = true;
		this.queue = this.queue.filter((queued) => queued !== job);
		if (this.active !== job) return;
		if (job.codeStarted) this.evictDroppedRun();
		else this.worker?.postMessage({ type: "cancel", runId: job.runId });
	}

	/**
	 * Gives the active run RUNTIME_DROPPED_RUN_GRACE_MS to end when it was
	 * dropped after its code started and another run waits. After that, it
	 * stops with its worker.
	 */
	private evictDroppedRun(): void {
		const job = this.active;
		if (this.evictTimer || !job?.dropped || !job.codeStarted) return;
		if (this.queue.length === 0) return;
		this.evictTimer = window.setTimeout(() => {
			this.evictTimer = 0;
			// The waiting runs can be gone, e.g. stopped.
			if (this.active === job && this.queue.length > 0) {
				this.endActive({ type: "stopped" }, true);
			}
		}, RUNTIME_DROPPED_RUN_GRACE_MS);
	}

	private clearEvictTimer(): void {
		window.clearTimeout(this.evictTimer);
		this.evictTimer = 0;
	}

	private send(job: Job, event: RunEvent): void {
		if (!job.dropped) job.listener(event);
	}

	private startNext(): void {
		if (this.active) return;
		const job = this.queue.shift();
		if (!job) return;
		this.active = job;
		this.send(job, { type: "started" });
		this.getWorker().postMessage({
			type: "run",
			runId: job.runId,
			blockId: job.blockId,
			files: job.files,
		});
	}

	private getWorker(): WorkerLike {
		if (this.worker) return this.worker;
		const worker = this.createWorker();
		worker.onmessage = (event: MessageEvent) =>
			this.handleMessage(event.data as WorkerMessage);
		worker.onerror = (event: ErrorEvent) => {
			event.preventDefault();
			const error = `The worker failed: ${event.message}`;
			this.endActive({ type: "done", ok: false, error, timings: {} }, true);
		};
		this.worker = worker;
		return worker;
	}

	private handleMessage(message: WorkerMessage): void {
		const job = this.active;
		if (!job || message.runId !== job.runId) return;
		switch (message.type) {
			case "running":
				job.codeStarted = true;
				// The run was dropped before the worker got the cancel.
				if (job.dropped) this.evictDroppedRun();
				break;
			case "status":
				this.send(job, { type: "status", text: message.text });
				break;
			case "output":
				this.send(job, {
					type: "output",
					stream: message.stream,
					text: message.text,
				});
				break;
			case "done":
				this.endActive(
					{
						type: "done",
						ok: message.ok,
						error:
							message.error === undefined
								? undefined
								: this.formatError(message.error, job.blockId),
						timings: message.timings,
					},
					message.fatal === true,
				);
				break;
		}
	}

	/**
	 * Sends the last event of the active run and starts the next run.
	 * `dropWorker` terminates the worker, so the next run loads the engine
	 * again.
	 */
	private endActive(event: RunEvent, dropWorker: boolean): void {
		const job = this.active;
		this.clearEvictTimer();
		if (dropWorker) this.discardWorker();
		this.active = null;
		if (job) this.send(job, event);
		this.startNext();
	}

	private discardWorker(): void {
		this.worker?.terminate();
		this.worker = null;
	}
}

/** One WorkerRunner per runtime, created on its first use. */
export class RuntimeRunners {
	private runners = new Map<string, WorkerRunner>();

	constructor(
		private readonly makeFactory: (
			runtime: PlaygroundRuntime,
		) => () => WorkerLike = runtimeWorkerFactory,
	) {}

	get(runtime: PlaygroundRuntime): WorkerRunner {
		let runner = this.runners.get(runtime.template);
		if (!runner) {
			runner = new WorkerRunner(this.makeFactory(runtime), runtime.formatError);
			this.runners.set(runtime.template, runner);
		}
		return runner;
	}

	dispose(): void {
		this.runners.forEach((runner) => runner.dispose());
		this.runners.clear();
	}
}
