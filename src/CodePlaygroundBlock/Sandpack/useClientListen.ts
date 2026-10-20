import {
	useSandpack,
	type SandpackClientListen,
} from "@codesandbox/sandpack-react";
import { useCallback, useEffect, useRef } from "react";

type Listener = Parameters<SandpackClientListen>[0];

/**
 * A stable `listen` that gets the messages of one preview client only.
 * Without a clientId, it gets no messages.
 *
 * Sandpack's `listen(listener, clientId)` attaches to the client of that
 * moment. When Sandpack builds the client again (the block scrolls back into
 * view, or the network comes back), it re-attaches global listeners only. So
 * this hook attaches its listeners again to each new client of `clientId`.
 */
export function useClientListen(
	clientId: string | undefined,
): (listener: Listener) => () => void {
	const { sandpack, listen } = useSandpack();
	// Sandpack replaces the clients in place and re-renders when it is done.
	const client = clientId ? sandpack.clients[clientId] : undefined;
	// A new `listen` comes with each render. All of them do the same thing.
	const listenRef = useRef(listen);
	listenRef.current = listen;

	const listenersRef = useRef(new Set<Listener>());
	useEffect(() => {
		if (!clientId) return;
		// With no client yet, Sandpack queues the listener and attaches it
		// to the client it builds next.
		return listenRef.current((message) => {
			for (const listener of listenersRef.current) listener(message);
		}, clientId);
	}, [clientId, client]);

	return useCallback((listener: Listener) => {
		listenersRef.current.add(listener);
		return () => {
			listenersRef.current.delete(listener);
		};
	}, []);
}
