import { describe, it, expect } from "vitest";
import {
	frontmatterToWorkout,
	parseRir,
	workoutToFrontmatter,
	workoutToMarkdownBody,
} from "../../src/utils/frontmatter";
import type { Workout } from "../../src/types";

const sampleWorkout: Workout = {
	type: "workout",
	template: "Push Day",
	date: "2026-03-21",
	start: "14:30",
	end: "15:45",
	duration: 75,
	exercises: [
		{
			name: "Bench Press",
			sets: [
				{ weight: 80, reps: 10, unit: "kg", completed: true },
				{ weight: 90, reps: 8, unit: "kg", completed: true },
			],
		},
	],
};

describe("workoutToFrontmatter", () => {
	it("serializes workout to YAML frontmatter string", () => {
		const result = workoutToFrontmatter(sampleWorkout);
		expect(result).toContain("type: workout");
		expect(result).toContain("template: Push Day");
		expect(result).toContain('date: "2026-03-21"');
		expect(result).toContain("name: Bench Press");
		expect(result).toContain("weight: 80");
		expect(result).toContain("reps: 10");
		expect(result).toContain("unit: kg");
		expect(result.startsWith("---\n")).toBe(true);
		expect(result.endsWith("\n---")).toBe(true);
	});
});

describe("workoutToMarkdownBody", () => {
	it("generates readable markdown tables", () => {
		const result = workoutToMarkdownBody(sampleWorkout);
		expect(result).toContain("# Push Day");
		expect(result).toContain("## [[Bench Press]]");
		expect(result).toContain("| 1   | 80 kg  | 10   |");
		expect(result).toContain("| 2   | 90 kg  | 8    |");
		expect(result).toContain("| Set | Weight | Reps |");
	});

	it("uses Workout as title for freeform workouts", () => {
		const freeform = { ...sampleWorkout, template: null };
		const result = workoutToMarkdownBody(freeform);
		expect(result).toContain("# Workout");
	});
});

const timerWorkout: Workout = {
	type: "workout",
	template: "HIIT",
	date: "2026-03-21",
	start: "07:00",
	end: "07:30",
	duration: 30,
	exercises: [
		{
			name: "Burpees",
			exerciseType: "timer",
			sets: [],
			workSeconds: 40,
			restSeconds: 20,
			intervals: 5,
		},
	],
};

describe("timer exercise frontmatter", () => {
	it("serializes timer exercise with exercise-level params", () => {
		const result = workoutToFrontmatter(timerWorkout);
		expect(result).toContain("exerciseType: timer");
		expect(result).toContain("workSeconds: 40");
		expect(result).toContain("restSeconds: 20");
		expect(result).toContain("intervals: 5");
		expect(result).not.toContain("weight:");
		expect(result).not.toContain("sets:");
	});
});

describe("timer exercise markdown body", () => {
	it("renders interval summary for timer exercises", () => {
		const result = workoutToMarkdownBody(timerWorkout);
		expect(result).toContain("## [[Burpees]]");
		expect(result).toContain("5");
		expect(result).toContain("0:40");
		expect(result).toContain("0:20");
		expect(result).not.toContain("Weight");
	});
});

describe("RIR", () => {
	const withRir: Workout = {
		...sampleWorkout,
		exercises: [{ ...sampleWorkout.exercises[0]!, rir: 2 }],
	};

	it("writes rir only when set", () => {
		expect(workoutToFrontmatter(withRir)).toContain("  - name: Bench Press\n    rir: 2\n    sets:");
		expect(workoutToFrontmatter(sampleWorkout)).not.toContain("rir:");
		expect(workoutToMarkdownBody(withRir)).toContain("## [[Bench Press]]\nRIR letzter Satz: 2\n\n| Set |");
		expect(workoutToMarkdownBody(sampleWorkout)).not.toContain("RIR");
	});

	it("round-trips through frontmatter parsing", () => {
		// Shape the metadata cache delivers for the serialized frontmatter above.
		const fm = {
			type: "workout",
			template: "Push Day",
			date: "2026-03-21",
			start: "14:30",
			end: "15:45",
			duration: 75,
			exercises: [
				{
					name: "Bench Press",
					rir: 2,
					sets: [
						{ weight: 80, reps: 10, unit: "kg" },
						{ weight: 90, reps: 8, unit: "kg" },
					],
				},
			],
		};
		const parsed = frontmatterToWorkout(fm);
		expect(parsed).toEqual(withRir);
		expect(workoutToFrontmatter(parsed!)).toBe(workoutToFrontmatter(withRir));
	});

	it("parses sessions without rir", () => {
		const parsed = frontmatterToWorkout({
			type: "workout",
			date: "2026-03-21",
			exercises: [{ name: "Bench Press", sets: [{ weight: 80, reps: 10, unit: "kg" }] }],
		});
		expect(parsed?.exercises[0]?.rir).toBeUndefined();
		expect(parsed?.exercises[0]).not.toHaveProperty("rir");
	});

	it("rejects invalid rir values", () => {
		expect(parseRir("")).toBeUndefined();
		expect(parseRir(null)).toBeUndefined();
		expect(parseRir("-1")).toBeUndefined();
		expect(parseRir("abc")).toBeUndefined();
		expect(parseRir("0")).toBe(0);
		expect(parseRir(3)).toBe(3);
	});

	it("ignores non-workout frontmatter", () => {
		expect(frontmatterToWorkout({ type: "workout-template" })).toBeNull();
	});
});
