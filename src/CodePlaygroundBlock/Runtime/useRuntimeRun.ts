import { useSandpack } from "@codesandbox/sandpack-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAppContext } from "CodePlaygroundBlock/AppContextProvider";
import type { PlaygroundRuntime } from "CodePlaygroundBlock/Runtime/PlaygroundRuntime";
import { codeFiles } from "CodePlaygroundBlock/Runtime/runtimeFiles";
import type {
	OutputStream,
	RunEvent,
	RunHandle,
	RunTimings,
} from "CodePlaygroundBlock/Runtime/WorkerRunner";
import { RUNTIME_MAX_OUTPUT_LINES, RUNTIME_RERUN_DEBOUNCE_MS } from "appConstants";

export type OutputLine = { stream: OutputStream; text: string };

export type RunState = {
	phase: "queued" | "running" | "done" | "failed" | "stopped";
	status: string;
	lines: OutputLine[];
	/** Lines after RUNTIME_MAX_OUTPUT_LINES were dropped. */
	truncated: boolean;
};

export type RuntimeRun = RunState & {
	/** The runtime's engine, e.g. "Pyodide". */
	engineName: string;
	rerun: () => void;
	stop: () => void;
};

export const INITIAL_RUN_STATE: RunState = {
	phase: "queued",
	status: "Waiting to run...",
	lines: [],
	truncated: false,
};

/**
 * Runs the block's files in the runtime's shared worker: once on mount, and
 * again after each pause in typing. The block and its full-screen modal
 * show the same run. A block with no output pane (`enabled` false) never
 * runs: nothing would show its output, its status or its Stop button.
 */
export function useRuntimeRun(
	runtime: PlaygroundRuntime,
	enabled: boolean,
): RuntimeRun {
	const { sandpack } = useSandpack();
	const { value: global } = useAppContext();
	const runner = global.runtimes.get(runtime);
	const blockId = global.config.id;

	const files = useMemo(() => codeFiles(sandpack.files), [sandpack.files]);
	const filesKey = useMemo(() => JSON.stringify(files), [files]);
	const filesRef = useRef(files);
	filesRef.current = files;

	const [state, setState] = useState(INITIAL_RUN_STATE);
	const [manualRuns, setManualRuns] = useState(0);
	// The first run and a click on Run start at once. An edit waits.
	const immediateRef = useRef(true);

	// A run can print thousands of lines. Apply the events once per frame,
	// not once per line, so the block renders once per frame.
	const pendingRef = useRef<RunEvent[]>([]);
	const frameRef = useRef(0);
	const onEvent = useCallback((event: RunEvent) => {
		pendingRef.current.push(event);
		if (frameRef.current) return;
		frameRef.current = window.requestAnimationFrame(() => {
			frameRef.current = 0;
			const events = pendingRef.current;
			pendingRef.current = [];
			setState((prev) => events.reduce(reduceRunEvent, prev));
		});
	}, []);
	useEffect(() => () => window.cancelAnimationFrame(frameRef.current), []);

	// This copy of the block's run. Another copy (e.g. the same note in
	// another pane) has its own.
	const runRef = useRef<RunHandle>();
	useEffect(() => {
		if (!enabled) return;
		const delay = immediateRef.current ? 0 : RUNTIME_RERUN_DEBOUNCE_MS;
		immediateRef.current = false;
		const timer = window.setTimeout(() => {
			runRef.current = runner.run(blockId, filesRef.current, onEvent);
		}, delay);
		return () => {
			window.clearTimeout(timer);
			runRef.current?.drop();
			runRef.current = undefined;
		};
	}, [enabled, runner, blockId, filesKey, manualRuns, onEvent]);

	const rerun = useCallback(() => {
		immediateRef.current = true;
		setManualRuns((n) => n + 1);
	}, []);
	const stop = useCallback(() => runRef.current?.stop(), []);

	return useMemo(
		() => ({ ...state, engineName: runtime.engineName, rerun, stop }),
		[state, runtime.engineName, rerun, stop],
	);
}

export function reduceRunEvent(state: RunState, event: RunEvent): RunState {
	switch (event.type) {
		case "queued":
			// Keep the last output until this run starts, so it does not flash.
			return {
				...state,
				phase: "queued",
				status: "Waiting for another block...",
			};
		case "started":
			return { phase: "running", status: "Starting...", lines: [], truncated: false };
		case "status":
			return { ...state, status: event.text };
		case "output":
			return appendLine(state, { stream: event.stream, text: event.text });
		case "done": {
			const timing = formatTimings(event.timings);
			if (event.ok) return { ...state, phase: "done", status: timing };
			const failed = {
				...state,
				phase: "failed" as const,
				status: timing ? `Error · ${timing}` : "Error",
			};
			// The error shows even after the line limit: it explains the failure.
			return event.error === undefined
				? failed
				: {
						...failed,
						lines: [...failed.lines, { stream: "stderr", text: event.error }],
					};
		}
		case "stopped":
			return { ...state, phase: "stopped", status: "Stopped" };
	}
}

function appendLine(state: RunState, line: OutputLine): RunState {
	if (state.lines.length >= RUNTIME_MAX_OUTPUT_LINES) {
		return state.truncated ? state : { ...state, truncated: true };
	}
	return { ...state, lines: [...state.lines, line] };
}

/** For example "Pyodide 1840 ms · packages 3 ms · run 12 ms". */
export function formatTimings(timings: RunTimings): string {
	return Object.entries(timings)
		.map(([label, ms]) => `${label} ${Math.round(ms)} ms`)
		.join(" · ");
}
