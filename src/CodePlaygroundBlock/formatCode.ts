import type { SandpackBundlerFiles } from "@codesandbox/sandpack-client";
import type { Options } from "prettier";

/**
 * Prettier and its plugins are large. esbuild still puts them in main.js
 * (one file, no code splitting), but it runs their code on the first
 * format, not when Obsidian loads the plugin.
 */
async function loadPrettier() {
	const [{ formatWithCursor }, babel, estree, html, postcss] =
		await Promise.all([
			import("prettier/standalone"),
			import("prettier/plugins/babel"),
			import("prettier/plugins/estree"),
			import("prettier/plugins/html"),
			import("prettier/plugins/postcss"),
		]);
	return { formatWithCursor, plugins: [babel, estree, html, postcss] };
}

/** Prettier parser by file extension. Babel also parses TypeScript. */
const PARSERS = new Map<string, string>([
	["js", "babel"],
	["jsx", "babel"],
	["mjs", "babel"],
	["cjs", "babel"],
	["ts", "babel-ts"],
	["tsx", "babel-ts"],
	["mts", "babel-ts"],
	["cts", "babel-ts"],
	["json", "json"],
	["css", "css"],
	["scss", "scss"],
	["less", "less"],
	["html", "html"],
	["htm", "html"],
	["vue", "vue"],
]);

const PRETTIER_CONFIG_PATHS = ["/.prettierrc", "/.prettierrc.json"];

/**
 * Option keys a sandbox's .prettierrc may set. Others are ignored. The
 * editor stores lines with "\n", so `endOfLine` is not one of them: a
 * "crlf" output would differ from the editor text after every format.
 */
const ALLOWED_OPTIONS = [
	"printWidth",
	"tabWidth",
	"useTabs",
	"semi",
	"singleQuote",
	"jsxSingleQuote",
	"quoteProps",
	"trailingComma",
	"bracketSpacing",
	"bracketSameLine",
	"arrowParens",
	"singleAttributePerLine",
] as const;

export function prettierParserFor(path: string): string | null {
	const ext = /\.([^./]+)$/.exec(path)?.[1]?.toLowerCase();
	return (ext && PARSERS.get(ext)) ?? null;
}

/**
 * Reads formatting options from a `.prettierrc` (JSON) in the sandbox.
 * Returns no options when the file is missing or invalid.
 */
export function readPrettierOptions(files: SandpackBundlerFiles): Options {
	const configFile = PRETTIER_CONFIG_PATHS.map((p) => files[p]).find(Boolean);
	if (!configFile) return {};
	let parsed: unknown;
	try {
		parsed = JSON.parse(configFile.code);
	} catch {
		return {};
	}
	if (typeof parsed !== "object" || parsed === null) return {};
	const options: Record<string, unknown> = {};
	for (const key of ALLOWED_OPTIONS) {
		if (key in parsed) options[key] = (parsed as Record<string, unknown>)[key];
	}
	return options;
}

/**
 * Formats `code` with the parser that matches `path`. Returns null when no
 * parser supports the file type. Throws on syntax errors.
 */
export async function formatCode(
	code: string,
	path: string,
	cursorOffset: number,
	options: Options = {},
): Promise<{ formatted: string; cursorOffset: number } | null> {
	const parser = prettierParserFor(path);
	if (!parser) return null;
	const { formatWithCursor, plugins } = await loadPrettier();
	const result = await formatWithCursor(code, {
		...options,
		parser,
		plugins,
		cursorOffset,
	});
	return { formatted: result.formatted, cursorOffset: result.cursorOffset };
}
