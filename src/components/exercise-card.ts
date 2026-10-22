import type { Exercise, WorkoutSet, WorkoutsSettings } from "../types";
import type { LastExerciseData } from "../utils/history";
import type { NextTarget } from "../utils/progression";
import { parseRir } from "../utils/frontmatter";
import { SetRow } from "./set-row";
import { TimerBlock } from "./timer-block";

export interface ExerciseCardCallbacks {
	onExerciseChanged: (exercise: Exercise) => void;
	onSetCompleted?: (set: WorkoutSet) => void;
	onShowDetails?: () => void;
}

interface SetRowLike {
	getSet(): WorkoutSet;
	destroy(): void;
}

export class ExerciseCard {
	private containerEl: HTMLElement;
	private setsContainerEl: HTMLElement;
	private setRows: SetRowLike[] = [];
	private timerBlock: TimerBlock | null = null;
	private expanded: boolean;

	constructor(
		parentEl: HTMLElement,
		private exercise: Exercise,
		private lastData: LastExerciseData | null,
		private target: NextTarget | null,
		private settings: WorkoutsSettings,
		private callbacks: ExerciseCardCallbacks
	) {
		this.expanded = true;
		this.containerEl = parentEl.createDiv({ cls: "ln-exercise-card" });
		this.setsContainerEl = null!;
		this.render();
	}

	private get isTimer(): boolean {
		return this.exercise.exerciseType === "timer";
	}

	private render(): void {
		this.containerEl.empty();
		this.setRows = [];
		this.timerBlock = null;

		// Header
		const header = this.containerEl.createDiv({ cls: "ln-exercise-header" });
		header.createSpan({
			cls: "ln-exercise-name",
			text: this.exercise.name,
		});

		const headerRight = header.createDiv({ cls: "ln-exercise-header-right" });
		if (this.lastData) {
			headerRight.createSpan({
				cls: "ln-exercise-last-date",
				text: `Last: ${this.lastData.date}`,
			});
		}

		if (this.isTimer) {
			headerRight.createSpan({
				cls: "ln-exercise-set-count",
				text: `\u23F1 ${this.exercise.intervals ?? this.settings.defaultWorkDuration}`,
			});
		} else {
			const completedCount = this.exercise.sets.filter((s) => s.completed).length;
			headerRight.createSpan({
				cls: "ln-exercise-set-count",
				text: `${completedCount}/${this.exercise.sets.length}`,
			});
		}

		if (this.callbacks.onShowDetails) {
			const infoBtn = headerRight.createEl("button", {
				cls: "ln-exercise-info-btn",
				text: "ⓘ",
				attr: { "aria-label": "Exercise details" },
			});
			infoBtn.addEventListener("click", (e) => {
				e.stopPropagation();
				this.callbacks.onShowDetails?.();
			});
		}

		// Exercise notes
		const libraryEntry = this.settings.exerciseLibrary.find(
			(e) => e.name.toLowerCase() === this.exercise.name.toLowerCase()
		);
		if (libraryEntry?.notes) {
			this.containerEl.createDiv({
				cls: "ln-exercise-notes",
				text: libraryEntry.notes,
			});
		}

		// Toggle expand/collapse on header tap
		header.addEventListener("click", () => {
			this.expanded = !this.expanded;
			this.render();
		});

		if (!this.expanded) {
			this.containerEl.addClass("ln-exercise-collapsed");
			return;
		}

		if (this.isTimer) {
			this.renderTimer();
		} else {
			this.renderWeightSets();
		}
	}

	private renderTimer(): void {
		// Previous hint
		if (this.lastData && this.lastData.workSeconds !== undefined) {
			const w = this.formatTime(this.lastData.workSeconds);
			const r = this.formatTime(this.lastData.restSeconds ?? 0);
			const n = this.lastData.intervals ?? 0;
			this.containerEl.createDiv({
				cls: "ln-exercise-previous",
				text: `Previous: ${w} / ${r} \u00D7 ${n}`,
			});
		}

		const workSec = this.exercise.workSeconds ?? this.settings.defaultWorkDuration;
		const restSec = this.exercise.restSeconds ?? this.settings.defaultRestIntervalDuration;
		const intervals = this.exercise.intervals ?? 5;

		this.timerBlock = new TimerBlock(
			this.containerEl,
			workSec,
			restSec,
			intervals,
			{
				onCompleted: () => {
					this.callbacks.onSetCompleted?.({
						weight: 0, reps: 0, unit: this.settings.weightUnit, completed: true,
					});
				},
				onChanged: (w, r, n) => {
					this.exercise.workSeconds = w;
					this.exercise.restSeconds = r;
					this.exercise.intervals = n;
					this.callbacks.onExerciseChanged(this.exercise);
				},
			}
		);
	}

