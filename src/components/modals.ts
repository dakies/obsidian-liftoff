import { App, Modal } from "obsidian";
import type { ExerciseLibraryEntry } from "../types";
import type { LastExerciseData } from "../utils/history";
import { resolveExerciseNote, type ResolvedExerciseNote } from "../utils/exercise-note";

export class ConfirmModal extends Modal {
	private message: string;
	private resolve: (value: boolean) => void = () => {};

	constructor(app: App, message: string) {
		super(app);
		this.message = message;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.createEl("p", { text: this.message, cls: "ln-modal-message" });

		const btnContainer = contentEl.createDiv({ cls: "ln-modal-buttons" });

		const cancelBtn = btnContainer.createEl("button", { text: "Cancel" });
		cancelBtn.addEventListener("click", () => {
			this.resolve(false);
			this.close();
		});

		const confirmBtn = btnContainer.createEl("button", {
			text: "Confirm",
			cls: "mod-cta",
		});
		confirmBtn.addEventListener("click", () => {
			this.resolve(true);
			this.close();
		});
	}

	onClose(): void {
		this.resolve(false);
		this.contentEl.empty();
	}

	openAndWait(): Promise<boolean> {
		return new Promise((resolve) => {
			this.resolve = resolve;
			this.open();
		});
	}
}

export class TextInputModal extends Modal {
	private title: string;
	private placeholder: string;
	private resolve: (value: string | null) => void = () => {};

	constructor(app: App, title: string, placeholder: string = "") {
		super(app);
		this.title = title;
		this.placeholder = placeholder;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.createEl("p", { text: this.title, cls: "ln-modal-message" });

		const input = contentEl.createEl("input", {
			type: "text",
			cls: "ln-modal-input",
			placeholder: this.placeholder,
		});

		const btnContainer = contentEl.createDiv({ cls: "ln-modal-buttons" });

		const cancelBtn = btnContainer.createEl("button", { text: "Cancel" });
		cancelBtn.addEventListener("click", () => {
			this.resolve(null);
			this.close();
		});

		const confirmBtn = btnContainer.createEl("button", {
			text: "Create",
			cls: "mod-cta",
		});

		const submit = () => {
			const value = input.value.trim();
			if (value) {
				this.resolve(value);
				this.close();
			}
		};

		confirmBtn.addEventListener("click", submit);
		input.addEventListener("keydown", (e) => {
			if (e.key === "Enter") submit();
		});

		// Focus input after modal animation
		window.setTimeout(() => input.focus(), 50);
	}

	onClose(): void {
		this.resolve(null);
		this.contentEl.empty();
	}

	openAndWait(): Promise<string | null> {
		return new Promise((resolve) => {
			this.resolve = resolve;
			this.open();
		});
	}
}

