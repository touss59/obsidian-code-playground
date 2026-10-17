/**
 * Height in px of a stacked (vertical layout) preview or console pane.
 *
 * Nothing stretches a stacked pane the way a flex row stretches the preview
 * to the editor's height, so it is sized to the preview content as reported
 * by the bundler, bounded by the editor height limits. Expanding lifts the
 * cap, mirroring how "Show more" lets the editor grow past its max.
 *
 * A content height of 0 means the bundler hasn't reported yet (or never
 * will, e.g. an offline preview); fall back to the cap so the pane stays
 * usable rather than collapsing to the minimum.
 */
export function stackedPaneHeight(
	contentHeight: number,
	minEditorHeight: number,
	maxEditorHeight: number,
	expanded: boolean,
): number {
	// Merged configs can end up with min > max (block max below the vault
	// min); resolve it the same way the editor clamp does.
	const cap = Math.max(maxEditorHeight, minEditorHeight);
	if (contentHeight <= 0) return cap;
	const floored = Math.max(contentHeight, minEditorHeight);
	return expanded ? floored : Math.min(floored, cap);
}
