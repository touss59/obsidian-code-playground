import type { Editor, EditorChange, EditorPosition } from "obsidian";
import { parseJsonSafe } from "jsonHelper";
import { isCodePlaygroundConfig } from "config";
import { isValidId, FENCE_NAMES } from "appConstants";

// CommonMark-style fence line: up to 3 leading spaces, a run of >=3
// backticks or tildes, then the info string.
const FENCE_LINE_RE = /^ {0,3}(`{3,}|~{3,})(.*)$/;

type FenceOpen = { marker: string; info: string };

function parseFenceLine(line: string): FenceOpen | null {
	const m = FENCE_LINE_RE.exec(line);
	if (!m?.[1] || m[2] === undefined) return null;
	return { marker: m[1], info: m[2].trim() };
}

function isClosingFenceLine(line: string, open: FenceOpen): boolean {
	const m = parseFenceLine(line);
	return (
		m !== null &&
		m.info === "" &&
		m.marker[0] === open.marker[0] &&
		m.marker.length >= open.marker.length
	);
}

function isObject(v: unknown): v is Record<string, unknown> {
	return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function safeUUID(): string {
	if (
		typeof crypto !== "undefined" &&
		typeof crypto.randomUUID === "function"
	) {
		return crypto.randomUUID();
	}
	return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
		const r = (Math.random() * 16) | 0;
		const v = c === "x" ? r : (r & 0x3) | 0x8;
		return v.toString(16);
	});
}

type FenceMatch = {
	bodyFrom: EditorPosition;
	bodyTo: EditorPosition;
	body: string;
};

type Action =
	| { kind: "inject-empty" }
	| { kind: "inject-into-json"; parsed: Record<string, unknown> }
	| { kind: "skip-malformed" }
	| { kind: "skip-has-id" };

// Structural slice of Editor, so the same scan runs on raw file text.
type LineSource = { lineCount(): number; getLine(line: number): string };

function scanSourceForFences(source: LineSource): FenceMatch[] {
	const fences: FenceMatch[] = [];
	const total = source.lineCount();
	let i = 0;
	while (i < total) {
		const open = parseFenceLine(source.getLine(i));
		if (!open) {
			i++;
			continue;
		}
		const openLine = i;
		let close = -1;
		for (let j = openLine + 1; j < total; j++) {
			if (isClosingFenceLine(source.getLine(j), open)) {
				close = j;
				break;
			}
		}
		// Unterminated fence: the rest of the note is inside it.
		if (close === -1) break;

		// Every fence — a playground fence or not — is consumed up to its
		// close, so a playground example nested inside e.g. a ````markdown
		// documentation fence is never matched.
		if (FENCE_NAMES.includes(open.info)) {
			const bodyLines: string[] = [];
			for (let k = openLine + 1; k < close; k++) {
				bodyLines.push(source.getLine(k));
			}
			fences.push({
				bodyFrom: { line: openLine + 1, ch: 0 },
				bodyTo: { line: close, ch: 0 },
				body: bodyLines.join("\n"),
			});
		}
		i = close + 1;
	}
	return fences;
}

function scanEditorForFences(editor: Editor): FenceMatch[] {
	return scanSourceForFences(editor);
}

/** All valid block ids found in playground fences in `text`. */
export function collectBlockIds(text: string): Set<string> {
	// Vault reads can return CRLF content, unlike Editor.getLine.
	const lines = text.split(/\r?\n/);
	const source: LineSource = {
		lineCount: () => lines.length,
		getLine: (i) => lines[i] ?? "",
	};
	const ids = new Set<string>();
	for (const fence of scanSourceForFences(source)) {
		const parsed = parseJsonSafe(fence.body.trim());
		if (isObject(parsed) && isValidId(parsed.id)) {
			ids.add(parsed.id);
		}
	}
	return ids;
}

function classifyFence(body: string): Action {
	const trimmed = body.trim();
	if (trimmed === "") return { kind: "inject-empty" };
	const parsed = parseJsonSafe(trimmed);
	if (!isObject(parsed)) return { kind: "skip-malformed" };
	if (isValidId(parsed.id)) {
		return { kind: "skip-has-id" };
	}
	return { kind: "inject-into-json", parsed };
}

function buildReplacementBody(
	action: Action,
	defaults: { template: string },
): string | null {
	if (action.kind === "inject-empty") {
		const obj = { id: safeUUID(), template: defaults.template };
		if (!isCodePlaygroundConfig(obj)) return null;
		return JSON.stringify(obj, null, 2) + "\n";
	}
	if (action.kind === "inject-into-json") {
		const obj = { id: safeUUID(), ...action.parsed };
		// Don't clobber user-edited blocks that are slightly invalid —
		// only rewrite when the seeded result passes the schema.
		if (!isCodePlaygroundConfig(obj)) return null;
		return JSON.stringify(obj, null, 2) + "\n";
	}
	return null;
}

export function scanForMissingIds(
	editor: Editor,
	defaults: { template: string },
	options: { emptyFencesOnly?: boolean } = {},
): void {
	const fences = scanEditorForFences(editor);
	if (fences.length === 0) return;

	const changes: EditorChange[] = [];
	for (const f of fences) {
		const action = classifyFence(f.body);

		// The live editor-change hook passes emptyFencesOnly: it seeds only
		// freshly created empty fences and never rewrites existing JSON
		// behind the user's back (key reorder, reformat, undo pollution).
		// The manual command runs without it and fixes JSON blocks too.
		if (options.emptyFencesOnly && action.kind !== "inject-empty") {
			continue;
		}

		const replacement = buildReplacementBody(action, defaults);
		if (replacement === null) continue;
		changes.push({ from: f.bodyFrom, to: f.bodyTo, text: replacement });
	}
	if (changes.length === 0) return;

	editor.transaction({ changes });
}

export const __test = {
	classifyFence,
	buildReplacementBody,
	scanEditorForFences,
};
