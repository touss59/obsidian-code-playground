import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { App } from "obsidian";
import { TFile, TFolder } from "obsidian";
import { SidecarStore, SidecarLoadError } from "../storage/SidecarStore";

const FOLDER = "playgrounds";

/**
 * In-memory Vault API stub. `handles` holds the live TFile per path — a
 * handle removed from the map is "stale": modify/cachedRead against it fail,
 * mirroring how the real vault invalidates handles of deleted files.
 */
function makeVault(initialFiles: Record<string, string> = {}) {
	const contents = new Map(Object.entries(initialFiles));
	const handles = new Map<string, TFile>();
	const folders = new Set<string>(
		Object.keys(initialFiles).length ? [FOLDER] : [],
	);

	const makeHandle = (p: string): TFile => {
		const f = new TFile();
		f.path = p;
		f.name = p.slice(p.lastIndexOf("/") + 1);
		return f;
	};
	for (const p of contents.keys()) handles.set(p, makeHandle(p));

	const vault = {
		getFileByPath: vi.fn((p: string) => handles.get(p) ?? null),
		getFolderByPath: vi.fn((p: string) => {
			if (!folders.has(p)) return null;
			const folder = new TFolder();
			folder.path = p;
			folder.name = p.slice(p.lastIndexOf("/") + 1);
			const subNames = new Set<string>();
			for (const f of handles.values()) {
				if (!f.path.startsWith(`${p}/`)) continue;
				const rest = f.path.slice(p.length + 1);
				const slash = rest.indexOf("/");
				if (slash === -1) {
					folder.children.push(f);
				} else {
					subNames.add(rest.slice(0, slash));
				}
			}
			for (const name of subNames) {
				const sub = new TFolder();
				sub.path = `${p}/${name}`;
				sub.name = name;
				folder.children.push(sub);
			}
			return folder;
		}),
		create: vi.fn(async (p: string, data: string) => {
			if (contents.has(p)) throw new Error(`File already exists: ${p}`);
			contents.set(p, data);
			const handle = makeHandle(p);
			handles.set(p, handle);
			return handle;
		}),
		process: vi.fn(async (f: TFile, fn: (data: string) => string) => {
			if (handles.get(f.path) !== f) throw new Error(`ENOENT ${f.path}`);
			const next = fn(contents.get(f.path) ?? "");
			contents.set(f.path, next);
			return next;
		}),
		cachedRead: vi.fn(async (f: TFile) => {
			const c = contents.get(f.path);
			if (c === undefined || handles.get(f.path) !== f) {
				throw new Error(`ENOENT ${f.path}`);
			}
			return c;
		}),
		createFolder: vi.fn(async (p: string) => {
			if (folders.has(p)) throw new Error(`Folder already exists: ${p}`);
			folders.add(p);
		}),
		adapter: {
			exists: vi.fn(
				async (p: string) => contents.has(p) || folders.has(p),
			),
		},
	};
	const trashFile = vi.fn(async (f: TFile) => {
		contents.delete(f.path);
		handles.delete(f.path);
	});
	const app = { vault, fileManager: { trashFile } } as unknown as App;
	return { app, vault, contents, handles, folders, trashFile };
}

const sidecarJson = (marker: string) =>
	JSON.stringify({ version: 1, files: { "/App.js": marker } });

const markerOf = (data: { files: Record<string, unknown> } | undefined) =>
	data?.files["/App.js"];

const path = (id: string) => `${FOLDER}/${id}.json`;

const filesOf = (code: string) => ({ "/App.js": { code } });

const codeOnDisk = (contents: Map<string, string>, id: string) =>
	(JSON.parse(contents.get(path(id)) ?? "{}") as ReturnType<
		typeof JSON.parse
	>).files?.["/App.js"]?.code;

/** Writes are enqueued fire-and-forget; a macrotask tick drains the queue. */
const flushWrites = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
	vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe("SidecarStore load", () => {
	it("returns undefined when nothing exists (new block)", async () => {
		const { app } = makeVault();
		const store = new SidecarStore(app, FOLDER);
		expect(await store.load("abc")).toBeUndefined();
	});

	it("reads a plain sidecar", async () => {
		const { app } = makeVault({ [path("abc")]: sidecarJson("plain") });
		const store = new SidecarStore(app, FOLDER);
		expect(markerOf(await store.load("abc"))).toBe("plain");
	});

	it("throws SidecarLoadError for a corrupt sidecar (never undefined)", async () => {
		const { app } = makeVault({ [path("abc")]: "not json" });
		const store = new SidecarStore(app, FOLDER);
		await expect(store.load("abc")).rejects.toBeInstanceOf(
			SidecarLoadError,
		);
	});

	it("throws SidecarLoadError when the file exists on disk but is not indexed yet", async () => {
		const { app, handles } = makeVault({
			[path("abc")]: sidecarJson("synced"),
		});
		// On disk (adapter sees it) but not in the vault index yet.
		handles.delete(path("abc"));
		const store = new SidecarStore(app, FOLDER);
		await expect(store.load("abc")).rejects.toBeInstanceOf(
			SidecarLoadError,
		);
	});
});

