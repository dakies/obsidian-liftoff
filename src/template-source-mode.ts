import { MarkdownView, type WorkspaceLeaf } from "obsidian";
import type LiftOffPlugin from "./main";
import { isPathInFolder } from "./utils/folder";

interface EditorMode {
	mode: unknown;
	source: unknown;
}

/**
 * Opens workout templates in Source mode, since their nested `exercises` list is
 * hard to edit in the properties widget. Leaves switched here get their previous
 * mode back once they show a note outside the template folder.
 */
export class TemplateSourceMode {
	private forced = new WeakMap<WorkspaceLeaf, EditorMode>();
	private switching = new WeakSet<WorkspaceLeaf>();

	constructor(private plugin: LiftOffPlugin) {}

	register(): void {
		const { workspace } = this.plugin.app;
		this.plugin.registerEvent(
			workspace.on("file-open", () => {
				const view = workspace.getActiveViewOfType(MarkdownView);
				if (view) void this.apply(view);
			})
		);
		this.plugin.registerEvent(
			workspace.on("active-leaf-change", (leaf) => {
				if (leaf?.view instanceof MarkdownView) void this.apply(leaf.view);
			})
		);
	}

	private async apply(view: MarkdownView): Promise<void> {
		const leaf = view.leaf;
		// setState re-triggers workspace events; ignore them while we switch.
		if (this.switching.has(leaf)) return;

		const state = view.getState();
		const inSource = state.mode === "source" && state.source === true;
		const { settings } = this.plugin;
		const file = view.file;
		const isTemplate =
			settings.templatesInSourceMode &&
			file?.extension === "md" &&
			isPathInFolder(file.path, settings.templateFolder);

		if (isTemplate) {
			if (inSource) return;
			if (!this.forced.has(leaf)) {
				this.forced.set(leaf, { mode: state.mode, source: state.source });
			}
			await this.setMode(view, state, { mode: "source", source: true });
			return;
		}

		const previous = this.forced.get(leaf);
		if (!previous) return;
		this.forced.delete(leaf);
		// Only undo our own switch; the user may have changed the mode since.
		if (inSource) await this.setMode(view, state, previous);
	}

	private async setMode(
		view: MarkdownView,
		state: Record<string, unknown>,
		mode: EditorMode
	): Promise<void> {
		this.switching.add(view.leaf);
		try {
			await view.setState({ ...state, ...mode }, { history: false });
		} finally {
			this.switching.delete(view.leaf);
		}
	}
}
