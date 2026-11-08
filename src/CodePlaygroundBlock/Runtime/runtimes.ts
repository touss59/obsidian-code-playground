import type { PlaygroundRuntime } from "CodePlaygroundBlock/Runtime/PlaygroundRuntime";
import { pythonRuntime } from "CodePlaygroundBlock/Runtime/python/pythonRuntime";

/**
 * The plugin's own templates, by template name. They run in a worker of the
 * plugin, not in a Sandpack bundler. Add a language here.
 */
export const RUNTIMES = {
	python: pythonRuntime,
} as const satisfies Record<string, PlaygroundRuntime>;

export type RuntimeTemplate = keyof typeof RUNTIMES;

export function isRuntimeTemplate(template: string): template is RuntimeTemplate {
	return Object.prototype.hasOwnProperty.call(RUNTIMES, template);
}

export function getRuntime(template: string): PlaygroundRuntime | undefined {
	return isRuntimeTemplate(template) ? RUNTIMES[template] : undefined;
}
