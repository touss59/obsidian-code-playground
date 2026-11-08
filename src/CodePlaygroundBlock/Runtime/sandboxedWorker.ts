import type { WorkerLike } from "CodePlaygroundBlock/Runtime/WorkerRunner";

/** Time for the sandbox page to start, after its iframe loads. */
const SANDBOX_START_TIMEOUT_MS = 5000;

/** Messages from the sandbox page to the plugin. */
type SandboxMessage =
	| { kind: "ready" }
	| { kind: "message"; data: unknown }
	| { kind: "error"; message: string };

/**
 * The page in the sandboxed iframe. It starts the worker from the script
 * that the plugin sends, then passes the messages between the two.
 */
export const SANDBOX_PAGE = `<!doctype html><meta charset="utf-8"><script>
"use strict";
let worker = null;
const toPlugin = (message) => window.parent.postMessage(message, "*");
window.addEventListener("message", (event) => {
	if (event.source !== window.parent) return;
	const message = event.data;
	if (message.kind === "start" && !worker) {
		// The page can fail to create the worker, e.g. a SecurityError.
		// Report it, or the run waits forever.
		try {
			const url = URL.createObjectURL(new Blob([message.script], { type: "text/javascript" }));
			worker = new Worker(url);
		} catch (e) {
			toPlugin({ kind: "error", message: "Could not start the worker: " + ((e && e.message) || e) });
			return;
		}
		worker.onmessage = (e) => toPlugin({ kind: "message", data: e.data });
		worker.onerror = (e) => {
			e.preventDefault();
			toPlugin({ kind: "error", message: e.message });
		};
	} else if (message.kind === "post" && worker) {
		worker.postMessage(message.data);
	}
});
toPlugin({ kind: "ready" });
</script>`;

/**
 * Runs `script` in a Web Worker that a sandboxed iframe starts. Obsidian
 * gives its own workers Node.js, so code that runs in them can reach the
 * disk. The iframe has `allow-scripts` only: its page and its worker get an
 * opaque origin, with no access to Obsidian or Node.js.
 *
 * `terminate` removes the iframe, which ends the worker at once.
 */
export function createSandboxedWorker(script: string): WorkerLike {
	const frame = document.createElement("iframe");
	frame.setAttribute("sandbox", "allow-scripts");
	frame.hidden = true;
	frame.srcdoc = SANDBOX_PAGE;

	// Messages for the worker wait here until the sandbox page is ready.
	let queue: unknown[] | null = [];
	let terminated = false;
	let startTimer = 0;

	const toSandbox = (message: unknown) =>
		frame.contentWindow?.postMessage(message, "*");

	const sandboxed: WorkerLike = {
		onmessage: null,
		onerror: null,
		postMessage(data) {
			if (terminated) return;
			if (queue) queue.push(data);
			else toSandbox({ kind: "post", data });
		},
		terminate() {
			terminated = true;
			queue = null;
			window.clearTimeout(startTimer);
			window.removeEventListener("message", onWindowMessage);
			frame.remove();
		},
	};

	const fail = (message: string) =>
		sandboxed.onerror?.({ message, preventDefault() {} } as ErrorEvent);

	const onWindowMessage = (event: MessageEvent) => {
		// Only the page of this iframe. Sandpack previews post here too.
		if (event.source !== frame.contentWindow) return;
		const message = event.data as SandboxMessage;
		switch (message?.kind) {
			case "ready": {
				window.clearTimeout(startTimer);
				const waiting = queue ?? [];
				queue = null;
				toSandbox({ kind: "start", script });
				waiting.forEach((data) => toSandbox({ kind: "post", data }));
				break;
			}
			case "message":
				sandboxed.onmessage?.({ data: message.data } as MessageEvent);
				break;
			case "error":
				fail(String(message.message));
				break;
		}
	};

	window.addEventListener("message", onWindowMessage);
	frame.addEventListener(
		"load",
		() => {
			startTimer = window.setTimeout(() => {
				if (queue) fail("The sandbox page did not start.");
			}, SANDBOX_START_TIMEOUT_MS);
		},
		{ once: true },
	);
	document.body.appendChild(frame);
	return sandboxed;
}
