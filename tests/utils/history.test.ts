import { describe, it, expect } from "vitest";
import { findLastSetsForExercise, findPastSessionsForExercise } from "../../src/utils/history";
import type { Workout } from "../../src/types";

const workouts: Workout[] = [
	{
		type: "workout",
		template: "Push Day",
		date: "2026-03-19",
		start: "14:00",
		end: "15:00",
		duration: 60,
		exercises: [
			{
				name: "Bench Press",
				sets: [
					{ weight: 80, reps: 10, unit: "kg", completed: true },
					{ weight: 90, reps: 8, unit: "kg", completed: true },
				],
			},
			{
				name: "Incline DB Press",
				sets: [
					{ weight: 30, reps: 12, unit: "kg", completed: true },
				],
			},
		],
	},
	{
		type: "workout",
		template: "Push Day",
		date: "2026-03-15",
		start: "14:00",
		end: "15:00",
		duration: 60,
		exercises: [
			{
				name: "Bench Press",
				sets: [
					{ weight: 75, reps: 10, unit: "kg", completed: true },
				],
			},
		],
	},
];

describe("findLastSetsForExercise", () => {
	it("returns sets from the most recent workout containing the exercise", () => {
		const result = findLastSetsForExercise(workouts, "Bench Press");
		expect(result).not.toBeNull();
		expect(result!.sets).toHaveLength(2);
		expect(result!.sets[0]!.weight).toBe(80);
		expect(result!.date).toBe("2026-03-19");
	});

	it("returns null for unknown exercise", () => {
		const result = findLastSetsForExercise(workouts, "Squat");
		expect(result).toBeNull();
	});

	it("matches exercise name case-insensitively", () => {
		const result = findLastSetsForExercise(workouts, "bench press");
		expect(result).not.toBeNull();
		expect(result!.sets[0]!.weight).toBe(80);
	});
});

describe("findPastSessionsForExercise", () => {
	it("returns all past sessions newest-first", () => {
		const result = findPastSessionsForExercise(workouts, "Bench Press");
		expect(result).toHaveLength(2);
		expect(result[0]!.date).toBe("2026-03-19");
		expect(result[1]!.date).toBe("2026-03-15");
	});

	it("respects the limit parameter", () => {
		const result = findPastSessionsForExercise(workouts, "Bench Press", 1);
		expect(result).toHaveLength(1);
		expect(result[0]!.date).toBe("2026-03-19");
	});

	it("returns an empty array for unknown exercise", () => {
		const result = findPastSessionsForExercise(workouts, "Squat");
		expect(result).toEqual([]);
	});

	it("matches case-insensitively", () => {
		const result = findPastSessionsForExercise(workouts, "bench press");
		expect(result).toHaveLength(2);
	});
});
