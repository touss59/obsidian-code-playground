import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useDebounce } from "../CodePlaygroundBlock/useDebounce";
import { useThrottle } from "../CodePlaygroundBlock/useThrottle";

beforeEach(() => {
	vi.useFakeTimers();
});

afterEach(() => {
	vi.useRealTimers();
});

describe("useDebounce", () => {
	it("invokes the callback only once after rapid calls", () => {
		const spy = vi.fn();
		const { result } = renderHook(() => useDebounce(spy, 200));

		result.current("a");
		result.current("b");
		result.current("c");
		expect(spy).not.toHaveBeenCalled();

		vi.advanceTimersByTime(200);
		expect(spy).toHaveBeenCalledTimes(1);
		expect(spy).toHaveBeenCalledWith("c");
	});

	it("resets the timer on each new call", () => {
		const spy = vi.fn();
		const { result } = renderHook(() => useDebounce(spy, 200));

		result.current("x");
		vi.advanceTimersByTime(150);
		result.current("y");
		vi.advanceTimersByTime(150);
		expect(spy).not.toHaveBeenCalled();

		vi.advanceTimersByTime(50);
		expect(spy).toHaveBeenCalledTimes(1);
		expect(spy).toHaveBeenCalledWith("y");
	});
});

describe("useThrottle", () => {
	it("runs immediately on the leading call", () => {
		const spy = vi.fn();
		const { result } = renderHook(() => useThrottle(spy, 100));

		result.current("first");
		expect(spy).toHaveBeenCalledTimes(1);
		expect(spy).toHaveBeenCalledWith("first");
	});

	it("defers a trailing call within the window and uses the latest args", () => {
		const spy = vi.fn();
		const { result } = renderHook(() => useThrottle(spy, 100));

		result.current("a");
		result.current("b");
		result.current("c");
		expect(spy).toHaveBeenCalledTimes(1);

		vi.advanceTimersByTime(100);
		expect(spy).toHaveBeenCalledTimes(2);
		expect(spy).toHaveBeenLastCalledWith("c");
	});
});
