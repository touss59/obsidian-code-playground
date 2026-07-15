/**
 * Runtime stub for the `obsidian` package in vitest. The real npm package is
 * types-only (`"main": ""`), so any module that imports obsidian *values*
 * (not just types) needs this stub, wired via the alias in vitest.config.ts.
 */

export function normalizePath(path: string): string {
	return path
		.replace(/\\/g, "/")
		.replace(/\/+/g, "/")
		.replace(/^\/+|\/+$/g, "");
}

export class Notice {
	constructor(public message?: string) {}
}

export class App {}

export class TAbstractFile {
	path = "";
	name = "";
}

export class TFile extends TAbstractFile {
	extension = "";
	stat = { ctime: 0, mtime: 0, size: 0 };
}

export class TFolder extends TAbstractFile {
	children: TAbstractFile[] = [];
}
