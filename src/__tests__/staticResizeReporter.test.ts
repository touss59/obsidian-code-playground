import { describe, it, expect } from "vitest";
import { STATIC_RESIZE_REPORTER_URL } from "../CodePlaygroundBlock/Sandpack/staticResizeReporter";

describe("STATIC_RESIZE_REPORTER_URL", () => {
	it("is classified as a script by SandpackStatic's extension check", () => {
		// Same regex SandpackStatic.injectExternalResources uses.
		const fileType = STATIC_RESIZE_REPORTER_URL.match(/\.([^.]*)$/)?.[1];
		expect(fileType).toBe("js");
	});

	it("decodes to a script that posts forwardable resize messages", () => {
		const base64 = STATIC_RESIZE_REPORTER_URL.replace(
			/^data:text\/javascript;base64,/,
			"",
		).replace(/#\.js$/, "");
		const script = atob(base64);
		expect(script).toContain('type: "resize"');
		expect(script).toContain("codesandbox: true");
		expect(() => new Function(script)).not.toThrow();
	});
});
