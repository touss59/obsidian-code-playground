import { App, Notice, TFile, normalizePath } from "obsidian";
import type { SandpackBundlerFiles } from "@codesandbox/sandpack-client";
import { parseJsonSafe } from "jsonHelper";
import { DEFAULT_PLAYGROUND_FOLDER, isValidId } from "appConstants";
import { isSafeVaultFolder } from "validators";

export type PlaygroundSidecar = {
	version: 1;
	files: SandpackBundlerFiles;
	activeFile?: string;
	editorWidth?: number;
	hiddenFiles?: string[];
};

/**
 * Thrown when a sidecar file exists on disk but cannot be read, parsed, or
 * validated. Callers MUST treat this differently from a missing file: a
 * missing file means "new block" (safe to seed defaults), whereas this error
 * means "saved data is present but unreadable right now" and must never lead
 * to overwriting the on-disk file with defaults.
 */
export class SidecarLoadError extends Error {
	constructor(message: string, options?: { cause?: unknown }) {
		super(message);
		this.name = "SidecarLoadError";
		if (options && "cause" in options) {
			(this as { cause?: unknown }).cause = options.cause;
		}
	}
}

/**
 * Defense in depth: the settings tab validates the folder too, but data.json
 * can be edited by hand. Never accept a folder that could escape the vault.
 */
function resolveSafeFolder(folder: string): string {
	if (!isSafeVaultFolder(folder)) {
		console.warn(
			`[CodePlayground] Refusing unsafe playground folder "${folder}"; using "${DEFAULT_PLAYGROUND_FOLDER}".`,
		);
		return normalizePath(DEFAULT_PLAYGROUND_FOLDER);
	}
	return normalizePath(folder);
}