describe("SidecarStore writes", () => {
	it("creates the folder and the file on first save", async () => {
		const { app, vault, contents, folders } = makeVault();
		const store = new SidecarStore(app, FOLDER);
		store.patch("abc", { files: filesOf("data") });
		await flushWrites();
		expect(folders.has(FOLDER)).toBe(true);
		expect(vault.create).toHaveBeenCalledTimes(1);
		expect(codeOnDisk(contents, "abc")).toBe("data");
	});

	it("reuses the handle returned by create for later saves (no path re-lookup)", async () => {
		const { app, vault, contents } = makeVault();
		const store = new SidecarStore(app, FOLDER);
		store.patch("abc", { files: filesOf("first") });
		await flushWrites();
		const lookupsAfterCreate = vault.getFileByPath.mock.calls.length;

		store.patch("abc", { files: filesOf("second") });
		await flushWrites();
		expect(codeOnDisk(contents, "abc")).toBe("second");
		expect(vault.getFileByPath.mock.calls.length).toBe(lookupsAfterCreate);
		expect(vault.create).toHaveBeenCalledTimes(1);
		expect(vault.process).toHaveBeenCalledTimes(1);
	});

	it("falls back to modify when create loses the already-exists race", async () => {
		const { app, vault, contents } = makeVault({
			[path("abc")]: sidecarJson("old"),
		});
		// First lookup misses (file not indexed yet), create then collides.
		vault.getFileByPath.mockImplementationOnce(() => null);
		const store = new SidecarStore(app, FOLDER);
		store.patch("abc", { files: filesOf("new") });
		await flushWrites();
		expect(vault.create).toHaveBeenCalledTimes(1);
		expect(vault.process).toHaveBeenCalledTimes(1);
		expect(codeOnDisk(contents, "abc")).toBe("new");
	});

	it("drops a stale handle and recreates the file", async () => {
		const { app, vault, contents, handles } = makeVault();
		const store = new SidecarStore(app, FOLDER);
		store.patch("abc", { files: filesOf("first") });
		await flushWrites();

		// The file disappears behind the store's back (external deletion).
		handles.delete(path("abc"));
		contents.delete(path("abc"));

		store.patch("abc", { files: filesOf("second") });
		await flushWrites();
		expect(vault.create).toHaveBeenCalledTimes(2);
		expect(codeOnDisk(contents, "abc")).toBe("second");
	});
});

describe("SidecarStore delete", () => {
	it("trashes the sidecar via fileManager and clears the cache", async () => {
		const { app, contents, handles, trashFile } = makeVault({
			[path("abc")]: sidecarJson("data"),
		});
		const handle = handles.get(path("abc"));
		const store = new SidecarStore(app, FOLDER);
		await store.load("abc");
		await store.delete("abc");
		expect(trashFile).toHaveBeenCalledWith(handle);
		expect(contents.has(path("abc"))).toBe(false);
		expect(store.get("abc")).toBeUndefined();
	});

	it("waits for a queued write before deleting (no resurrection)", async () => {
		const { app, contents, trashFile } = makeVault();
		const store = new SidecarStore(app, FOLDER);
		store.patch("abc", { files: filesOf("data") });
		await store.delete("abc");
		expect(trashFile).toHaveBeenCalledTimes(1);
		expect(contents.has(path("abc"))).toBe(false);
	});

	it("is a no-op when the file was never created", async () => {
		const { app, trashFile } = makeVault();
		const store = new SidecarStore(app, FOLDER);
		await store.delete("abc");
		expect(trashFile).not.toHaveBeenCalled();
	});
});

describe("SidecarStore listSidecarFiles", () => {
	it("returns [] when the folder does not exist", async () => {
		const { app } = makeVault();
		const store = new SidecarStore(app, FOLDER);
		expect(await store.listSidecarFiles()).toEqual([]);
	});

	it("returns basenames of direct child files only", async () => {
		const { app } = makeVault({
			[path("abc")]: sidecarJson("a"),
			[`${FOLDER}/notes.txt`]: "foreign",
			[`${FOLDER}/sub/nested.json`]: "nested",
		});
		const store = new SidecarStore(app, FOLDER);
		expect((await store.listSidecarFiles()).sort()).toEqual([
			"abc.json",
			"notes.txt",
		]);
	});
});
