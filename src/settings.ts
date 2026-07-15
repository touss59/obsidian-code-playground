import {
	App,
	Notice,
	PluginSettingTab,
	Setting,
	TextComponent,
} from "obsidian";
import CodePlayground from "main";
import { SandpackPredefinedTemplate } from "@codesandbox/sandpack-react/types";
import { VALID_TEMPLATES } from "config";
import { VALID_THEMES } from "themes";
import { HEX_COLOR_RE, isHttpUrl, isSafeVaultFolder } from "validators";
import { DEFAULT_PLAYGROUND_FOLDER } from "appConstants";

export interface CodePlaygroundSettings {
	template: SandpackPredefinedTemplate;
	borderColor: string;
	maxEditorHeight: number;
	minEditorHeight: number;
	theme: string;
	showEditor: boolean;
	showPreview: boolean;
	showConsole: boolean;
	showFileTabs: boolean;
	buttonBackgroundColor?: string;
	buttonTextColor?: string;
	showOpenInCodeSandbox: boolean;
	playgroundFolder: string;
	bundlerURL?: string;
}

export const DEFAULT_SETTINGS: CodePlaygroundSettings = {
	template: "react",
	borderColor: "#D3D3D3",
	maxEditorHeight: 400,
	minEditorHeight: 100,
	theme: "auto",
	showEditor: true,
	showPreview: true,
	showConsole: false,
	showFileTabs: true,
	showOpenInCodeSandbox: false,
	playgroundFolder: DEFAULT_PLAYGROUND_FOLDER,
};

/**
 * Commit a text setting on blur rather than per keystroke, so partial input
 * isn't rejected with notice spam (and every playground isn't re-rendered)
 * mid-typing. Reverts the input to the current value when validation fails.
 */
function commitOnBlur(
	text: TextComponent,
	options: {
		/** Current persisted value as displayed text; used to skip no-op commits and revert invalid input. */
		getCurrent: () => string;
		/** Returns a Notice message when invalid, or null when valid. Called at commit time so cross-field checks read fresh state. */
		validate: (value: string) => string | null;
		/** Persists the trimmed, validated value. */
		apply: (value: string) => Promise<void>;
	},
): void {
	const commit = async () => {
		const value = text.getValue().trim();
		if (value === options.getCurrent()) {
			return;
		}
		const error = options.validate(value);
		if (error !== null) {
			new Notice(error);
			text.setValue(options.getCurrent());
			return;
		}
		await options.apply(value);
	};
	// The input is destroyed by containerEl.empty() on redisplay, so this
	// listener's lifetime equals the element's. Routing through
	// plugin.registerDomEvent would instead accumulate registrations across
	// display() calls until plugin unload.
	text.inputEl.addEventListener("blur", () => void commit());
}

export class CodePlaygroundSettingTab extends PluginSettingTab {
	plugin: CodePlayground;

	constructor(app: App, plugin: CodePlayground) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName("Default template")
			.setDesc(
				"Enter your default template. For more info you can check https://sandpack.codesandbox.io/docs/getting-started/usage#templates",
			)
			.addDropdown((dd) => {
				VALID_TEMPLATES.forEach((t) => {
					dd.addOption(t, t);
				});
				dd.setValue(this.plugin.settings.template).onChange(
					(value) => {
						if (
							!VALID_TEMPLATES.includes(
								value as SandpackPredefinedTemplate,
							)
						) {
							new Notice(`Invalid template: ${value}`);
							return;
						}
						this.plugin.settings.template =
							value as SandpackPredefinedTemplate;
						void this.plugin.saveSettings();
					},
				);
			});

		new Setting(containerEl)
			.setName("Default border color")
			.setDesc("Hex color for the border around each playground container.")
			.addText((text) => {
				text.setValue(this.plugin.settings.borderColor);
				commitOnBlur(text, {
					getCurrent: () => this.plugin.settings.borderColor,
					validate: (value) =>
						HEX_COLOR_RE.test(value)
							? null
							: `Invalid border color: ${value}`,
					apply: async (value) => {
						this.plugin.settings.borderColor = value;
						await this.plugin.saveSettings();
					},
				});
			});

		new Setting(containerEl)
			.setName("Default max editor height")
			.setDesc("Maximum height of the editor pane in pixels.")
			.addText((text) => {
				text.setValue(String(this.plugin.settings.maxEditorHeight));
				commitOnBlur(text, {
					getCurrent: () =>
						String(this.plugin.settings.maxEditorHeight),
					validate: (value) => {
						const numValue = parseInt(value, 10);
						if (isNaN(numValue) || numValue <= 0) {
							return `Invalid max editor height: ${value}`;
						}
						if (numValue < this.plugin.settings.minEditorHeight) {
							return `Max editor height cannot be below min (${this.plugin.settings.minEditorHeight})`;
						}
						return null;
					},
					apply: async (value) => {
						this.plugin.settings.maxEditorHeight = parseInt(
							value,
							10,
						);
						await this.plugin.saveSettings();
					},
				});
			});

