import type { TFile } from "obsidian";
import { collectBlockIds } from "idInjector";
import { isValidId } from "appConstants";
import { parseJsonSafe } from "jsonHelper";

/** Minimal slice of Vault used by the cleanup scan, so tests pass a plain object. */
export type VaultLike = {
	getMarkdownFiles(): TFile[];
	getFiles(): TFile[];
	cachedRead(file: TFile): Promise<string>;
};

/**
 * "abc.json" → "abc" when "abc" is a valid block id, else null. Anything
 * else in the sidecar folder is a foreign file that cleanup ignores.
 */
export function parseSidecarBasename(name: string): string | null {
	if (!name.endsWith(".json")) return null;
	const id = name.slice(0, -".json".length);
	return isValidId(id) ? id : null;
}

/** Deduped, sorted ids present among the sidecar files but absent from usedIds. */
export function findOrphanIds(
	sidecarFileNames: string[],
	usedIds: ReadonlySet<string>,
): string[] {
	const orphans = new Set<string>();
	for (const name of sidecarFileNames) {
		const id = parseSidecarBasename(name);
		if (id !== null && !usedIds.has(id)) orphans.add(id);
	}
	return [...orphans].sort();
}

function isObject(v: unknown): v is Record<string, unknown> {
	return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * Union of block ids across every Markdown file and every Canvas text node.
 * Canvas must be scanned: code-block processors run inside canvas cards, so
 * their sidecars are live data. Read errors propagate so the caller aborts
 * without deleting anything (fail-closed).
 */
export async function collectUsedBlockIds(
	vault: VaultLike,
): Promise<Set<string>> {
	const used = new Set<string>();

	for (const file of vault.getMarkdownFiles()) {
		const text = await vault.cachedRead(file);
		for (const id of collectBlockIds(text)) used.add(id);
	}

	const canvasFiles = vault
		.getFiles()
		.filter((f) => f.extension === "canvas");
	for (const file of canvasFiles) {
		const parsed = parseJsonSafe(await vault.cachedRead(file));
		if (!isObject(parsed) || !Array.isArray(parsed.nodes)) continue;
		for (const node of parsed.nodes) {
			if (isObject(node) && typeof node.text === "string") {
				for (const id of collectBlockIds(node.text)) used.add(id);
			}
		}
	}

	return used;
}
