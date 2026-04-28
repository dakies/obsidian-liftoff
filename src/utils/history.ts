import type { Workout, WorkoutSet } from "../types";

export interface LastExerciseData {
	date: string;
	sets: WorkoutSet[];
	// Timer exercise data
	workSeconds?: number;
	restSeconds?: number;
	intervals?: number;
}

/**
 * Find the most recent data for a given exercise from a list of workouts.
 * Workouts should be sorted newest-first.
 */
export function findLastSetsForExercise(
	workouts: Workout[],
	exerciseName: string
): LastExerciseData | null {
	const nameLower = exerciseName.toLowerCase();

	for (const workout of workouts) {
		const exercise = workout.exercises.find(
			(e) => e.name.toLowerCase() === nameLower
		);
		if (exercise) {
			return {
				date: workout.date,
				sets: exercise.sets,
				workSeconds: exercise.workSeconds,
				restSeconds: exercise.restSeconds,
				intervals: exercise.intervals,
			};
		}
	}

	return null;
}

/**
 * Find up to `limit` past sessions that contain the given exercise, newest-first.
 * Workouts should already be sorted newest-first.
 */
export function findPastSessionsForExercise(
	workouts: Workout[],
	exerciseName: string,
	limit = 5
): LastExerciseData[] {
	const nameLower = exerciseName.toLowerCase();
	const results: LastExerciseData[] = [];

	for (const workout of workouts) {
		const exercise = workout.exercises.find(
			(e) => e.name.toLowerCase() === nameLower
		);
		if (!exercise) continue;
		results.push({
			date: workout.date,
			sets: exercise.sets,
			workSeconds: exercise.workSeconds,
			restSeconds: exercise.restSeconds,
			intervals: exercise.intervals,
		});
		if (results.length >= limit) break;
	}

	return results;
}
