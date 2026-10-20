import type { CSSProperties } from "react";
import type { ResolvedCodePlaygroundConfig } from "config";

/** CSS variables for a `.cp-root` element: the block, or the full-screen modal. */
export function rootStyle(config: ResolvedCodePlaygroundConfig): CSSProperties {
	return {
		"--cp-border": config.borderColor,
		"--cp-button-bg": config.buttonBackgroundColor,
		"--cp-button-text": config.buttonTextColor,
	} as CSSProperties;
}
