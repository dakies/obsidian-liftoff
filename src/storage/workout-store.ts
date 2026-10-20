import { App, TFile, TFolder, normalizePath } from "obsidian";
import type { Workout, LiftOffSettings } from "../types";
import { frontmatterToWorkout, workoutToFullMarkdown } from "../utils/frontmatter";
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

		const existingFiles = this.getFilenamesInFolder(folderPath);
		const filename = generateWorkoutFilename(workout.date, workout.template, existingFiles);
		const filePath = normalizePath(`${folderPath}/${filename}`);

		const content = workoutToFullMarkdown(workout);
		return await this.app.vault.create(filePath, content);
	}

	getRecentWorkouts(limit: number = 10): RecentWorkout[] {
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
				template: (fm.template as string) ?? null,
				date: (fm.date as string) ?? file.basename.substring(0, 10),
				duration: (fm.duration as number) ?? null,
				exerciseCount: Array.isArray(fm.exercises) ? (fm.exercises as unknown[]).length : 0,
			});
		}

		workouts.sort((a, b) => b.date.localeCompare(a.date));
		return workouts.slice(0, limit);
	}

	parseWorkoutFile(path: string): Workout | null {
		const file = this.app.vault.getAbstractFileByPath(path);
		if (!(file instanceof TFile)) return null;

		const fm = this.app.metadataCache.getFileCache(file)?.frontmatter;
		if (!fm) return null;
		return frontmatterToWorkout(fm);
	}

	private async ensureFolder(path: string): Promise<void> {
		const folder = this.app.vault.getAbstractFileByPath(path);
		if (!folder) {
			await this.app.vault.createFolder(path);
		}
	}

	private getFilenamesInFolder(folderPath: string): string[] {
		const folder = this.app.vault.getAbstractFileByPath(folderPath);
		if (!(folder instanceof TFolder)) return [];
		return folder.children
			.filter((f): f is TFile => f instanceof TFile)
			.map((f) => f.name);
	}
}
