import { useEffect, useRef, useCallback } from "react";

export function useThrottle<Args extends unknown[]>(
	callback: (...args: Args) => void,
	delay: number
): (...args: Args) => void {
	const lastRunRef = useRef<number>(0);
	const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const pendingArgsRef = useRef<Args | null>(null);

	const throttledCallback = useCallback((...args: Args) => {
		const now = Date.now();
		const timeSinceLastRun = now - lastRunRef.current;

		if (timeSinceLastRun >= delay) {
			// Execute immediately if enough time has passed
			lastRunRef.current = now;
			callback(...args);
		} else {
			// Schedule execution for the remaining time
			pendingArgsRef.current = args;
			if (!timeoutRef.current) {
				timeoutRef.current = setTimeout(() => {
					if (pendingArgsRef.current) {
						lastRunRef.current = Date.now();
						callback(...pendingArgsRef.current);
						pendingArgsRef.current = null;
					}
					timeoutRef.current = null;
				}, delay - timeSinceLastRun);
			}
		}
	}, [callback, delay]);

	useEffect(() => {
		return () => {
			if (timeoutRef.current) {
				clearTimeout(timeoutRef.current);
			}
		};
	}, []);

	return throttledCallback;
}
