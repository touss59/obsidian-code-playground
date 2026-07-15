import * as sandpackThemes from "@codesandbox/sandpack-themes";
import type { SandpackThemeProp } from "@codesandbox/sandpack-react/types";

const STRING_THEMES = ["light", "dark", "auto"] as const;
const THEME_OBJECT_NAMES = Object.keys(sandpackThemes);

export const VALID_THEMES: string[] = [...STRING_THEMES, ...THEME_OBJECT_NAMES];

export function resolveTheme(name: string): SandpackThemeProp {
	if ((STRING_THEMES as readonly string[]).includes(name)) {
		return name as SandpackThemeProp;
	}
	const themes = sandpackThemes as Record<string, SandpackThemeProp>;
	return themes[name] ?? "light";
}
