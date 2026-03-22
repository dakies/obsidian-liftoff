import { describe, it, expect } from "vitest";
import { generateWorkoutFilename } from "../../src/utils/filename";

describe("generateWorkoutFilename", () => {
	it("generates filename from template name", () => {
		const result = generateWorkoutFilename("2026-03-21", "Push Day", []);
		expect(result).toBe("2026-03-21 Push Day.md");
	});

	it("uses Workout for freeform sessions", () => {
		const result = generateWorkoutFilename("2026-03-21", null, []);
		expect(result).toBe("2026-03-21 Workout.md");
	});

	it("appends counter on collision", () => {
		const existing = ["2026-03-21 Push Day.md"];
		const result = generateWorkoutFilename("2026-03-21", "Push Day", existing);
		expect(result).toBe("2026-03-21 Push Day 2.md");
	});

	it("increments counter on multiple collisions", () => {
		const existing = ["2026-03-21 Push Day.md", "2026-03-21 Push Day 2.md"];
		const result = generateWorkoutFilename("2026-03-21", "Push Day", existing);
		expect(result).toBe("2026-03-21 Push Day 3.md");
	});
});
