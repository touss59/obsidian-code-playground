import type { SandpackBundlerFiles } from "@codesandbox/sandpack-client";

/**
 * A language that runs in the plugin, in a Web Worker, without a bundler.
 * One worker per runtime serves every block of that runtime: the engine
 * (e.g. Pyodide) loads once and stays loaded.
 *
 * To add a language, define a runtime and add it to RUNTIMES.
 */
export type PlaygroundRuntime = {
	/** The block's `template` value, e.g. "python". */
	template: string;
	/** The engine name in the load status and the timings, e.g. "Pyodide". */
	engineName: string;
	/** The file that runs. The other files are there to import or read. */
	entry: string;
	/** The files of a new block. */
	starterFiles: SandpackBundlerFiles;
	/**
	 * Worker code that defines `async function load()` and
	 * `async function execute(engine, job)`. `execute` must call
	 * `job.startCode()` just before the block's code runs. See
	 * buildWorkerScript for what this code can use.
	 */
	workerSource: string;
	/** Makes an error message easier to read, e.g. drops engine frames. */
	formatError?: (message: string, blockId: string) => string;
};
