import type { SandpackBundlerFiles } from "@codesandbox/sandpack-client";

/**
 * The files of a runtime block, without the /package.json that Sandpack
 * adds. Runtime blocks hide it and never save it.
 */
export function withoutPackageJson(files: SandpackBundlerFiles): SandpackBundlerFiles {
	const rest = { ...files };
	delete rest["/package.json"];
	return rest;
}

/** The block's files as path to code, without Sandpack's /package.json. */
export function codeFiles(files: SandpackBundlerFiles): Record<string, string> {
	const result: Record<string, string> = {};
	for (const [path, file] of Object.entries(withoutPackageJson(files))) {
		result[path] = file.code;
	}
	return result;
}
