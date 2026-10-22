import { describe, it, expect } from "vitest";
import {
	computeNextTarget,
	daysBetween,
	detectRegression,
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

describe("daysBetween", () => {
	it("counts whole days", () => {
		expect(daysBetween("2026-10-08", "2026-10-22")).toBe(14);
		expect(daysBetween("2026-10-22", "2026-10-22")).toBe(0);
	});
});

describe("detectRegression", () => {
	const range = { min: 8, max: 10 };

	it("flags two sessions below the range without improvement", () => {
		const history: ExerciseSession[] = [
			{ date: "2026-09-11", sets: sets([75, 5], [75, 5], [75, 5]) },
			{ date: "2026-09-05", sets: sets([75, 6], [75, 6], [75, 7]) },
		];
		expect(detectRegression(history, { range })).toBe(true);
	});

	it("does not flag reps climbing back towards the range", () => {
		const history: ExerciseSession[] = [
			{ date: "2026-09-11", sets: sets([75, 7], [75, 7], [75, 7]) },
			{ date: "2026-09-05", sets: sets([75, 6], [75, 6], [75, 6]) },
		];
		expect(detectRegression(history, { range })).toBe(false);
	});

	it("flags staying below the range after a weight change", () => {
		const history: ExerciseSession[] = [
			{ date: "2026-09-11", sets: sets([70, 7], [70, 7]) },
			{ date: "2026-09-05", sets: sets([75, 6], [75, 6]) },
		];
		expect(detectRegression(history, { range })).toBe(true);
	});

	it("flags reps falling twice at the same weight", () => {
		const history: ExerciseSession[] = [
			{ date: "2026-09-11", sets: sets([20, 9], [20, 8], [20, 9]) },
			{ date: "2026-09-05", sets: sets([20, 12], [20, 10], [20, 9]) },
			{ date: "2026-08-30", sets: sets([20, 12], [20, 12], [20, 12]) },
		];
		expect(detectRegression(history, { range: { min: 10, max: 15 } })).toBe(true);
		expect(detectRegression(history, { range: null })).toBe(true);
	});

	it("ignores small drops at high reps", () => {
		const history: ExerciseSession[] = [
			{ date: "2026-09-22", sets: sets([10, 18], [10, 18], [10, 18]) },
			{ date: "2026-09-15", sets: sets([10, 19], [10, 18], [10, 18]) },
			{ date: "2026-09-08", sets: sets([10, 19], [10, 19], [10, 19]) },
		];
		expect(detectRegression(history, { range: { min: 15, max: 20 } })).toBe(false);
	});

	it("does not count a deliberate weight reset as falling reps", () => {
		const history: ExerciseSession[] = [
			{ date: "2026-10-16", sets: sets([70, 8], [70, 8], [70, 9]) },
			{ date: "2026-09-23", sets: sets([70, 10], [70, 10], [70, 10]) },
			{ date: "2026-09-10", sets: sets([80, 9], [80, 10], [80, 9]) },
		];
		expect(detectRegression(history, { range })).toBe(false);
	});

	it("needs two sessions after since", () => {
		const history: ExerciseSession[] = [
			{ date: "2026-09-11", sets: sets([75, 5], [75, 5]) },
			{ date: "2026-09-05", sets: sets([75, 6], [75, 6]) },
		];
		expect(detectRegression(history.slice(0, 1), { range })).toBe(false);
		expect(detectRegression(history, { range, since: "2026-09-10" })).toBe(false);
	});
});

describe("computeNextTarget", () => {
	const range = { min: 10, max: 12 };

	it("suggests more weight, bounded by the bottom of the range, when every set hit the top", () => {
		const history: ExerciseSession[] = [{ date: "2026-03-10", sets: sets([70, 10], [70, 10], [70, 10]) }];
		const target = computeNextTarget(history, { range: { min: 8, max: 10 } });
		expect(target?.kind).toBe("increase-weight");
		expect(target?.text).toBe("Gewicht erhöhen · bis 73,5 kg für 8 Wdh.");
	});

	it("suggests one more rep otherwise", () => {
		const history: ExerciseSession[] = [{ date: "2026-03-10", sets: sets([30, 12], [30, 11], [30, 9]) }];
		const target = computeNextTarget(history, { range });
		expect(target?.kind).toBe("add-rep");
		expect(target?.text).toBe("+1 Wdh.");
	});

	it("only judges sets at the working weight", () => {
		const history: ExerciseSession[] = [{ date: "2026-03-10", sets: sets([28, 12], [28, 12], [26, 8]) }];
		expect(computeNextTarget(history, { range })?.text).toBe("Gewicht erhöhen · bis 29 kg für 10 Wdh.");
	});

	it("adds reps past a fixed target until a heavier weight fits", () => {
		const atTarget: ExerciseSession[] = [{ date: "2026-03-10", sets: sets([17.5, 10], [17.5, 10]) }];
		expect(computeNextTarget(atTarget, { range: { min: 10, max: 10 } })?.text).toBe("+1 Wdh.");

		const pastTarget: ExerciseSession[] = [{ date: "2026-03-10", sets: sets([17.5, 12], [17.5, 12]) }];
		expect(computeNextTarget(pastTarget, { range: { min: 10, max: 10 } })?.text)
			.toBe("Gewicht erhöhen · bis 18 kg für 10 Wdh.");
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
		expect(computeNextTarget(history, { range })?.text).toBe("+1 Wdh.");
	});

	it("ignores sessions before since", () => {
		const history: ExerciseSession[] = [
			{ date: "2026-09-02", sets: sets([30, 12], [30, 12]) },
			{ date: "2026-08-10", sets: sets([30, 10]) },
			{ date: "2026-07-28", sets: sets([56, 12], [56, 12]) },
		];
		expect(computeNextTarget(history, { range, since: "2026-08-10" })?.text)
			.toBe("Gewicht erhöhen · bis 31,5 kg für 10 Wdh.");
		expect(computeNextTarget(history, { range, since: "2026-09-03" })).toBeNull();
	});

	describe("with logged RIR", () => {
		it("moves the weight up early when the last set was easy", () => {
			const history: ExerciseSession[] = [
				{ date: "2026-03-10", sets: sets([30, 10], [30, 10], [30, 10]), rir: 3 },
			];
			expect(computeNextTarget(history, { range })?.text).toBe("Gewicht erhöhen · bis 32 kg für 10 Wdh.");
			expect(computeNextTarget([{ ...history[0]!, rir: 2 }], { range })?.text).toBe("+1 Wdh.");
		});

		it("raises the bound by the reps left in reserve", () => {
			const history: ExerciseSession[] = [
				{ date: "2026-03-10", sets: sets([70, 10], [70, 10], [70, 10]), rir: 2 },
			];
			expect(computeNextTarget(history, { range: { min: 8, max: 10 } })?.text)
				.toBe("Gewicht erhöhen · bis 77 kg für 8 Wdh.");
		});

		it("lowers the weight after failing below the range", () => {
			const history: ExerciseSession[] = [
				{ date: "2026-03-10", sets: sets([75, 7], [75, 7], [75, 7]), rir: 0 },
			];
			const target = computeNextTarget(history, { range: { min: 8, max: 10 } });
			expect(target?.kind).toBe("decrease-weight");
			expect(target?.text).toBe("Zu schwer · Gewicht auf ≈ 67,5 kg senken");
		});
	});

	it("lowers the weight after a regression", () => {
		const history: ExerciseSession[] = [
			{ date: "2026-09-11", sets: sets([75, 5], [75, 5], [75, 5]) },
			{ date: "2026-09-05", sets: sets([75, 6], [75, 6], [75, 7]) },
		];
		const target = computeNextTarget(history, { range: { min: 8, max: 10 } });
		expect(target?.kind).toBe("decrease-weight");
		expect(target?.text).toBe("Rückschritt · Gewicht auf ≈ 67,5 kg senken");
	});

	it("treats logged kg on bodyweight exercises as added weight", () => {
		const bw = { range: { min: 6, max: 12 }, bodyweight: true };

		const atBodyweight: ExerciseSession[] = [{ date: "2026-03-10", sets: sets([0, 9], [0, 8]) }];
		expect(computeNextTarget(atBodyweight, bw)?.text).toBe("+1 Wdh.");

		const topAtBodyweight: ExerciseSession[] = [{ date: "2026-03-10", sets: sets([0, 12], [0, 12]) }];
		expect(computeNextTarget(topAtBodyweight, bw)?.text).toBe("Zusatzgewicht oder schwerere Variante");

		const loaded: ExerciseSession[] = [{ date: "2026-03-10", sets: sets([8, 12], [8, 12]) }];
		expect(computeNextTarget(loaded, bw)?.text).toBe("Zusatzgewicht erhöhen");

		const regressing: ExerciseSession[] = [
			{ date: "2026-03-17", sets: sets([8, 5], [8, 4]) },
			{ date: "2026-03-10", sets: sets([8, 5], [8, 5]) },
		];
		expect(computeNextTarget(regressing, bw)?.text).toBe("Rückschritt · Zusatzgewicht auf ≈ 7 kg senken");
		const regressingAtBodyweight = regressing.map((s) => ({ ...s, sets: s.sets.map((x) => ({ ...x, weight: 0 })) }));
		expect(computeNextTarget(regressingAtBodyweight, bw)?.text).toBe("Rückschritt · leichtere Variante");
	});

	it("returns null without history", () => {
		expect(computeNextTarget([], { range })).toBeNull();
	});
});
