import { PREVIEW_HEIGHT_EXTRA_PX } from "appConstants";

/** A "resize" report from the preview, and what it was turned into. */
export type PreviewReport = {
	/** Document height the preview reported. */
	height: number;
	/** Preview iframe height when the report arrived; null if not found. */
	viewport: number | null;
	/** Content height derived from the report (see nextContentHeight). */
	contentHeight: number;
};

/**
 * Turns a "resize" report into the content height to size the pane to, or 0
 * when the report says nothing about the content. `prev` is the previous
 * report, null for the first one.
 *
 * Viewport-relative content (`height: 100%`, `100vh`, with or without
 * margins) reports the viewport height plus a constant. Sizing the pane to
 * it changes the viewport, which changes the report, so it must never feed
 * back:
 *
 * 1. The viewport changed since the previous report and the report changed
 *    by the same amount: the content follows the viewport. 0.
 * 2. The report equals the viewport: the content fills it, or is exactly that
 *    tall. Keep the previous content height, so the pane doesn't change and
 *    can't trigger a new report. Without one, use the report as is.
 * 3. Otherwise the report is the content's own height. Pad it by
 *    PREVIEW_HEIGHT_EXTRA_PX so the content is not clipped.
 */
export function nextContentHeight(
	prev: PreviewReport | null,
	next: { height: number; viewport: number | null },
): number {
	const { height, viewport } = next;
	if (viewport === null) return height + PREVIEW_HEIGHT_EXTRA_PX;

	if (prev !== null && prev.viewport !== null) {
		const viewportDelta = viewport - prev.viewport;
		const heightDelta = height - prev.height;
		if (Math.abs(viewportDelta) > 1 && Math.abs(heightDelta - viewportDelta) <= 1) {
			return 0;
		}
	}
	if (Math.abs(height - viewport) <= 1) {
		return prev !== null && prev.contentHeight > 0 ? prev.contentHeight : height;
	}
	return height + PREVIEW_HEIGHT_EXTRA_PX;
}
