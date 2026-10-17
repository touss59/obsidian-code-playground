/**
 * Height in px of a stacked (vertical layout) preview or console pane.
 *
 * Nothing stretches a stacked pane the way a flex row stretches the preview
 * to the editor's height, so it is sized to the preview content as reported
 * by the bundler, bounded by the editor height limits. Expanding lifts the
 * cap, mirroring how "Show more" lets the editor grow past its max.
 *
 * A content height of 0 means the bundler hasn't reported yet (or never
 * will, e.g. an offline preview); fall back to the min so the pane grows to
 * fit the content instead of showing a tall empty pane that then shrinks.
 */
export function stackedPaneHeight(
	contentHeight: number,
	minEditorHeight: number,
	maxEditorHeight: number,
	expanded: boolean,
): number {
	// Merged configs can end up with min > max (block max below the vault
	// min); resolve it the same way the editor clamp does.
	const heightMaxFromSettings = Math.max(maxEditorHeight, minEditorHeight);
	if (contentHeight <= 0) return minEditorHeight;
	const minHeightNeeded = Math.max(contentHeight, minEditorHeight);
	return expanded
		? minHeightNeeded
		: Math.min(minHeightNeeded, heightMaxFromSettings);
}
