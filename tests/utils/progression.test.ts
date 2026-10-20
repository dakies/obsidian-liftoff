import { describe, it, expect } from "vitest";
import {
	computeNextTarget,
	detectWeightStep,
	normalizeDate,
	parseRepRange,
	type ExerciseSession,
} from "../../src/utils/progression";
import type { WorkoutSet } from "../../src/types";

function sets(...pairs: Array<[number, number]>): WorkoutSet[] {
	return pairs.map(([weight, reps]) => ({ weight, reps, unit: "kg", completed: true }));
}

describe("parseRepRange", () => {
	it("parses a range", () => {
		expect(parseRepRange("8-10")).toEqual({ min: 8, max: 10 });
		expect(parseRepRange("10-15")).toEqual({ min: 10, max: 15 });
		expect(parseRepRange("8–10 pro Bein")).toEqual({ min: 8, max: 10 });
	});

	it("parses a single number", () => {
		expect(parseRepRange("10")).toEqual({ min: 10, max: 10 });
		expect(parseRepRange(10)).toEqual({ min: 10, max: 10 });
		expect(parseRepRange("5 pro Seite")).toEqual({ min: 5, max: 5 });
	});

	it("parses an open-ended range", () => {
		expect(parseRepRange("10+ (letzter Satz bis zum Muskelversagen)")).toEqual({ min: 10, max: null });
	});

	it("returns null for unparseable input", () => {
		expect(parseRepRange("bis Versagen")).toBeNull();
		expect(parseRepRange(undefined)).toBeNull();
		expect(parseRepRange("")).toBeNull();
	});
});

describe("normalizeDate", () => {
	it("accepts strings and Date objects", () => {
		expect(normalizeDate("2026-08-10")).toBe("2026-08-10");
		expect(normalizeDate(new Date("2026-08-10T00:00:00Z"))).toBe("2026-08-10");
		expect(normalizeDate("garbage")).toBeNull();
		expect(normalizeDate(undefined)).toBeNull();
	});
});

describe("detectWeightStep", () => {
	it("finds the smallest increase in chronological order", () => {
		const history: ExerciseSession[] = [
			{ date: "2026-03-10", sets: sets([28, 8], [28, 8], [26, 6]) },
			{ date: "2026-03-03", sets: sets([24, 10], [26, 8]) },
			{ date: "2026-02-24", sets: sets([20, 10]) },
		];
		expect(detectWeightStep(history)).toBe(2);
	});

	it("ignores sets with zero reps", () => {
		const history: ExerciseSession[] = [
			{ date: "2026-03-10", sets: sets([60, 8], [61, 0]) },
			{ date: "2026-03-03", sets: sets([55, 8]) },
		];
		expect(detectWeightStep(history)).toBe(5);
	});

	it("falls back to 2.5 without any increase", () => {
		expect(detectWeightStep([{ date: "2026-03-10", sets: sets([30, 10], [30, 10]) }])).toBe(2.5);
	});
});

describe("computeNextTarget", () => {
	const range = { min: 10, max: 12 };

	it("suggests more weight when every set at the working weight hit the top", () => {
		const history: ExerciseSession[] = [
			{ date: "2026-03-10", sets: sets([56, 12], [56, 12], [56, 12]) },
			{ date: "2026-03-03", sets: sets([52, 12], [52, 12]) },
		];
		const target = computeNextTarget(history, { range });
		expect(target?.kind).toBe("increase-weight");
		expect(target?.text).toBe("60 kg × 10 · Gewicht erhöhen");
	});

	it("suggests one more rep otherwise", () => {
		const history: ExerciseSession[] = [{ date: "2026-03-10", sets: sets([30, 12], [30, 11], [30, 9]) }];
		const target = computeNextTarget(history, { range });
		expect(target?.kind).toBe("add-rep");
		expect(target?.text).toBe("30 kg, +1 Wdh. (zuletzt 12/11/9)");
	});

	it("only judges sets at the working weight", () => {
		const history: ExerciseSession[] = [{ date: "2026-03-10", sets: sets([28, 12], [28, 12], [26, 8]) }];
		expect(computeNextTarget(history, { range })?.kind).toBe("increase-weight");
	});

	it("always adds reps for open-ended ranges", () => {
		const history: ExerciseSession[] = [{ date: "2026-03-10", sets: sets([20, 15], [20, 15]) }];
		expect(computeNextTarget(history, { range: { min: 10, max: null } })?.kind).toBe("add-rep");
	});

	it("handles a missing rep range", () => {
		const history: ExerciseSession[] = [{ date: "2026-03-10", sets: sets([20, 10]) }];
		expect(computeNextTarget(history, { range: null })?.text).toBe("+1 Wdh. oder +Gewicht");
	});

	it("skips sessions without working sets", () => {
		const history: ExerciseSession[] = [
			{ date: "2026-03-17", sets: sets([30, 0]) },
			{ date: "2026-03-10", sets: sets([30, 12], [30, 10]) },
		];
		expect(computeNextTarget(history, { range })?.text).toBe("30 kg, +1 Wdh. (zuletzt 12/10)");
	});

	it("ignores sessions before since, including for step detection", () => {
		const history: ExerciseSession[] = [
			{ date: "2026-09-02", sets: sets([30, 12], [30, 12]) },
			{ date: "2026-08-10", sets: sets([30, 10]) },
			{ date: "2026-07-28", sets: sets([56, 12], [56, 12]) },
			{ date: "2026-07-02", sets: sets([52, 12]) },
		];
		const target = computeNextTarget(history, { range, since: "2026-08-10" });
		expect(target?.text).toBe("32,5 kg × 10 · Gewicht erhöhen");
		expect(computeNextTarget(history, { range, since: "2026-09-03" })).toBeNull();
	});

	it("treats logged kg on bodyweight exercises as added weight", () => {
		const atBodyweight: ExerciseSession[] = [{ date: "2026-03-10", sets: sets([0, 9], [0, 8]) }];
		expect(computeNextTarget(atBodyweight, { range: { min: 6, max: 12 }, bodyweight: true })?.text)
			.toBe("Körpergewicht, +1 Wdh. (zuletzt 9/8)");

		const topAtBodyweight: ExerciseSession[] = [{ date: "2026-03-10", sets: sets([0, 12], [0, 12]) }];
		expect(computeNextTarget(topAtBodyweight, { range: { min: 6, max: 12 }, bodyweight: true })?.text)
			.toBe("Zusatzgewicht +2,5 kg oder schwerere Variante");

		const loaded: ExerciseSession[] = [
			{ date: "2026-03-10", sets: sets([8, 12], [8, 12]) },
			{ date: "2026-03-03", sets: sets([4, 12]) },
		];
		expect(computeNextTarget(loaded, { range: { min: 6, max: 12 }, bodyweight: true })?.text)
			.toBe("Körpergewicht + 12 kg × 6 · Gewicht erhöhen");
	});

	it("returns null without history", () => {
		expect(computeNextTarget([], { range })).toBeNull();
	});
});
