import { describe, it, expect } from "vitest";
import { act, render } from "@testing-library/react";
import type { ComponentProps } from "react";
import {
	AppContextProvider,
	useAppContext,
} from "../CodePlaygroundBlock/AppContextProvider";

type AppContext = ComponentProps<typeof AppContextProvider>["value"];

const baseValue = {
	config: { id: "test-block" },
	ObsidianApp: {},
	hasBeenCorrectlyLoaded: false,
	store: {},
} as unknown as AppContext;

let latest!: { loaded: boolean; setValue: (v: AppContext) => void };
function Probe() {
	const { value, setValue } = useAppContext();
	latest = { loaded: value.hasBeenCorrectlyLoaded, setValue };
	return null;
}

describe("AppContextProvider", () => {
	it("keeps hasBeenCorrectlyLoaded when the value prop changes identity", () => {
		const { rerender } = render(
			<AppContextProvider value={baseValue}>
				<Probe />
			</AppContextProvider>,
		);
		expect(latest.loaded).toBe(false);

		// Simulate Sandpack's "done" message marking the app as loaded.
		act(() =>
			latest.setValue({ ...baseValue, hasBeenCorrectlyLoaded: true }),
		);
		expect(latest.loaded).toBe(true);

		// Simulate a settings change: rerenderAllBlocks produces a fresh
		// merged-config identity, so CodePlaygroundApp's useMemo emits a new
		// context value with the flag reset to false.
		rerender(
			<AppContextProvider value={{ ...baseValue }}>
				<Probe />
			</AppContextProvider>,
		);
		expect(latest.loaded).toBe(true);
	});
});