		new Setting(containerEl)
			.setName("Default min editor height")
			.setDesc("Minimum height of the editor pane in pixels. Must be ≤ max.")
			.addText((text) => {
				text.setValue(String(this.plugin.settings.minEditorHeight));
				commitOnBlur(text, {
					getCurrent: () =>
						String(this.plugin.settings.minEditorHeight),
					validate: (value) => {
						const numValue = parseInt(value, 10);
						if (isNaN(numValue) || numValue <= 0) {
							return `Invalid min editor height: ${value}`;
						}
						if (numValue > this.plugin.settings.maxEditorHeight) {
							return `Min editor height cannot exceed max (${this.plugin.settings.maxEditorHeight})`;
						}
						return null;
					},
					apply: async (value) => {
						this.plugin.settings.minEditorHeight = parseInt(
							value,
							10,
						);
						await this.plugin.saveSettings();
					},
				});
			});

		new Setting(containerEl)
			.setName("Default theme")
			.setDesc(
				"Sandpack theme — 'light', 'dark', 'auto', or a named theme from @codesandbox/sandpack-themes",
			)
			.addDropdown((dd) => {
				VALID_THEMES.forEach((t) => {
					dd.addOption(t, t);
				});
				dd.setValue(this.plugin.settings.theme).onChange(
					(value) => {
						if (!VALID_THEMES.includes(value)) {
							new Notice(`Invalid theme: ${value}`);
							return;
						}
						this.plugin.settings.theme = value;
						void this.plugin.saveSettings();
					},
				);
			});

		new Setting(containerEl)
			.setName("Show editor")
			.setDesc("Show the code editor pane by default.")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.showEditor)
					.onChange(async (value) => {
						this.plugin.settings.showEditor = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Show preview")
			.setDesc("Show the live preview pane by default.")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.showPreview)
					.onChange(async (value) => {
						this.plugin.settings.showPreview = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Show console")
			.setDesc("Show the console pane by default.")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.showConsole)
					.onChange(async (value) => {
						this.plugin.settings.showConsole = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Show file tabs")
			.setDesc("Show file tabs in the editor by default.")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.showFileTabs)
					.onChange(async (value) => {
						this.plugin.settings.showFileTabs = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Button background color")
			.setDesc("Hex color; leave empty to use the theme default.")
			.addText((text) => {
				text.setValue(
					this.plugin.settings.buttonBackgroundColor ?? "",
				);
				commitOnBlur(text, {
					getCurrent: () =>
						this.plugin.settings.buttonBackgroundColor ?? "",
					validate: (value) =>
						value === "" || HEX_COLOR_RE.test(value)
							? null
							: `Invalid button background color: ${value}`,
					apply: async (value) => {
						this.plugin.settings.buttonBackgroundColor =
							value === "" ? undefined : value;
						await this.plugin.saveSettings();
					},
				});
			});

		new Setting(containerEl)
			.setName("Button text color")
			.setDesc("Hex color; leave empty to use the theme default.")
			.addText((text) => {
				text.setValue(this.plugin.settings.buttonTextColor ?? "");
				commitOnBlur(text, {
					getCurrent: () =>
						this.plugin.settings.buttonTextColor ?? "",
					validate: (value) =>
						value === "" || HEX_COLOR_RE.test(value)
							? null
							: `Invalid button text color: ${value}`,
					apply: async (value) => {
						this.plugin.settings.buttonTextColor =
							value === "" ? undefined : value;
						await this.plugin.saveSettings();
					},
				});
			});

		new Setting(containerEl)
			.setName("Show button to open in code sandbox")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.showOpenInCodeSandbox)
					.onChange(async (value) => {
						this.plugin.settings.showOpenInCodeSandbox = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Playground sidecar folder")
			.setDesc(
				"Vault-relative folder where playground state is saved as JSON sidecars. Existing sidecars in the old folder are left in place; only new writes go to the new folder.",
			)
			.addText((text) => {
				text.setValue(this.plugin.settings.playgroundFolder);
				commitOnBlur(text, {
					getCurrent: () => this.plugin.settings.playgroundFolder,
					validate: (value) => {
						if (value.length === 0) {
							return "Playground folder cannot be empty";
						}
						// normalizePath doesn't resolve ".." — reject
						// anything that could escape the vault.
						if (!isSafeVaultFolder(value)) {
							return "Playground folder must be a folder inside the vault (no '.' or '..' segments, no absolute paths)";
						}
						return null;
					},
					apply: async (value) => {
						this.plugin.settings.playgroundFolder = value;
						this.plugin.sidecarStore.setFolder(value);
						await this.plugin.saveSettings();
					},
				});
			});

		new Setting(containerEl)
			.setName("Self-hosted bundler URL")
			.setDesc(
				"Advanced. Route playground compilation to your own Sandpack bundler instead of CodeSandbox's hosted service. Leave empty to use the default. See https://sandpack.codesandbox.io/docs/guides/hosting-the-bundler",
			)
			.addText((text) => {
				text.setValue(this.plugin.settings.bundlerURL ?? "");
				commitOnBlur(text, {
					getCurrent: () => this.plugin.settings.bundlerURL ?? "",
					validate: (value) =>
						value === "" || isHttpUrl(value)
							? null
							: `Invalid bundler URL: ${value}`,
					apply: async (value) => {
						this.plugin.settings.bundlerURL =
							value === "" ? undefined : value;
						await this.plugin.saveSettings();
					},
				});
			});
	}
}
