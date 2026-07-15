export const HEX_COLOR_RE = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

export const FILE_EXTENSION_RE = /\.[a-z0-9]+$/i;

/**
 * Guard for user-created playground file paths, in the leading-slash form
 * Sandpack uses (e.g. "/src/App.js"): no backslashes, no empty, "." or ".."
 * segments, and a file extension on the last segment.
 */
export function isValidPlaygroundFilePath(path: string): boolean {
	if (!path.startsWith("/")) return false;
	if (path.includes("\\")) return false;
	const segmentsAreSafe = path
		.slice(1)
		.split("/")
		.every((s) => s !== "" && s !== "." && s !== "..");
	return segmentsAreSafe && FILE_EXTENSION_RE.test(path);
}

/**
 * True if `value` is an absolute http(s) URL. Validates the self-hosted Sandpack
 * bundler endpoint. Only http/https are allowed — other schemes (javascript:,
 * data:, file:) must never reach the bundler iframe. localhost/LAN over http is
 * permitted so users can self-host a bundler locally (Chromium treats localhost
 * as a secure context).
 */
export function isHttpUrl(value: string): boolean {
	let url: URL;
	try {
		url = new URL(value);
	} catch {
		return false;
	}
	return url.protocol === "http:" || url.protocol === "https:";
}

/**
 * Vault-relative folder guard for the playground sidecar folder. Obsidian's
 * `normalizePath` does NOT resolve ".." segments, so traversal and absolute
 * paths must be rejected up front or the folder can escape the vault.
 */
export function isSafeVaultFolder(path: string): boolean {
	if (path.length === 0) return false;
	// Absolute paths (POSIX, UNC, or Windows drive-letter) are never
	// vault-relative.
	if (path.startsWith("/") || path.startsWith("\\")) return false;
	if (/^[a-zA-Z]:/.test(path)) return false;
	// Every segment must be a real folder name: no "", "." or "..".
	return path
		.split(/[/\\]/)
		.every((s) => s !== "" && s !== "." && s !== "..");
}