function isObject(v: unknown): v is Record<string, unknown> {
	return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isValidSidecar(v: unknown): v is PlaygroundSidecar {
	if (!isObject(v)) return false;
	if (v.version !== 1) return false;
	if (!isObject(v.files)) return false;
	for (const k of Object.keys(v.files)) {
		const f = v.files[k];
		if (typeof f === "string") continue;
		if (isObject(f) && typeof f.code === "string") continue;
		return false;
	}
	if (v.activeFile !== undefined && typeof v.activeFile !== "string") {
		return false;
	}
	if (v.editorWidth !== undefined && typeof v.editorWidth !== "number") {
		return false;
	}
	if (v.hiddenFiles !== undefined) {
		if (!Array.isArray(v.hiddenFiles)) return false;
		for (const p of v.hiddenFiles) {
			if (typeof p !== "string") return false;
		}
	}
	return true;
}

export class SidecarStore {
	private cache = new Map<string, PlaygroundSidecar>();
	// TFile handles from vault.create/getFileByPath, reused for later writes.
	// vault.create returns the handle directly, so a just-created file never
	// needs a path re-lookup (which can miss while the vault index catches up).
	private fileCache = new Map<string, TFile>();
	private writeQueues = new Map<string, Promise<void>>();
	private loadPromises = new Map<
		string,
		Promise<PlaygroundSidecar | undefined>
	>();
	private folder: string;
	// Set after a failed sidecar write so a burst of failing saves shows one
	// Notice, and cleared by the next successful write so a persistent
	// problem notifies again on the next failure streak. Because a fresh
	// store is created on every plugin load, this resets after a
	// disable/enable cycle.
	private writeFailureNoticed = false;

	constructor(
		private app: App,
		folder: string,
	) {
		this.folder = resolveSafeFolder(folder);
	}

	async load(id: string): Promise<PlaygroundSidecar | undefined> {
		if (this.cache.has(id)) return this.cache.get(id);

		const inFlight = this.loadPromises.get(id);
		if (inFlight) return inFlight;

		const promise = this.readFromDisk(id);
		this.loadPromises.set(id, promise);
		try {
			return await promise;
		} finally {
			this.loadPromises.delete(id);
		}
	}

	private async readFromDisk(
		id: string,
	): Promise<PlaygroundSidecar | undefined> {
		const path = this.pathFor(id);
		const file = this.fileCache.get(id) ?? this.app.vault.getFileByPath(path);
		if (!file) {
			// Fail-closed: a sidecar delivered by a sync tool but not yet
			// indexed by the vault must not be treated as a new block — the
			// caller would seed defaults and the eventual write would clobber
			// it. This existence probe is deliberately the only adapter call
			// in the plugin; everything else goes through the Vault API.
			if (await this.app.vault.adapter.exists(path)) {
				throw new SidecarLoadError(
					`[CodePlayground] Sidecar exists but is not indexed yet: ${path}`,
				);
			}
			return undefined;
		}
		this.fileCache.set(id, file);

		let raw: string;
		try {
			raw = await this.app.vault.cachedRead(file);
		} catch (err) {
			throw new SidecarLoadError(
				`[CodePlayground] Failed to read sidecar ${path}`,
				{ cause: err },
			);
		}

		// A sidecar exists. From here on, ANY failure (invalid JSON, failed
		// validation) is a hard error that is propagated to the caller. We
		// must never return undefined here, because undefined means "new
		// block" and would let the caller overwrite the still-present sidecar
		// with template defaults.
		const parsed = parseJsonSafe(raw);
		if (!isValidSidecar(parsed)) {
			throw new SidecarLoadError(
				`[CodePlayground] Invalid or corrupt sidecar: ${path}`,
			);
		}
		// Don't clobber a fresher in-memory value written while we read.
		if (!this.cache.has(id)) this.cache.set(id, parsed);
		return this.cache.get(id);
	}

	get(id: string): PlaygroundSidecar | undefined {
		return this.cache.get(id);
	}

	patch(
		id: string,
		update: Partial<Omit<PlaygroundSidecar, "version">>,
	): void {
		const prev = this.cache.get(id);
		// Presence-based merge: a key explicitly set to undefined clears the
		// field (JSON.stringify drops it on disk), an absent key keeps the
		// previous value. `files` stays non-clearable.
		const next: PlaygroundSidecar = {
			version: 1,
			activeFile: prev?.activeFile,
			editorWidth: prev?.editorWidth,
			hiddenFiles: prev?.hiddenFiles,
			...update,
			files: update.files ?? prev?.files ?? {},
		};
		this.cache.set(id, next);
		this.enqueueWrite(id, next);
	}

	/**
	 * Deletes according to the user's "Deleted files" preference (system
	 * trash / vault trash / permanent) so a wrongly removed sidecar stays
	 * recoverable. A file the vault hasn't indexed yet is skipped — cleanup
	 * can simply run again later. Errors are logged and swallowed.
	 */
	async delete(id: string): Promise<void> {
		const path = this.pathFor(id); // validates the id BEFORE any mutation
		this.cache.delete(id);
		// Let any queued write settle first (never rejects; enqueueWrite
		// catches), otherwise an in-flight debounced save would recreate the
		// file right after deletion.
		await this.writeQueues.get(id);
		this.writeQueues.delete(id);
		const file =
			this.fileCache.get(id) ?? this.app.vault.getFileByPath(path);
		this.fileCache.delete(id);
		if (!file) return;
		try {
			await this.app.fileManager.trashFile(file);
		} catch (err) {
			console.warn(
				`[CodePlayground] Failed to delete sidecar ${path}:`,
				err,
			);
		}
	}

	/**
	 * Basenames of all files directly inside the sidecar folder, or [] when
	 * the folder doesn't exist. Subfolders are ignored — sidecars are flat.
	 */
	async listSidecarFiles(): Promise<string[]> {
		const folder = this.app.vault.getFolderByPath(this.folder);
		if (!folder) return [];
		return folder.children
			.filter((c): c is TFile => c instanceof TFile)
			.map((f) => f.name);
	}

	setFolder(folder: string): void {
		this.folder = resolveSafeFolder(folder);
		this.fileCache.clear();
	}

	private pathFor(id: string): string {
		// Defense in depth: the id is also validated upstream, but never let an
		// unsafe id escape the playground folder via ".." or path separators.
		if (!isValidId(id)) {
			throw new Error(`[CodePlayground] Refusing unsafe sidecar id: ${String(id)}`);
		}
		return normalizePath(`${this.folder}/${id}.json`);
	}

	private enqueueWrite(id: string, snapshot: PlaygroundSidecar): void {
		const prev = this.writeQueues.get(id) ?? Promise.resolve();
		const next = prev
			.then(() => this.writeToDisk(id, snapshot))
			.then(() => {
				this.writeFailureNoticed = false;
			})
			.catch((err) => {
				console.warn(
					`[CodePlayground] Sidecar write failed for ${id}:`,
					err,
				);
				if (!this.writeFailureNoticed) {
					this.writeFailureNoticed = true;
					new Notice(
						"Code playground: saving a block failed — recent changes may be lost. See the developer console for details.",
					);
				}
			});
		this.writeQueues.set(id, next);
	}

	private async writeToDisk(
		id: string,
		snapshot: PlaygroundSidecar,
	): Promise<void> {
		const json = JSON.stringify(snapshot, null, 2);
		const path = this.pathFor(id);

		const cached = this.fileCache.get(id);
		if (cached) {
			try {
				await this.app.vault.process(cached, () => json);
				return;
			} catch {
				// Stale handle (file trashed/renamed externally) — drop it and
				// re-resolve below; a genuine write failure fails there too
				// and propagates to enqueueWrite's catch.
				this.fileCache.delete(id);
			}
		}

		const existing = this.app.vault.getFileByPath(path);
		if (existing) {
			this.fileCache.set(id, existing);
			await this.app.vault.process(existing, () => json);
			return;
		}

		if (!this.app.vault.getFolderByPath(this.folder)) {
			try {
				await this.app.vault.createFolder(this.folder);
			} catch (err) {
				// A concurrent create (another block's first save) is fine;
				// anything else is a real failure.
				if (!this.app.vault.getFolderByPath(this.folder)) throw err;
			}
		}

		try {
			this.fileCache.set(id, await this.app.vault.create(path, json));
		} catch (err) {
			// Created behind our back (e.g. a sync tool indexed it mid-flight).
			const file = this.app.vault.getFileByPath(path);
			if (!file) throw err;
			this.fileCache.set(id, file);
			await this.app.vault.process(file, () => json);
		}
	}
}
