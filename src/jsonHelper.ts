export function parseJsonSafe(s: string): unknown {
	try {
		return JSON.parse(s);
	} catch {
		return null;
	}
}
