import { App, TFile, TFolder, normalizePath } from "obsidian";
import type { Workout, Exercise, WorkoutSet, LiftOffSettings } from "../types";
import { workoutToFullMarkdown } from "../utils/frontmatter";
import { generateWorkoutFilename } from "../utils/filename";

export interface RecentWorkout {
	filename: string;
	path: string;
	template: string | null;
	date: string;
	duration: number | null;
	exerciseCount: number;
}

export class WorkoutStore {
	constructor(
		private app: App,
		private getSettings: () => LiftOffSettings
	) {}

	async saveWorkout(workout: Workout): Promise<TFile> {
		const settings = this.getSettings();
		const folderPath = normalizePath(settings.workoutFolder);

		await this.ensureFolder(folderPath);

		const existingFiles = await this.getFilenamesInFolder(folderPath);
		const filename = generateWorkoutFilename(workout.date, workout.template, existingFiles);
		const filePath = normalizePath(`${folderPath}/${filename}`);

		const content = workoutToFullMarkdown(workout);
		return await this.app.vault.create(filePath, content);
	}

	async getRecentWorkouts(limit: number = 10): Promise<RecentWorkout[]> {
		const settings = this.getSettings();
		const folderPath = normalizePath(settings.workoutFolder);
		const folder = this.app.vault.getAbstractFileByPath(folderPath);

		if (!(folder instanceof TFolder)) {
			return [];
		}

		const workouts: RecentWorkout[] = [];

		for (const file of folder.children) {
			if (!(file instanceof TFile) || file.extension !== "md") continue;

			const cache = this.app.metadataCache.getFileCache(file);
			const fm = cache?.frontmatter;
			if (!fm || fm.type !== "workout") continue;

			workouts.push({
				filename: file.basename,
				path: file.path,
				template: fm.template ?? null,
				date: fm.date ?? file.basename.substring(0, 10),
				duration: fm.duration ?? null,
				exerciseCount: Array.isArray(fm.exercises) ? fm.exercises.length : 0,
			});
		}

		workouts.sort((a, b) => b.date.localeCompare(a.date));
		return workouts.slice(0, limit);
	}

	async parseWorkoutFile(path: string): Promise<Workout | null> {
		const file = this.app.vault.getAbstractFileByPath(path);
		if (!(file instanceof TFile)) return null;

		const cache = this.app.metadataCache.getFileCache(file);
		const fm = cache?.frontmatter;
		if (!fm || fm.type !== "workout") return null;

		const exercises: Exercise[] = [];
		if (Array.isArray(fm.exercises)) {
			for (const ex of fm.exercises) {
				const isTimer = ex.exerciseType === "timer";
				if (isTimer) {
					exercises.push({
						name: String(ex.name),
						exerciseType: "timer",
						sets: [],
						workSeconds: Number(ex.workSeconds) || 0,
						restSeconds: Number(ex.restSeconds) || 0,
						intervals: Number(ex.intervals) || 0,
					});
				} else {
					const sets: WorkoutSet[] = [];
					if (Array.isArray(ex.sets)) {
						for (const s of ex.sets) {
							sets.push({
								weight: Number(s.weight) || 0,
								reps: Number(s.reps) || 0,
								unit: s.unit === "lbs" ? "lbs" : "kg",
								completed: true,
							});
						}
					}
					exercises.push({
						name: String(ex.name),
						sets,
					});
				}
			}
		}

		return {
			type: "workout",
			template: fm.template ?? null,
			date: String(fm.date),
			start: String(fm.start ?? ""),
			end: fm.end ? String(fm.end) : null,
			duration: fm.duration ? Number(fm.duration) : null,
			exercises,
		};
	}

	private async ensureFolder(path: string): Promise<void> {
		const folder = this.app.vault.getAbstractFileByPath(path);
		if (!folder) {
			await this.app.vault.createFolder(path);
		}
	}

	private async getFilenamesInFolder(folderPath: string): Promise<string[]> {
		const folder = this.app.vault.getAbstractFileByPath(folderPath);
		if (!(folder instanceof TFolder)) return [];
		return folder.children
			.filter((f): f is TFile => f instanceof TFile)
			.map((f) => f.name);
	}
}