export class ExerciseDetailsModal extends Modal {
	constructor(
		app: App,
		private exerciseName: string,
		private libraryEntry: ExerciseLibraryEntry | undefined,
		private history: LastExerciseData[],
		private exerciseFolder: string
	) {
		super(app);
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("ln-exercise-details");

		const header = contentEl.createDiv({ cls: "ln-ed-header" });
		header.createEl("h3", { text: this.exerciseName, cls: "ln-ed-title" });
		if (this.libraryEntry?.exerciseType === "timer") {
			header.createSpan({ cls: "ln-ed-type-badge", text: "⏱ Timer" });
		}

		// Resolve linked note up front; its frontmatter overrides library values.
		const resolved = resolveExerciseNote(
			this.app,
			this.exerciseName,
			this.libraryEntry,
			this.exerciseFolder
		);
		const fm = resolved
			? this.app.metadataCache.getFileCache(resolved.file)?.frontmatter ?? null
			: null;

		// Quick stats (reps + pause)
		const reps = this.firstString(fm?.reps) ?? this.libraryEntry?.recommendedReps;
		const pauseDisplay = this.formatPause(fm?.pause)
			?? (this.libraryEntry?.pause != null ? this.formatTime(this.libraryEntry.pause) : null);
		if (reps || pauseDisplay) {
			const stats = contentEl.createDiv({ cls: "ln-ed-stats" });
			if (reps) {
				const cell = stats.createDiv({ cls: "ln-ed-stat" });
				cell.createDiv({ cls: "ln-ed-stat-label", text: "Reps" });
				cell.createDiv({ cls: "ln-ed-stat-value", text: reps });
			}
			if (pauseDisplay) {
				const cell = stats.createDiv({ cls: "ln-ed-stat" });
				cell.createDiv({ cls: "ln-ed-stat-label", text: "Pause" });
				cell.createDiv({ cls: "ln-ed-stat-value", text: pauseDisplay });
			}
		}

		// Notes
		const notes = this.firstString(fm?.notes) ?? this.libraryEntry?.notes;
		if (notes) {
			const section = contentEl.createDiv({ cls: "ln-ed-section" });
			section.createDiv({ cls: "ln-ed-section-label", text: "Notes" });
			section.createDiv({ cls: "ln-ed-notes", text: notes });
		}

		// Linked note
		this.renderLinkedNoteSection(contentEl, resolved);

		// History
		const historySection = contentEl.createDiv({ cls: "ln-ed-section" });
		historySection.createDiv({ cls: "ln-ed-section-label", text: "History" });
		if (this.history.length === 0) {
			historySection.createDiv({
				cls: "ln-ed-empty",
				text: "No previous sessions.",
			});
		} else {
			for (const session of this.history) {
				const row = historySection.createDiv({ cls: "ln-ed-history-row" });
				row.createSpan({ cls: "ln-ed-history-date", text: session.date });
				row.createSpan({
					cls: "ln-ed-history-summary",
					text: this.summarize(session),
				});
			}
		}
	}

	private renderLinkedNoteSection(
		contentEl: HTMLElement,
		resolved: ResolvedExerciseNote | null
	): void {
		const section = contentEl.createDiv({ cls: "ln-ed-section" });
		section.createDiv({ cls: "ln-ed-section-label", text: "Linked note" });

		if (!resolved) {
			section.createDiv({
				cls: "ln-ed-empty",
				text: `No note found for "${this.exerciseName}". Create one in the exercise folder or set a linked-note path in the library.`,
			});
			return;
		}

		const { file, linkText } = resolved;
		const btn = section.createEl("button", {
			cls: "ln-ed-open-note-btn",
			text: `Open "${file.basename}"`,
		});
		btn.addEventListener("click", () => {
			this.close();
			void this.app.workspace.openLinkText(linkText, "", true);
		});
	}

	private summarize(session: LastExerciseData): string {
		if (session.workSeconds !== undefined && session.intervals !== undefined) {
			const w = this.formatTime(session.workSeconds);
			const r = this.formatTime(session.restSeconds ?? 0);
			return `${w} / ${r} × ${session.intervals}`;
		}
		const completed = session.sets.filter((s) => s.completed);
		if (completed.length === 0) return "(no completed sets)";
		const unit = completed[0]!.unit;
		const topWeight = Math.max(...completed.map((s) => s.weight));
		const reps = completed.map((s) => s.reps).join("/");
		return `${completed.length} × ${topWeight}${unit} · ${reps}`;
	}

	private formatTime(seconds: number): string {
		const m = Math.floor(seconds / 60);
		const s = seconds % 60;
		return `${m}:${String(s).padStart(2, "0")}`;
	}

	private firstString(v: unknown): string | undefined {
		if (v == null) return undefined;
		const s = String(v).trim();
		return s ? s : undefined;
	}

	private formatPause(v: unknown): string | null {
		if (v == null) return null;
		if (typeof v === "number") {
			return Number.isFinite(v) ? this.formatTime(v) : null;
		}
		const s = String(v).trim();
		return s || null;
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
