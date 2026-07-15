import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, render } from "@testing-library/react";
import type { ComponentProps } from "react";
import {
	AppContextProvider,
	useAppContext,
} from "../CodePlaygroundBlock/AppContextProvider";
import {
	usePreviewLoadState,
	type PreviewLoadState,
} from "../CodePlaygroundBlock/Sandpack/usePreviewLoadState";
import { APP_LOAD_TIMEOUT_MS } from "../appConstants";

type AppContext = ComponentProps<typeof AppContextProvider>["value"];
type Listener = (msg: { type: string }) => void;

const { listeners, runSandpackSpy, sandpackState } = vi.hoisted(() => ({
	listeners: new Set<(msg: { type: string }) => void>(),
	runSandpackSpy: vi.fn(),
	sandpackState: { status: "initial" },
}));

vi.mock("@codesandbox/sandpack-react", () => ({
	useSandpack: () => ({
		listen: (cb: Listener) => {
			listeners.add(cb);
			return () => listeners.delete(cb);
		},
		sandpack: { runSandpack: runSandpackSpy, status: sandpackState.status },
	}),
}));

const baseValue = {
	config: { id: "test-block" },
	ObsidianApp: {},
	hasBeenCorrectlyLoaded: false,
	store: {},
} as unknown as AppContext;

let latest!: { state: PreviewLoadState; isOnline: boolean; loaded: boolean };
function Probe() {
	const { previewLoadState, isOnline } = usePreviewLoadState();
	const { value } = useAppContext();
	latest = {
		state: previewLoadState,
		isOnline,
		loaded: value.hasBeenCorrectlyLoaded,
	};
	return null;
}

function renderProbe(alreadyLoaded = false) {
	// A fresh element per render: React bails out on an identical element
	// reference and the hook would never observe the new status. The
	// provider's sticky merge keeps the loaded flag across new `value`
	// identities, so this mirrors a real settings re-render.
	const element = () => (
		<AppContextProvider
			value={{ ...baseValue, hasBeenCorrectlyLoaded: alreadyLoaded }}
		>
			<Probe />
		</AppContextProvider>
	);
	const view = render(element());
	const setStatus = (status: string) => {
		sandpackState.status = status;
		act(() => view.rerender(element()));
	};
	return { ...view, setStatus };
}

function emit(msg: { type: string }) {
	[...listeners].forEach((cb) => cb(msg));
}

let onLine = true;

beforeEach(() => {
	vi.useFakeTimers();
	vi.spyOn(console, "warn").mockImplementation(() => {});
	listeners.clear();
	runSandpackSpy.mockClear();
	sandpackState.status = "initial";
	onLine = true;
	Object.defineProperty(window.navigator, "onLine", {
		configurable: true,
		get: () => onLine,
	});
});

afterEach(() => {
	vi.useRealTimers();
	vi.restoreAllMocks();
});

