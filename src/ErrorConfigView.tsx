import { ConfigError, KnownConfigError, isUnknownKeyError } from "config";
import { DOCS_URL } from "appConstants";

const errorMessages: Record<KnownConfigError, string> = {
	source_missing: "The configuration is missing or invalid",
	missing_id: "ID is required - add an 'id' field to your configuration",
	invalid_id:
		"ID may only contain letters, numbers, hyphens, and underscores (no slashes, spaces, or dots)",
	missing_template:
		"Template is required - must be a valid CodeSandbox template (e.g., 'react', 'vanilla', 'vue')",
	invalid_template: "The template value is invalid",
	invalid_borderColor:
		"Border color must be a valid hex color (e.g., '#FF0000')",
	invalid_maxEditorHeight: "Max editor height must be a positive integer",
	invalid_minEditorHeight: "Min editor height must be a positive integer",
	invalid_theme:
		"Theme must be 'light', 'dark', 'auto', or a named theme from @codesandbox/sandpack-themes",
	invalid_showEditor: "showEditor must be a boolean (true or false)",
	invalid_showPreview: "showPreview must be a boolean (true or false)",
	invalid_showConsole: "showConsole must be a boolean (true or false)",
	invalid_showFileTabs: "showFileTabs must be a boolean (true or false)",
	invalid_buttonBackgroundColor:
		"Button background color must be a valid hex color (e.g., '#FFFFFF')",
	invalid_buttonTextColor:
		"Button text color must be a valid hex color (e.g., '#000000')",
	invalid_showOpenInCodeSandbox:
		"showOpenInCodeSandbox must be a boolean (true or false)",
	no_panel_visible:
		"At least one of showEditor, showPreview, or showConsole must be true",
	min_greater_than_max:
		"minEditorHeight cannot be greater than maxEditorHeight",
};

export function ErrorConfigView({ errors }: { errors: ConfigError[] }) {
	return (
		<div>
			<h3 className="cp-config-error-title">
				Invalid configuration for playground block
			</h3>
			{errors.length > 0 && (
				<ul>
					{errors.map((error) => (
						<li key={error}>
							{isUnknownKeyError(error) ? (
								<>
									{`'${error.slice("unknown_key:".length)}' is not a valid configuration key - see the `}
									<a
										href={DOCS_URL}
										target="_blank"
										rel="noopener noreferrer"
									>
										list of valid keys
									</a>
								</>
							) : (
								errorMessages[error]
							)}
						</li>
					))}
				</ul>
			)}
			<p className="cp-config-error-docs">
				{"See -> "}
				<a
					href={DOCS_URL}
					target="_blank"
					rel="noopener noreferrer"
				>
					Documentation
				</a>
			</p>
		</div>
	);
}
