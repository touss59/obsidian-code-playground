import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
	resolve: {
		// Mirror tsconfig's baseUrl:"src" for the bare-specifier imports
		// used by modules under test (e.g. idInjector -> jsonHelper/config).
		alias: [
			{
				find: /^(appConstants|config|idInjector|jsonHelper|settings|sidecarCleanup|themes|validators)$/,
				replacement: fileURLToPath(new URL("./src/$1", import.meta.url)),
			},
			// The obsidian npm package is types-only (empty "main"), so tests
			// that exercise modules importing obsidian values need this stub.
			{
				find: /^obsidian$/,
				replacement: fileURLToPath(
					new URL("./src/__tests__/obsidianStub.ts", import.meta.url),
				),
			},
			{
				find: /^CodePlaygroundBlock\/(.*)$/,
				replacement: fileURLToPath(
					new URL("./src/CodePlaygroundBlock/$1", import.meta.url),
				),
			},
		],
	},
	test: {
		environment: "happy-dom",
		globals: true,
		include: ["src/**/*.test.{ts,tsx}"],
	},
});