describe("usePreviewLoadState", () => {
	it("marks loaded when done arrives before the timeout", () => {
		const { setStatus } = renderProbe();
		setStatus("running");
		expect(latest.state).toBe("loading");
		expect(latest.loaded).toBe(false);

		act(() => emit({ type: "done" }));
		expect(latest.state).toBe("loaded");
		expect(latest.loaded).toBe(true);

		// The pending timer must not downgrade the state.
		act(() => vi.advanceTimersByTime(APP_LOAD_TIMEOUT_MS));
		expect(latest.state).toBe("loaded");
	});

	it("times out to timedOut but still unblocks saving and keeps listening", () => {
		const { setStatus } = renderProbe();
		setStatus("running");

		act(() => vi.advanceTimersByTime(APP_LOAD_TIMEOUT_MS));
		expect(latest.state).toBe("timedOut");
		// The load-bearing invariant: save paths stay unblocked offline.
		expect(latest.loaded).toBe(true);
		// Listener survives the timeout so a late "done" can self-heal.
		expect(listeners.size).toBe(1);

		act(() => emit({ type: "done" }));
		expect(latest.state).toBe("loaded");
		expect(listeners.size).toBe(0);
	});

	it("auto-retries via runSandpack when the connection comes back", () => {
		onLine = false;
		const { setStatus } = renderProbe();
		setStatus("running");
		expect(latest.isOnline).toBe(false);
		expect(latest.state).toBe("loading");

		act(() => vi.advanceTimersByTime(APP_LOAD_TIMEOUT_MS));
		expect(latest.state).toBe("timedOut");

		act(() => {
			onLine = true;
			window.dispatchEvent(new Event("online"));
		});
		expect(runSandpackSpy).toHaveBeenCalledTimes(1);
		expect(latest.state).toBe("loading");

		// Retry fails again: the re-armed timer re-surfaces the state.
		act(() => vi.advanceTimersByTime(APP_LOAD_TIMEOUT_MS));
		expect(latest.state).toBe("timedOut");
		expect(latest.loaded).toBe(true);

		// Retry eventually succeeds: late "done" clears the state.
		act(() => emit({ type: "done" }));
		expect(latest.state).toBe("loaded");
	});

	it("does not retry on online events once loaded", () => {
		onLine = false;
		renderProbe();
		act(() => emit({ type: "done" }));
		expect(latest.state).toBe("loaded");

		act(() => {
			onLine = true;
			window.dispatchEvent(new Event("online"));
		});
		expect(runSandpackSpy).not.toHaveBeenCalled();
		expect(latest.state).toBe("loaded");
	});

	it("starts loaded when the context flag is already set", () => {
		const { setStatus } = renderProbe(true);
		expect(latest.state).toBe("loaded");
		// No subscription and no timer: the settings-rerender edge case.
		expect(listeners.size).toBe(0);

		// Bundling starting later (scroll-back-in) must not arm a timer
		// that could downgrade the state.
		setStatus("running");
		act(() => vi.advanceTimersByTime(APP_LOAD_TIMEOUT_MS));
		expect(latest.state).toBe("loaded");
	});

	it("arms no timer while bundling has not started (offscreen block)", () => {
		const { setStatus } = renderProbe();

		act(() => vi.advanceTimersByTime(APP_LOAD_TIMEOUT_MS));
		expect(latest.state).toBe("loading");
		expect(latest.loaded).toBe(false);

		// Scrolled into view: the attempt starts and the timer judges it.
		setStatus("running");
		act(() => vi.advanceTimersByTime(APP_LOAD_TIMEOUT_MS));
		expect(latest.state).toBe("timedOut");
		expect(latest.loaded).toBe(true);
	});

	it("disarms a pending timer when the attempt is torn down (scroll-out)", () => {
		const { setStatus } = renderProbe();
		setStatus("running");
		setStatus("idle");

		act(() => vi.advanceTimersByTime(APP_LOAD_TIMEOUT_MS));
		expect(latest.state).toBe("loading");
		expect(latest.loaded).toBe(false);
	});

	it("clears a stale timedOut when a fresh attempt starts (scroll-back-in)", () => {
		const { setStatus } = renderProbe();
		setStatus("running");
		act(() => vi.advanceTimersByTime(APP_LOAD_TIMEOUT_MS));
		expect(latest.state).toBe("timedOut");

		setStatus("idle");
		setStatus("running");
		// The banner must not flash over the load that is in progress.
		expect(latest.state).toBe("loading");

		act(() => emit({ type: "done" }));
		expect(latest.state).toBe("loaded");
	});

	it("does not retry on online events while the block is offscreen", () => {
		onLine = false;
		renderProbe();

		act(() => {
			onLine = true;
			window.dispatchEvent(new Event("online"));
		});
		expect(runSandpackSpy).not.toHaveBeenCalled();
		expect(latest.state).toBe("loading");
	});

	it("retries on online events after Sandpack's own bundler timeout", () => {
		onLine = false;
		const { setStatus } = renderProbe();
		setStatus("running");
		act(() => vi.advanceTimersByTime(APP_LOAD_TIMEOUT_MS));
		expect(latest.state).toBe("timedOut");

		setStatus("timeout");
		act(() => {
			onLine = true;
			window.dispatchEvent(new Event("online"));
		});
		expect(runSandpackSpy).toHaveBeenCalledTimes(1);
		expect(latest.state).toBe("loading");
	});
});
