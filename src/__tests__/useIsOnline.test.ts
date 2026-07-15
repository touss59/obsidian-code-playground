import { describe, it, expect, beforeEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useIsOnline } from "../CodePlaygroundBlock/useIsOnline";

let onLine = true;

beforeEach(() => {
	onLine = true;
	Object.defineProperty(window.navigator, "onLine", {
		configurable: true,
		get: () => onLine,
	});
});

describe("useIsOnline", () => {
	it("reflects navigator.onLine and follows online/offline events", () => {
		const { result } = renderHook(() => useIsOnline());
		expect(result.current).toBe(true);

		act(() => {
			onLine = false;
			window.dispatchEvent(new Event("offline"));
		});
		expect(result.current).toBe(false);

		act(() => {
			onLine = true;
			window.dispatchEvent(new Event("online"));
		});
		expect(result.current).toBe(true);
	});
});
