import { SANDBOX_TEMPLATES } from "@codesandbox/sandpack-react";
import { CodePlaygroundSettings } from "settings";
import { VALID_THEMES } from "themes";
import { HEX_COLOR_RE } from "validators";
import { ID_RE } from "appConstants";

const OPTIONAL_CONFIG_KEYS = [
	"borderColor",
	"maxEditorHeight",
	"minEditorHeight",
	"theme",
	"showEditor",
	"showPreview",
	"showConsole",
	"showFileTabs",
	"buttonBackgroundColor",
	"buttonTextColor",
	"showOpenInCodeSandbox",
] as const satisfies readonly (keyof CodePlaygroundSettings)[];

export type CodePlaygroundConfig = {
	id: string;
	template: CodePlaygroundSettings["template"];
} & {
	[K in (typeof OPTIONAL_CONFIG_KEYS)[number]]?: CodePlaygroundSettings[K];
};

export const VALID_CONFIG_KEYS: readonly string[] = [
	"id",
	"template",
	...OPTIONAL_CONFIG_KEYS,
];

export type ResolvedCodePlaygroundConfig = Required<
	Omit<CodePlaygroundConfig, "buttonBackgroundColor" | "buttonTextColor">
> & {
	buttonBackgroundColor?: string;
	buttonTextColor?: string;
	// Global-only advanced setting (not a per-block key): merged in from plugin
	// settings, so it's readable here but never accepted in a block's JSON.
	bundlerURL?: string;
};

export const VALID_TEMPLATES = Object.keys(SANDBOX_TEMPLATES);

export function isCodePlaygroundConfig(
	source: unknown,
): source is CodePlaygroundConfig {
	return getConfigErrors(source).length === 0;
}

export function getConfigErrors(source: unknown): ConfigError[] {
	const errors: ConfigError[] = [];
	if (typeof source !== "object" || source === null) {
		return ["source_missing"];
	}

	for (const key of Object.keys(source)) {
		if (!VALID_CONFIG_KEYS.includes(key)) {
			errors.push(`unknown_key:${key}`);
		}
	}

	if (
		!("id" in source) ||
		typeof source.id !== "string" ||
		source.id.length === 0
	) {
		errors.push("missing_id");
	} else if (!ID_RE.test(source.id)) {
		errors.push("invalid_id");
	}

	if (
		!("template" in source) ||
		typeof source.template !== "string"
	) {
		errors.push("missing_template");
	} else if (!VALID_TEMPLATES.includes(source.template)) {
		errors.push("invalid_template");
	}

	if (
		"borderColor" in source &&
		(typeof source.borderColor !== "string" ||
			!HEX_COLOR_RE.test(source.borderColor))
	) {
		errors.push("invalid_borderColor");
	}

	if (
		"maxEditorHeight" in source &&
		(typeof source.maxEditorHeight !== "number" ||
			source.maxEditorHeight <= 0)
	) {
		errors.push("invalid_maxEditorHeight");
	}

	if (
		"minEditorHeight" in source &&
		(typeof source.minEditorHeight !== "number" ||
			source.minEditorHeight <= 0)
	) {
		errors.push("invalid_minEditorHeight");
	}

	if (
		"theme" in source &&
		(typeof source.theme !== "string" ||
			!VALID_THEMES.includes(source.theme))
	) {
		errors.push("invalid_theme");
	}

	if ("showEditor" in source && typeof source.showEditor !== "boolean") {
		errors.push("invalid_showEditor");
	}

	if ("showPreview" in source && typeof source.showPreview !== "boolean") {
		errors.push("invalid_showPreview");
	}

	if ("showConsole" in source && typeof source.showConsole !== "boolean") {
		errors.push("invalid_showConsole");
	}

	if ("showFileTabs" in source && typeof source.showFileTabs !== "boolean") {
		errors.push("invalid_showFileTabs");
	}

	if (
		"buttonBackgroundColor" in source &&
		source.buttonBackgroundColor !== undefined &&
		(typeof source.buttonBackgroundColor !== "string" ||
			!HEX_COLOR_RE.test(source.buttonBackgroundColor))
	) {
		errors.push("invalid_buttonBackgroundColor");
	}

	if (
		"buttonTextColor" in source &&
		source.buttonTextColor !== undefined &&
		(typeof source.buttonTextColor !== "string" ||
			!HEX_COLOR_RE.test(source.buttonTextColor))
	) {
		errors.push("invalid_buttonTextColor");
	}

	if (
		"showOpenInCodeSandbox" in source &&
		typeof source.showOpenInCodeSandbox !== "boolean"
	) {
		errors.push("invalid_showOpenInCodeSandbox");
	}

	if (
		"showEditor" in source &&
		source.showEditor === false &&
		"showPreview" in source &&
		source.showPreview === false &&
		"showConsole" in source &&
		source.showConsole === false
	) {
		errors.push("no_panel_visible");
	}

	if (
		"minEditorHeight" in source &&
		"maxEditorHeight" in source &&
		typeof source.minEditorHeight === "number" &&
		typeof source.maxEditorHeight === "number" &&
		source.minEditorHeight > source.maxEditorHeight
	) {
		errors.push("min_greater_than_max");
	}

	return errors;
}

export type UnknownKeyError = `unknown_key:${string}`;

export function isUnknownKeyError(e: ConfigError): e is UnknownKeyError {
	return e.startsWith("unknown_key:");
}

export type ConfigError = KnownConfigError | UnknownKeyError;

export type KnownConfigError =
	| "source_missing"
	| "missing_id"
	| "invalid_id"
	| "missing_template"
	| "invalid_template"
	| "invalid_borderColor"
	| "invalid_maxEditorHeight"
	| "invalid_minEditorHeight"
	| "invalid_theme"
	| "invalid_showEditor"
	| "invalid_showPreview"
	| "invalid_showConsole"
	| "invalid_showFileTabs"
	| "invalid_buttonBackgroundColor"
	| "invalid_buttonTextColor"
	| "invalid_showOpenInCodeSandbox"
	| "no_panel_visible"
	| "min_greater_than_max";
