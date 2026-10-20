# Code Playground

Embed live, editable [Sandpack](https://sandpack.codesandbox.io/) code playgrounds inside your Obsidian notes. Write a fenced block, get a working React (or Vue, Vanilla, Svelte, Angular…) sandbox that runs in-place.

![Demo](https://raw.githubusercontent.com/touss59/obsidian-code-playground/main/docs/demoPlugin.gif)

## ⚠️ Network use & privacy — please read

This plugin relies on [Sandpack](https://sandpack.codesandbox.io/), which uses **CodeSandbox's hosted services**. Before you use it, understand what leaves your machine:

- **Your playground code is sent to a third party to compile.** To build a live preview, Sandpack sends the code you type in a playground to CodeSandbox's hosted bundler service (`*.codesandbox.io`), which runs in an iframe. npm packages you import are resolved from CodeSandbox's registry / CDN.
- **The bundler endpoint is configurable.** If you'd rather not send code to CodeSandbox, set a **Self-hosted bundler URL** in the settings tab to point Sandpack at a [self-hosted bundler](https://sandpack.codesandbox.io/docs/guides/hosting-the-bundler) you control. When set, playground code and dependency resolution go to that endpoint instead of `*.codesandbox.io`.
- **A working internet connection is required** to render previews. There is no fully offline mode today.
- **The "Open in CodeSandbox" button uploads your code.** When `showOpenInCodeSandbox` is enabled and you click it, the block's code is exported to codesandbox.io to open it there. This button is **off by default**.
- Mobile (iOS / Android) is **supported but experimental** — see [Platform support](#platform-support).

If any of your playground content is sensitive, do not put it in a block, because compiling it will transmit it to CodeSandbox. See [Sandpack's docs](https://sandpack.codesandbox.io/) and [CodeSandbox's privacy policy](https://codesandbox.io/legal/privacy) for details on their handling of submitted code.

## Features

- Live, in-note code editor + preview powered by Sandpack.
- Editor with search and replace, code folding, multiple cursors, autocomplete, and Prettier formatting with `.prettierrc` support.
- Full-screen mode: a large editor and preview in a modal, with a draggable split.
- Supports every Sandpack template (`react`, `vanilla`, `vue`, `angular`, `svelte`, …).
- Per-block JSON overrides for template, theme, layout, panel visibility, sizing, colors.
- Side-by-side or stacked full-width panel layout, set vault-wide or per block.
- Edits persist to per-block JSON sidecar files in your vault — they sync wherever the vault syncs.
- Settings tab to set defaults once for every block in your vault.
- Optional console panel and "Open in CodeSandbox" export button.

## Installation

### From the community catalog

1. Open **Settings → Community plugins → Browse**.
2. Search for **Code Playground**.
3. Install, then enable.

### Manual install

1. Download `main.js`, `manifest.json`, and `styles.css` from the [latest release](https://github.com/touss59/obsidian-code-playground/releases).
2. Copy them into `<your-vault>/.obsidian/plugins/code-playground/`.
3. In Obsidian, open **Settings → Community plugins** and enable **Code Playground**.

## Your first playground

Write this into any note:

````markdown
```code-playground
```
````

That's the minimum. As you type, the plugin automatically assigns each *empty* block a stable `id` (shortly after you create it) so its edits can be persisted. From then on, edits inside the playground are saved to a sidecar file (see [Storage](#storage)).

If you paste or write a block that already has some JSON but no `id`, the automatic scan leaves it alone — run the **Assign missing block identifiers** command to fill those in.

> The legacy `codePlayground` (camelCase) fence is still recognized, so existing notes keep working. New blocks use `code-playground`.

## Configuration reference

The block body is JSON. Both `id` and `template` are required — a block missing either one renders an inline error view instead of running. Every other field is optional and falls back to the plugin-wide default from the settings tab. You rarely write `id` by hand: an empty block gets one injected automatically as you type (see [Your first playground](#your-first-playground)).

| Field                   | Type                              | Default (from settings) | Notes                                                                                                |
| ----------------------- | --------------------------------- | ----------------------- | ---------------------------------------------------------------------------------------------------- |
| `id`                    | string                            | auto-generated UUID     | Stable identifier used to look up the sidecar. Don't change after creation.                          |
| `template`              | Sandpack template name            | `"react"`               | Any key from Sandpack's [`SANDBOX_TEMPLATES`](https://sandpack.codesandbox.io/docs/getting-started/usage#templates). |
| `theme`                 | string                            | `"auto"`                | `"light"`, `"dark"`, `"auto"`, or any named theme from `@codesandbox/sandpack-themes`.                |
| `layout`                | `"horizontal"` or `"vertical"`    | `"horizontal"`          | `horizontal` puts the editor and preview side by side. `vertical` stacks them so each spans the full note width. See [Panel heights](#panel-heights). |
| `borderColor`           | hex color (e.g. `"#D3D3D3"`)      | `"#D3D3D3"`             | Border around the playground container.                                                              |
| `maxEditorHeight`       | positive number (px)              | `400`                   | Maximum height of the editor panel. In the `vertical` layout, also limits the preview/console pane. |
| `minEditorHeight`       | positive number (px)              | `100`                   | Minimum height of the editor panel. Must be ≤ `maxEditorHeight`. In the `vertical` layout, also limits the preview/console pane. |
| `showEditor`            | boolean                           | `true`                  | Show the code editor pane.                                                                           |
| `showPreview`           | boolean                           | `true`                  | Show the live preview pane.                                                                          |
| `showConsole`           | boolean                           | `false`                 | Show the console pane below.                                                                         |
| `showFileTabs`          | boolean                           | `true`                  | Show file tabs in the editor.                                                                        |
| `buttonBackgroundColor` | hex color or omitted              | (theme default)         | Overrides button background. Omit to inherit from the Sandpack theme.                                |
| `buttonTextColor`       | hex color or omitted              | (theme default)         | Overrides button text color. Omit to inherit from the Sandpack theme.                                |
| `showOpenInCodeSandbox` | boolean                           | `false`                 | Show the "Open in CodeSandbox" export button.                                                        |

**Validation rules** (an invalid block renders an inline error view instead of running):

- At least one of `showEditor`, `showPreview`, `showConsole` must be `true`.
- `minEditorHeight` must be ≤ `maxEditorHeight`.
- Hex colors must match `#RGB` or `#RRGGBB` (case-insensitive).
- Heights must be positive numbers.

## Panel heights

Panels size to their content, between `minEditorHeight` and `maxEditorHeight`:

- **Side by side:** the editor and preview share one row. The row fits the taller of the code and the preview content.
- **Stacked:** the editor fits its code, and the preview fits its content.

To change a height:

- **Show more** (under the block) removes the max, so all of the content shows. The button appears only when the max cuts off some code or preview content. It is not saved: the next time the note opens, the block is collapsed again.
- **Drag** the handle under a panel to set its height. Side by side, one handle under the row sets both panels. Stacked, each panel has its own handle. The height is saved with the block. It cannot go below `minEditorHeight`, but it can go above `maxEditorHeight`. A dragged panel keeps its height: **Show more** ignores it.
- **Double-click** the handle to remove the dragged height. The panel then sizes to its content again.

Content that fills its viewport (for example `height: 100vh`) has no height of its own. Its preview stays at `minEditorHeight` until you drag it.

## Editor

The editor is Sandpack's CodeMirror editor with extra extensions. The **Editor** settings turn each one on or off for every block (see [Settings](#settings)). Shortcuts apply while the editor has focus.

| Action                      | Shortcut                                                                             |
| --------------------------- | ------------------------------------------------------------------------------------ |
| Find and replace            | `Ctrl/Cmd + F`                                                                       |
| Next / previous match       | `F3` / `Shift + F3`, or `Ctrl/Cmd + G` / `Ctrl/Cmd + Shift + G`                      |
| Select the next occurrence  | `Ctrl/Cmd + D`                                                                       |
| Select all occurrences      | `Ctrl/Cmd + Shift + L`                                                               |
| Go to line                  | `Ctrl/Cmd + Alt + G`                                                                 |
| Fold / unfold at the cursor | `Ctrl + Shift + [` / `]` (macOS: `Cmd + Alt + [` / `]`), or click the gutter marker |
| Fold / unfold all           | `Ctrl + Alt + [` / `]`                                                               |
| Add a cursor                | `Ctrl/Cmd + click`                                                                   |
| Select a rectangle          | `Alt + drag`                                                                         |
| Open autocomplete           | `Ctrl + Space` (it also opens as you type)                                           |
| Format the file             | `Shift + Alt + F`, or `Ctrl/Cmd + S` when **Format on save** is on                   |

### Formatting

**Format** runs [Prettier](https://prettier.io/) on the current file. It supports JavaScript, TypeScript, JSX, TSX, JSON, CSS, SCSS, Less, HTML and Vue files. Other file types show a notice. One undo reverts a format. On a syntax error, a notice shows the first line of Prettier's message and the code stays as it is.

**Format on save** shows no notice. On other file types it does nothing, and on a syntax error it keeps the code as it is.

To set Prettier options, add a `/.prettierrc` or `/.prettierrc.json` file to the playground with **Manage files**. The file must be JSON. Only these keys apply: `printWidth`, `tabWidth`, `useTabs`, `semi`, `singleQuote`, `jsxSingleQuote`, `quoteProps`, `trailingComma`, `bracketSpacing`, `bracketSameLine`, `arrowParens`, `singleAttributePerLine`.

```json
{ "semi": false, "singleQuote": true, "tabWidth": 4 }
```

## Full-screen editor

**Full screen** (bottom right of the editor) opens the block in a large modal: the editor on one side, the preview or console on the other. It is the same playground. Edits save to the block and show in it when you close the modal. The modal has its own **Format** and **Manage files** buttons.

- **Drag** the divider between the editor and the preview to change the split. The width is saved with the block, separate from the block's own editor width.
- **Double-click** the divider to return to an even split.
- On a narrow window the panes stack and the divider is hidden.
- Close the modal with `Escape`, the close button, or a click outside it. If the search panel or the autocomplete list is open, `Escape` closes it first.

## Per-block overrides

Any field above can be overridden on a single block without touching the plugin settings. Example — a dark-themed React playground with the console enabled and a custom border:

````markdown
```code-playground
{
  "id": "myID",
  "template": "react",
  "theme": "dark",
  "borderColor": "#444",
  "showConsole": true
}
```
````

Plugin defaults apply to every field you don't specify.

## Supported templates and themes

**Templates** are whatever Sandpack ships in `SANDBOX_TEMPLATES`. Common ones include `react`, `react-ts`, `vanilla`, `vanilla-ts`, `vue`, `angular`, `svelte`, `solid`, `nextjs`, `static`. See the [Sandpack docs](https://sandpack.codesandbox.io/docs/getting-started/usage#templates) for the canonical list.

**Themes** can be:

- `"light"`, `"dark"`, `"auto"` (built-in strings), or
- the name of any theme exported by [`@codesandbox/sandpack-themes`](https://sandpack.codesandbox.io/docs/getting-started/themes) — e.g. `"amethyst"`, `"aquaBlue"`, `"githubLight"`, `"monokaiPro"`, `"nightOwl"`.

The settings tab dropdown lists every value the current bundle supports.

## Settings

Open **Settings → Code Playground** to set vault-wide defaults:

- **Default template** — the Sandpack template used when a block doesn't set one.
- **Default border color** — hex color for the container border.
- **Default max / min editor height** — pixel bounds for the editor panel.
- **Default theme** — Sandpack theme name.
- **Default layout** — `horizontal` (editor and preview side by side) or `vertical` (panels stacked, each spanning the full note width). See [Panel heights](#panel-heights).
- **Show editor / preview / console / file tabs** — default panel visibility.
- **Button background / text color** — leave empty to use the Sandpack theme's defaults; set a hex value to override.
- **Show 'Open in CodeSandbox' button** — adds an export button to every block.
- **Playground sidecar folder** — vault-relative folder where per-block state is stored (default `_playgrounds`). Changing this only affects new writes; existing sidecars in the old folder stay where they are.
- **Self-hosted bundler URL** — advanced. Point Sandpack at your own bundler instead of CodeSandbox's hosted service, so playground code and dependency resolution go to an endpoint you control. Leave empty to use the default. See [Network use & privacy](#️-network-use--privacy--please-read).
- **Editor → Line numbers / Inline errors / Wrap lines / Autocomplete** — editor features for every block. *Inline errors* highlights the line a bundler error points at. See [Editor](#editor).
- **Editor → Format on save** — `Ctrl/Cmd + S` in the editor formats the file with Prettier. `Shift + Alt + F` always formats. See [Formatting](#formatting).

## Commands

Run these from Obsidian's **Command palette** (`Ctrl/Cmd + P`), where they appear prefixed with the plugin name, e.g. **Code Playground: Insert block**. You can also assign a hotkey to any of them in **Settings → Hotkeys** (search for "Code Playground").

- **Assign missing block identifiers** — scans the active note and writes a fresh UUID into every `code-playground` block that doesn't already have an `id`, including blocks that already contain JSON. The automatic scan (debounced, while you type) only seeds *empty* blocks, so run this command whenever a block with existing JSON needs an id. *Requires an open note in editing mode.*
- **Insert block** — inserts a ready-to-edit `code-playground` block at the cursor, pre-seeded with a fresh `id` and your default template. *Requires an open note in editing mode.*
- **Remove unused sidecar files** — scans every Markdown and Canvas file in the vault for `code-playground` block ids, then deletes any sidecar in the playground folder whose id no longer appears anywhere. Shows a confirmation listing the exact files first; deletion follows your **Deleted files** preference (system trash / vault trash / permanent), so removed sidecars stay recoverable. Available anywhere (no note required).

## Storage

Each block's edits live in their own JSON file inside the vault:

```
<vault>/<playgroundFolder>/<block-id>.json
```

The folder defaults to `_playgrounds/`. The sidecar schema (only `version` and `files` are always present; the rest are written as needed):

```json
{
  "version": 1,
  "files": { "/App.js": "…", "/index.js": "…" },
  "activeFile": "/App.js",
  "editorWidth": 480,
  "fullscreenEditorWidth": 900,
  "rowHeight": 320,
  "hiddenFiles": ["/index.js"]
}
```

`editorWidth` and `fullscreenEditorWidth` are the dragged editor widths of the block and of the full-screen modal. `rowHeight`, `editorHeight` and `paneHeight` are the dragged panel heights (see [Panel heights](#panel-heights)).

Because the sidecars live in the vault, they sync wherever your vault syncs (Obsidian Sync, iCloud, Dropbox, Git, …). No localStorage, no extra config.

> **Heads up:** deleting a `code-playground` block from a note does **not** delete its sidecar immediately. To reclaim space, run the **Remove unused sidecar files** command — it deletes according to your **Deleted files** setting, so the files stay recoverable.

## Platform support

- **Desktop (Windows / macOS / Linux):** tested and supported.
- **Mobile (iOS / Android):** **supported, but experimental.** The plugin runs on Obsidian mobile (`isDesktopOnly: false`), but mobile is not yet thoroughly tested. Because Sandpack runs code in an iframe and pulls its bundler from a CDN, previews depend on the mobile webview and a working connection, and some templates may load slowly or unreliably. If you hit a mobile-specific issue, please open one on the repo.

## Known limitations

- Sandpack downloads its bundler from a CDN on first run, so a working internet connection is needed for new blocks. Once cached, the same template usually loads offline.
- Sidecar cleanup is manual: run **Remove unused sidecar files** after deleting blocks (see [Storage](#storage)). Notes in Obsidian's `.trash` and other non-indexed locations are not scanned, so if you restore such a note you may need to restore its sidecar from the trash too.

## Building from source

```sh
npm install
npm run build
```

Drop the built `main.js`, `manifest.json`, and `styles.css` into `<vault>/.obsidian/plugins/code-playground/` to test against a real vault.

## License

[MIT](https://opensource.org/license/mit) — see `LICENSE`.