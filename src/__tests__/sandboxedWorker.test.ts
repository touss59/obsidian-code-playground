import { describe, it, expect, afterEach, vi } from "vitest";
import {
	createSandboxedWorker,
	SANDBOX_PAGE,
} from "../CodePlaygroundBlock/Runtime/sandboxedWorker";

const frames = () => Array.from(document.querySelectorAll("iframe"));

/** Sends a message from the sandbox page of `frame` to the plugin. */
const fromSandbox = (frame: HTMLIFrameElement, data: unknown) =>
	window.dispatchEvent(
		new MessageEvent("message", { data, source: frame.contentWindow }),
	);

describe("createSandboxedWorker", () => {
	afterEach(() => {
		frames().forEach((frame) => frame.remove());
		vi.restoreAllMocks();
	});

	it("starts the worker in a hidden iframe with scripts only", () => {
		createSandboxedWorker("script");
		const [frame] = frames();
		expect(frames()).toHaveLength(1);
		expect(frame!.getAttribute("sandbox")).toBe("allow-scripts");
		expect(frame!.hidden).toBe(true);
	});

	it("keeps the messages until the sandbox page is ready", () => {
		const worker = createSandboxedWorker("the script");
		const [frame] = frames();
		const sent = vi.spyOn(frame!.contentWindow!, "postMessage");

		worker.postMessage({ runId: 1 });
		expect(sent).not.toHaveBeenCalled();

		fromSandbox(frame!, { kind: "ready" });
		worker.postMessage({ runId: 2 });
		expect(sent.mock.calls.map(([message]) => message)).toEqual([
			{ kind: "start", script: "the script" },
			{ kind: "post", data: { runId: 1 } },
			{ kind: "post", data: { runId: 2 } },
		]);
	});

	it("passes the worker's messages and errors from its own iframe only", () => {
		const worker = createSandboxedWorker("script");
		const [frame] = frames();
		const received: unknown[] = [];
		const errors: string[] = [];
		worker.onmessage = (event) => received.push(event.data);
		worker.onerror = (event) => errors.push(event.message);

		fromSandbox(frame!, { kind: "message", data: "hello" });
		fromSandbox(frame!, { kind: "error", message: "boom" });
		window.dispatchEvent(
			new MessageEvent("message", { data: { kind: "message", data: "other" } }),
		);

		expect(received).toEqual(["hello"]);
		expect(errors).toEqual(["boom"]);
	});

	it("reports a worker that the sandbox page cannot create", () => {
		const script = SANDBOX_PAGE.slice(
			SANDBOX_PAGE.indexOf("<script>") + "<script>".length,
			SANDBOX_PAGE.lastIndexOf("</script>"),
		);
		const sent: unknown[] = [];
		const parent = { postMessage: (message: unknown) => sent.push(message) };
		let onMessage: (event: { source: unknown; data: unknown }) => void = () => {};
		const pageWindow = {
			parent,
			addEventListener: (_type: string, handler: typeof onMessage) => {
				onMessage = handler;
			},
		};
		class BlockedWorker {
			constructor() {
				throw new Error("blocked");
			}
		}
		// Runs the page's script with fakes for the browser APIs it uses.
		new Function("window", "Worker", "URL", "Blob", script)(
			pageWindow,
			BlockedWorker,
			{ createObjectURL: () => "blob:script" },
			class {},
		);
		onMessage({ source: parent, data: { kind: "start", script: "" } });

		expect(sent).toEqual([
			{ kind: "ready" },
			{ kind: "error", message: "Could not start the worker: blocked" },
		]);
	});

	it("removes the iframe and stops listening on terminate", () => {
		const worker = createSandboxedWorker("script");
		const [frame] = frames();
		const received: unknown[] = [];
		worker.onmessage = (event) => received.push(event.data);

		worker.terminate();
		fromSandbox(frame!, { kind: "message", data: "late" });

		expect(frames()).toHaveLength(0);
		expect(received).toEqual([]);
	});
});