	private renderWeightSets(): void {
		// Double-progression target for today
		if (this.target) {
			const targetEl = this.containerEl.createDiv({
				cls: `ln-exercise-target ln-exercise-target-${this.target.kind}`,
			});
			targetEl.createSpan({ cls: "ln-exercise-target-label", text: "Ziel: " });
			targetEl.createSpan({ text: this.target.text });
		}

		// Column headers
		const colHeaders = this.containerEl.createDiv({ cls: "ln-set-row ln-set-header" });
		colHeaders.createSpan({ cls: "ln-set-number", text: "SET" });
		colHeaders.createSpan({ cls: "ln-set-input", text: this.settings.weightUnit.toUpperCase() });
		colHeaders.createSpan({ cls: "ln-set-input", text: "REPS" });
		colHeaders.createSpan({ cls: "ln-set-check", text: "" });

		// Sets container (rows are pre-filled from the last session, so no separate "Previous" hint)
		this.setsContainerEl = this.containerEl.createDiv({ cls: "ln-sets-container" });
		this.renderSets();

		// Add Set button
		const addSetBtn = this.containerEl.createDiv({
			cls: "ln-add-set-btn",
			text: "+ Add Set",
		});
		addSetBtn.addEventListener("click", () => {
			const lastSet = this.exercise.sets[this.exercise.sets.length - 1];
			const newSet: WorkoutSet = {
				weight: lastSet?.weight ?? 0,
				reps: 0,
				unit: this.settings.weightUnit,
				completed: false,
			};
			this.exercise.sets.push(newSet);
			this.render();
			this.callbacks.onExerciseChanged(this.exercise);
		});

		this.renderRirInput();
	}

	private renderRirInput(): void {
		const rirRow = this.containerEl.createDiv({ cls: "ln-rir-row" });
		// eslint-disable-next-line obsidianmd/ui/sentence-case -- German nouns and the RIR acronym are capitalized
		const label = rirRow.createEl("label", { cls: "ln-rir-label", text: "RIR letzter Satz" });
		const input = label.createEl("input", {
			cls: "ln-set-input ln-rir-input",
			attr: {
				type: "number",
				inputmode: "numeric",
				min: "0",
				max: "10",
				placeholder: "–",
			},
		});
		if (this.exercise.rir !== undefined) {
			input.value = String(this.exercise.rir);
		}
		input.addEventListener("input", () => {
			this.exercise.rir = parseRir(input.value.trim());
			this.callbacks.onExerciseChanged(this.exercise);
		});
	}

	private renderSets(): void {
		this.setsContainerEl.empty();
		this.setRows = [];

		for (let i = 0; i < this.exercise.sets.length; i++) {
			const set = this.exercise.sets[i]!;
			const previousSet = this.lastData?.sets[i];
			const hint = previousSet
				? `${previousSet.weight} x ${previousSet.reps}`
				: null;

			const row = new SetRow(
				this.setsContainerEl,
				i + 1,
				set,
				hint,
				{
					onSetChanged: (updatedSet) => {
						this.exercise.sets[i] = updatedSet;
						this.callbacks.onExerciseChanged(this.exercise);
					},
					onSetCompleted: (updatedSet) => {
						this.exercise.sets[i] = updatedSet;
						this.callbacks.onExerciseChanged(this.exercise);
						if (updatedSet.completed) {
							this.callbacks.onSetCompleted?.(updatedSet);
						}
					},
				}
			);
			this.setRows.push(row);
		}
	}

	private formatTime(seconds: number): string {
		const m = Math.floor(seconds / 60);
		const s = seconds % 60;
		return `${m}:${String(s).padStart(2, "0")}`;
	}

	expand(): void {
		this.expanded = true;
		this.render();
	}

	collapse(): void {
		this.expanded = false;
		this.render();
	}

	getExercise(): Exercise {
		if (this.isTimer && this.timerBlock) {
			const state = this.timerBlock.getState();
			return {
				name: this.exercise.name,
				exerciseType: "timer",
				workSeconds: state.workSeconds,
				restSeconds: state.restSeconds,
				intervals: state.intervals,
				sets: state.completed
					? Array.from({ length: state.intervals }, () => ({
						weight: 0, reps: 0, unit: this.settings.weightUnit, completed: true,
					}))
					: [],
			};
		}
		const exercise: Exercise = {
			name: this.exercise.name,
			exerciseType: this.exercise.exerciseType,
			// Collapsed cards have no set rows; this.exercise.sets is kept in sync by the row callbacks.
			sets: this.setRows.length > 0
				? this.setRows.map((r) => r.getSet())
				: this.exercise.sets.map((set) => ({ ...set })),
		};
		if (this.exercise.rir !== undefined) exercise.rir = this.exercise.rir;
		return exercise;
	}

	destroy(): void {
		this.timerBlock?.destroy();
		this.containerEl.remove();
	}
}
