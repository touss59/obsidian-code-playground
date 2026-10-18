import { useState } from "react";
import { useSandpack } from "@codesandbox/sandpack-react";
import { Notice, requestUrl } from "obsidian";

const DEFINE_URL = "https://codesandbox.io/api/v1/sandboxes/define";

/**
 * Replaces Sandpack's built-in "Open Sandbox" button. For large sandboxes the
 * built-in one submits a hidden `<form method="POST" target="_blank">`.
 * Obsidian opens new windows in the system browser, which drops the POST body,
 * so CodeSandbox answers "requires the params `files` or `parameters`".
 * Here we create the sandbox with a JSON request, then open its URL.
 */
export function OpenInCodeSandboxButton() {
	const { sandpack } = useSandpack();
	const [pending, setPending] = useState(false);

	const open = async () => {
		setPending(true);
		try {
			const files = Object.fromEntries(
				Object.entries(sandpack.files).map(([path, file]) => [
					path.replace(/^\//, ""),
					{ content: file.code, isBinary: false },
				]),
			);
			const environment =
				sandpack.environment === "node" ? "server" : sandpack.environment;
			const response = await requestUrl({
				url: `${DEFINE_URL}?json=1&environment=${encodeURIComponent(environment ?? "")}`,
				method: "POST",
				contentType: "application/json",
				headers: { Accept: "application/json" },
				body: JSON.stringify({ files, template: sandpack.environment }),
			});
			const sandboxId = (response.json as { sandbox_id?: string }).sandbox_id;
			if (!sandboxId) throw new Error("No sandbox_id in response");
			const file = encodeURIComponent(sandpack.activeFile);
			window.open(`https://codesandbox.io/s/${sandboxId}?file=${file}`);
		} catch (error) {
			console.error("Code Playground: Open in CodeSandbox failed", error);
			new Notice("Could not open the playground in code sandbox.");
		} finally {
			setPending(false);
		}
	};

	return (
		<button
			onClick={() => void open()}
			disabled={pending}
			title="Open in CodeSandbox"
		>
			Open sandbox
		</button>
	);
}
