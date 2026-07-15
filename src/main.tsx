import {
	debounce,
	Editor,
	MarkdownPostProcessorContext,
	MarkdownRenderChild,
	Notice,
	Plugin,
} from "obsidian";
import {
	DEFAULT_SETTINGS,
	CodePlaygroundSettings,
	CodePlaygroundSettingTab,
} from "settings";
import { createRoot, Root } from "react-dom/client";
import { CodePlaygroundApp } from "CodePlaygroundBlock/CodePlaygroundApp";
import { parseJsonSafe } from "jsonHelper";
import { getConfigErrors, isCodePlaygroundConfig } from "config";
import { ErrorConfigView } from "ErrorConfigView";
import { SidecarStore } from "storage/SidecarStore";
import { safeUUID, scanForMissingIds } from "idInjector";
import {
	collectUsedBlockIds,
	findOrphanIds,
	parseSidecarBasename,
} from "sidecarCleanup";
import { ConfirmModal } from "ConfirmModal";
import {
	ID_SCAN_DEBOUNCE_MS,
	FENCE_NAMES,
	CANONICAL_FENCE_NAME,
} from "appConstants";

export default class CodePlayground extends Plugin {
	settings!: CodePlaygroundSettings;
	sidecarStore!: SidecarStore;
	private roots = new Map<HTMLElement, Root>();
	private blockConfigs = new Map<HTMLElement, unknown>();

	async onload() {
		await this.loadSettings();

		this.sidecarStore = new SidecarStore(
			this.app,
			this.settings.playgroundFolder,
		);

		this.addSettingTab(new CodePlaygroundSettingTab(this.app, this));

		this.autoAddMissingIds();

		this.addCommand({
			id: "assign-missing-ids",
			name: "Assign missing block identifiers",
			editorCallback: (editor) =>
				scanForMissingIds(editor, {
					template: this.settings.template,
				}),
		});

		this.addCommand({
			id: "insert-block",
			name: "Insert block",
			editorCallback: (editor) => {
				const body = JSON.stringify(
					{ id: safeUUID(), template: this.settings.template },
					null,
					2,
				);
				editor.replaceSelection(
					"```" + CANONICAL_FENCE_NAME + "\n" + body + "\n```\n",
				);
			},
		});

		this.addCommand({
			id: "clean-up-sidecars",
			name: "Remove unused sidecar files",
			callback: () => void this.cleanUpSidecars(),
		});

		// Both the canonical `code-playground` fence and the legacy
		// `codePlayground` alias share one handler. The maps below are keyed by
		// element, so registering the same handler twice is safe — each block
		// gets a distinct `el`.
		for (const name of FENCE_NAMES) {
			this.registerMarkdownCodeBlockProcessor(name, (source, el, ctx) =>
				this.handleCodeBlock(source, el, ctx),
			);
		}
	}

	private handleCodeBlock(
		source: string,
		el: HTMLElement,
		ctx: MarkdownPostProcessorContext,
	) {
		const configForThisBlock = parseJsonSafe(source.trim());

		let root = this.roots.get(el);
		if (!root) {
			const newRoot = createRoot(el);
			root = newRoot;
			this.roots.set(el, newRoot);

			// Obsidian unloads the child when the element is discarded
			// (scroll, mode switch, note close) — tear down the Sandpack
			// iframe/listeners then, and drop the map entries so
			// rerenderAllBlocks never renders into detached nodes.
			const child = new MarkdownRenderChild(el);
			child.register(() => {
				this.roots.delete(el);
				this.blockConfigs.delete(el);
				newRoot.unmount();
			});
			ctx.addChild(child);
		}

		this.blockConfigs.set(el, configForThisBlock);
		this.renderBlock(root, configForThisBlock);
	}

	private renderBlock(root: Root, configForThisBlock: unknown) {
		if (isCodePlaygroundConfig(configForThisBlock)) {
			const mergedConfig = Object.assign(
				{},
				this.settings,
				configForThisBlock,
			);
			root.render(
				<CodePlaygroundApp
					config={mergedConfig}
					app={this.app}
					store={this.sidecarStore}
				/>,
			);
		} else {
			const configErrors = getConfigErrors(configForThisBlock);
			root.render(<ErrorConfigView errors={configErrors} />);
		}
	}

	/**
	 * Sidecars whose id appears in no Markdown file or Canvas text node.
	 * `fileNames` are the exact basenames shown to the user.
	 */
	private async findOrphanSidecars(): Promise<{
		ids: string[];
		fileNames: string[];
	}> {
		const usedIds = await collectUsedBlockIds(this.app.vault);
		const all = await this.sidecarStore.listSidecarFiles();
		const ids = findOrphanIds(all, usedIds);
		const idSet = new Set(ids);
		const fileNames = all.filter((name) => {
			const id = parseSidecarBasename(name);
			return id !== null && idSet.has(id);
		});
		return { ids, fileNames };
	}

	private async cleanUpSidecars(): Promise<void> {
		let orphans: { ids: string[]; fileNames: string[] };
		try {
			orphans = await this.findOrphanSidecars();
		} catch (err) {
			console.warn("[CodePlayground] Sidecar cleanup scan failed:", err);
			new Notice(
				"Code playground: could not scan for unused sidecar files. See the developer console for details.",
			);
			return;
		}

		if (orphans.ids.length === 0) {
			new Notice("No unused sidecar files found.");
			return;
		}

		new ConfirmModal(this.app, {
			title: "Remove unused sidecar files",
			message: `${orphans.fileNames.length} sidecar file(s) belong to no playground block in this vault. They will be deleted according to your "Deleted files" preference.`,
			items: orphans.fileNames,
			confirmText: "Delete",
			onConfirm: () => void this.deleteOrphanSidecars(orphans.ids),
		}).open();
	}

	private async deleteOrphanSidecars(confirmedIds: string[]): Promise<void> {
		try {
			// Re-scan: the vault may have changed while the confirmation was
			// open (e.g. the user undid a block deletion). Delete only ids
			// that are still orphaned AND were shown to the user.
			const rescan = await this.findOrphanSidecars();
			const confirmed = new Set(confirmedIds);
			const toDelete = rescan.ids.filter((id) => confirmed.has(id));
			const deleteSet = new Set(toDelete);
			const fileCount = rescan.fileNames.filter((name) => {
				const id = parseSidecarBasename(name);
				return id !== null && deleteSet.has(id);
			}).length;
			for (const id of toDelete) {
				await this.sidecarStore.delete(id);
			}
			new Notice(`Removed ${fileCount} unused sidecar file(s).`);
		} catch (err) {
			console.warn("[CodePlayground] Sidecar cleanup failed:", err);
			new Notice(
				"Code playground: removing unused sidecar files failed. See the developer console for details.",
			);
		}
	}

	private rerenderAllBlocks() {
		this.roots.forEach((root, el) => {
			this.renderBlock(root, this.blockConfigs.get(el));
		});
	}

	onunload() {
		this.roots.forEach((root) => root.unmount());
		this.roots.clear();
		this.blockConfigs.clear();
	}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			(await this.loadData()) as Partial<CodePlaygroundSettings>,
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
		this.rerenderAllBlocks();
	}

	autoAddMissingIds() {
		const debouncedScan = debounce(
			(editor: Editor) =>
				scanForMissingIds(
					editor,
					{ template: this.settings.template },
					{ emptyFencesOnly: true },
				),
			ID_SCAN_DEBOUNCE_MS,
			true,
		);

		this.registerEvent(
			this.app.workspace.on("editor-change", (editor) =>
				debouncedScan(editor),
			),
		);
	}
}
