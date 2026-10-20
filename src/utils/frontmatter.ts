import type { Exercise, Workout, WorkoutSet } from "../types";

export function workoutToFrontmatter(workout: Workout): string {
	const lines: string[] = ["---"];

	lines.push(`type: ${workout.type}`);
	if (workout.template) {
		lines.push(`template: ${workout.template}`);
	}
	lines.push(`date: "${workout.date}"`);
	lines.push(`start: "${workout.start}"`);
	if (workout.end) {
		lines.push(`end: "${workout.end}"`);
	}
	if (workout.duration !== null) {
		lines.push(`duration: ${workout.duration}`);
	}

	lines.push("exercises:");
	for (const exercise of workout.exercises) {
		lines.push(`  - name: ${exercise.name}`);
		if (exercise.exerciseType === "timer") {
			lines.push(`    exerciseType: timer`);
			lines.push(`    workSeconds: ${exercise.workSeconds ?? 0}`);
			lines.push(`    restSeconds: ${exercise.restSeconds ?? 0}`);
			lines.push(`    intervals: ${exercise.intervals ?? 0}`);
		} else {
			if (exercise.rir !== undefined) {
				lines.push(`    rir: ${exercise.rir}`);
			}
			lines.push("    sets:");
			for (const set of exercise.sets) {
				lines.push(`      - { weight: ${set.weight}, reps: ${set.reps}, unit: ${set.unit} }`);
			}
		}
	}

	lines.push("---");
	return lines.join("\n");
}

function formatTime(seconds: number): string {
	const m = Math.floor(seconds / 60);
	const s = seconds % 60;
	return `${m}:${String(s).padStart(2, "0")}`;
}

export function workoutToMarkdownBody(workout: Workout): string {
	const title = workout.template ?? "Workout";
	const dateParts = workout.date.split("-");
	const dateObj = new Date(
		parseInt(dateParts[0]!),
		parseInt(dateParts[1]!) - 1,
		parseInt(dateParts[2]!)
	);
	const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
	const formattedDate = `${monthNames[dateObj.getMonth()]} ${dateObj.getDate()}, ${dateObj.getFullYear()}`;

	const lines: string[] = [`# ${title} — ${formattedDate}`, ""];

	for (const exercise of workout.exercises) {
		lines.push(`## [[${exercise.name}]]`);
		if (exercise.exerciseType === "timer") {
			const w = formatTime(exercise.workSeconds ?? 0);
			const r = formatTime(exercise.restSeconds ?? 0);
			const n = exercise.intervals ?? 0;
			lines.push(`Intervals: ${n} \u00D7 ${w} work / ${r} rest`);
		} else {
			if (exercise.rir !== undefined) {
				lines.push(`RIR letzter Satz: ${exercise.rir}`, "");
			}
			lines.push("| Set | Weight | Reps |");
			lines.push("|-----|--------|------|");
			exercise.sets.forEach((set, i) => {
				const weightStr = `${set.weight} ${set.unit}`;
				lines.push(
					`| ${String(i + 1).padEnd(3)} | ${weightStr.padEnd(6)} | ${String(set.reps).padEnd(4)} |`
				);
			});
		}
		lines.push("");
	}

	return lines.join("\n").trimEnd();
}

/** Parse a session note's frontmatter (as delivered by the metadata cache). */
export function frontmatterToWorkout(fm: Record<string, unknown>): Workout | null {
	if (fm.type !== "workout") return null;

	const exercises: Exercise[] = [];
	if (Array.isArray(fm.exercises)) {
		for (const ex of fm.exercises as Array<Record<string, unknown>>) {
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
					for (const s of ex.sets as Array<Record<string, unknown>>) {
						sets.push({
							weight: Number(s.weight) || 0,
							reps: Number(s.reps) || 0,
							unit: s.unit === "lbs" ? "lbs" : "kg",
							completed: true,
						});
					}
				}
				const exercise: Exercise = {
					name: String(ex.name),
					sets,
				};
				const rir = parseRir(ex.rir);
				if (rir !== undefined) exercise.rir = rir;
				exercises.push(exercise);
			}
		}
	}

	return {
		type: "workout",
		template: (fm.template as string) ?? null,
		date: String(fm.date),
		start: scalarToString(fm.start),
		end: scalarToString(fm.end) || null,
		duration: fm.duration ? Number(fm.duration) : null,
		exercises,
	};
}

function scalarToString(v: unknown): string {
	if (typeof v === "string") return v;
	if (typeof v === "number") return String(v);
	return "";
}

/** RIR from frontmatter or user input; undefined when empty or invalid. */
export function parseRir(raw: unknown): number | undefined {
	if (raw === null || raw === undefined || raw === "") return undefined;
	const n = Number(raw);
	return Number.isFinite(n) && n >= 0 ? n : undefined;
}

export function workoutToFullMarkdown(workout: Workout): string {
	return workoutToFrontmatter(workout) + "\n" + workoutToMarkdownBody(workout) + "\n";
}
