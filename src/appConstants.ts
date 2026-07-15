/**
 * Centralized constants for Code Playground.
 *
 * Timer durations (in milliseconds) and shared validation helpers live here so
 * that tuning a value happens in exactly one place.
 */

// --- Timers (ms) ---------------------------------------------------------

/** How long to wait for Sandpack's "done" message before assuming it loaded. */
export const APP_LOAD_TIMEOUT_MS = 3000;

/** Debounce window before persisting edited files to the sidecar. */
export const SAVE_FILES_DEBOUNCE_MS = 1000;

/** Debounce window before persisting the hidden-files set. */
export const HIDDEN_FILES_DEBOUNCE_MS = 1000;

/** Debounce window before persisting the editor column width. */
export const EDITOR_WIDTH_DEBOUNCE_MS = 300;

/** Throttle interval for the resizer drag handler (~60fps). */
export const RESIZER_THROTTLE_MS = 16;

/** Debounce window for the editor-change id scan. */
export const ID_SCAN_DEBOUNCE_MS = 500;

// --- Storage --------------------------------------------------------------

/**
 * Default vault folder for playground sidecars. Lives here (not settings.ts)
 * so SidecarStore can use it as a safe fallback without a circular import.
 */
export const DEFAULT_PLAYGROUND_FOLDER = "_playgrounds";

// --- Fence names ----------------------------------------------------------

/**
 * Info strings that mark a Code Playground fenced block. Both render
 * identically; `code-playground` is the canonical lowercase name and
 * `codePlayground` is kept for back-compatibility. All are recognized by the
 * block processor, auto-id injection, and sidecar cleanup.
 */
export const FENCE_NAMES: readonly string[] = ["code-playground", "codePlayground"];

/** Fence name emitted when inserting a new block. */
export const CANONICAL_FENCE_NAME = "code-playground";

// --- Documentation --------------------------------------------------------

/** Plugin documentation, including the list of valid config keys. */
export const DOCS_URL = "https://github.com/touss59/obsidian-code-playground#readme";

// --- Validation ----------------------------------------------------------

/**
 * Allowed shape for a block `id`. The id is used verbatim as a sidecar
 * filename, so it must not contain path separators, "..", or leading dots.
 */
export const ID_RE = /^[A-Za-z0-9_-]+$/;

/** Returns true when `id` is a safe, filename-friendly identifier. */
export function isValidId(id: unknown): id is string {
	return typeof id === "string" && id.length > 0 && ID_RE.test(id);
}
