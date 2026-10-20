import { App, TFile } from "obsidian";
import type { ExerciseLibraryEntry } from "../types";

export interface ResolvedExerciseNote {
	file: TFile;
	linkText: string;
}

/**
 * Find the note for an exercise: explicit library path, then
 * `<exerciseFolder>/<name>.md`, then wikilink resolution of `[[<name>]]`.
 */
export function resolveExerciseNote(
	app: App,
	exerciseName: string,
	libraryEntry: ExerciseLibraryEntry | undefined,
	exerciseFolder: string
): ResolvedExerciseNote | null {
	// 1. Explicit per-entry path
	const explicit = libraryEntry?.notePath?.trim();
	if (explicit) {
		const direct = app.vault.getAbstractFileByPath(explicit);
		if (direct instanceof TFile) return { file: direct, linkText: explicit };
		// Allow extensionless input like "Exercises/Bench Press"
		const withExt = app.vault.getAbstractFileByPath(`${explicit}.md`);
		if (withExt instanceof TFile) return { file: withExt, linkText: `${explicit}.md` };
	}

	// 2. `<exerciseFolder>/<name>.md`
	const folder = exerciseFolder.trim().replace(/\/+$/, "");
	if (folder) {
		const path = `${folder}/${exerciseName}.md`;
		const inFolder = app.vault.getAbstractFileByPath(path);
		if (inFolder instanceof TFile) return { file: inFolder, linkText: path };
	}

	// 3. Obsidian wikilink resolution (matches how `[[<name>]]` is resolved)
	const byLink = app.metadataCache.getFirstLinkpathDest(exerciseName, "");
	if (byLink instanceof TFile) return { file: byLink, linkText: exerciseName };

	return null;
}
