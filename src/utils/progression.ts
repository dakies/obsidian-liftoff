import type { WorkoutSet } from "../types";

export interface RepRange {
	min: number;
	max: number | null; // null = open-ended, e.g. "10+"
}

export interface ExerciseSession {
	date: string; // YYYY-MM-DD
	sets: WorkoutSet[];
	rir?: number; // reps in reserve on the last set
}

export interface TargetOptions {
	range: RepRange | null;
	bodyweight?: boolean; // logged weight is added load on top of bodyweight
	since?: string | null; // YYYY-MM-DD, sessions before this date are ignored
}

export type TargetKind = "increase-weight" | "add-rep" | "decrease-weight" | "unknown-range";

export interface NextTarget {
	kind: TargetKind;
	text: string; // German one-liner, e.g. "Gewicht erhöhen · bis 73,5 kg für 8 Wdh."
}

// Smallest predicted headroom (fraction of the working weight) worth suggesting an increase for.
const MIN_INCREASE = 0.025;
// RIR on the last set from which the weight is too light, even below the top of the range.
const EASY_RIR = 3;
// Drop in estimated max over two sessions at the same weight that counts as a regression.
const MIN_DECLINE = 0.03;
// Load after a regression, as a fraction of the working weight, to build back up from.
const RESET_FACTOR = 0.9;

// Regressing exercises within the window that suggest whole-body fatigue rather than one lift.
export const DELOAD_THRESHOLD = 3;
export const DELOAD_WINDOW_DAYS = 14;

/**
 * Parse an exercise note's `reps` value into a rep range.
 * "8-10" → 8–10, "10" → 10–10, "10+ (…)" → 10–open, "5 pro Seite" → 5–5.
 */
export function parseRepRange(raw: unknown): RepRange | null {
	if (typeof raw === "number") {
		return Number.isFinite(raw) && raw > 0 ? { min: raw, max: raw } : null;
	}
	if (typeof raw !== "string") return null;

	const first = /(\d+)\s*(\+)?/.exec(raw);
	if (!first) return null;
	const min = parseInt(first[1]!, 10);
	if (first[2]) return { min, max: null };

	const rest = raw.slice(first.index + first[0].length);
	const second = /\d+/.exec(rest);
	if (!second) return { min, max: min };

	const other = parseInt(second[0], 10);
	return { min: Math.min(min, other), max: Math.max(min, other) };
}

/** Normalize a frontmatter date (string or Date) to YYYY-MM-DD. */
export function normalizeDate(raw: unknown): string | null {
	if (raw instanceof Date) {
		return isNaN(raw.getTime()) ? null : raw.toISOString().slice(0, 10);
	}
	if (typeof raw !== "string") return null;
	const match = /^\d{4}-\d{2}-\d{2}/.exec(raw.trim());
	return match ? match[0] : null;
}

/** Whole days from one YYYY-MM-DD date to another. */
export function daysBetween(from: string, to: string): number {
	return Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);
}

function workingSets(sets: WorkoutSet[]): WorkoutSet[] {
	return sets.filter((s) => s.reps > 0);
}

/** Sessions on or after `since` that have working sets, newest-first. */
function workingSessions(sessions: ExerciseSession[], since: string | null | undefined): ExerciseSession[] {
	return sessions.filter((s) => (!since || s.date >= since) && workingSets(s.sets).length > 0);
}

interface SessionSummary {
	weight: number; // heaviest working weight
	meanReps: number; // mean reps at that weight
}

function summarize(session: ExerciseSession): SessionSummary {
	const sets = workingSets(session.sets);
	const weight = Math.max(...sets.map((s) => s.weight));
	const atWeight = sets.filter((s) => s.weight === weight);
	return { weight, meanReps: atWeight.reduce((sum, s) => sum + s.reps, 0) / atWeight.length };
}

/** Epley estimate of the one-rep max. */
function estimateOneRepMax(weight: number, repsToFailure: number): number {
	return weight * (1 + repsToFailure / 30);
}

/** Heaviest weight Epley predicts can be lifted for `reps` reps. */
function weightForReps(oneRepMax: number, reps: number): number {
	return oneRepMax / (1 + reps / 30);
}

function roundWeight(w: number): number {
	return Math.round(w * 100) / 100;
}

export function formatWeight(w: number): string {
	return String(roundWeight(w)).replace(".", ",");
}

// "declining": reps falling at one weight. "below-range": stuck under the range, e.g. after too big a jump.
export type Regression = "declining" | "below-range";

/**
 * Whether the exercise is going backwards: mean reps at the working weight fell in each of the
 * last two sessions at the same weight by at least MIN_DECLINE of the estimated max, or stayed
 * below the range in the last two sessions without improving. Sessions must be newest-first.
 */
export function detectRegression(sessions: ExerciseSession[], options: TargetOptions): Regression | null {
	const [last, prev, before] = workingSessions(sessions, options.since).slice(0, 3).map(summarize);
	if (!last || !prev) return null;
	const sameWeight = last.weight === prev.weight;

	if (
		before && sameWeight && prev.weight === before.weight
		&& last.meanReps < prev.meanReps && prev.meanReps < before.meanReps
		// At a constant weight the relative drop in Epley's estimate depends on reps alone.
		&& (before.meanReps - last.meanReps) / (30 + before.meanReps) >= MIN_DECLINE
	) {
		return "declining";
	}

	const min = options.range?.min;
	if (min !== undefined && last.meanReps < min && prev.meanReps < min) {
		if (!sameWeight || last.meanReps <= prev.meanReps) return "below-range";
	}
	return null;
}

/**
 * Next-session target, based on the most recent session with working sets. Double progression
 * (reps up to the top of the range, then weight), with logged RIR moving the weight up early
 * or down, and regressions answered with a lighter weight. Sessions must be newest-first.
 */
export function computeNextTarget(
	sessions: ExerciseSession[],
	options: TargetOptions
): NextTarget | null {
	const last = workingSessions(sessions, options.since)[0];
	if (!last) return null;

	const sets = workingSets(last.sets);
	const { weight, meanReps } = summarize(last);
	const unit = sets[0]!.unit;
	const range = options.range;
	const rir = last.rir;

	// Logged kg on bodyweight exercises is added weight; 0 kg means no load to step down from.
	const decrease = (reason: string): NextTarget => {
		if (weight === 0) return { kind: "decrease-weight", text: `${reason} · leichtere Variante` };
		const lighter = `${formatWeight(Math.round(weight * RESET_FACTOR * 2) / 2)} ${unit}`;
		return {
			kind: "decrease-weight",
			text: options.bodyweight
				? `${reason} · Zusatzgewicht auf ≈ ${lighter} senken`
				: `${reason} · Gewicht auf ≈ ${lighter} senken`,
		};
	};

	const regression = detectRegression(sessions, options);
	if (regression) return decrease(regression === "declining" ? "Rückschritt" : "Unter dem Bereich");

	if (!range) {
		return { kind: "unknown-range", text: "+1 Wdh. oder +Gewicht" };
	}

	if (rir === 0 && meanReps < range.min) return decrease("Zu schwer");

	const topReached =
		range.max !== null && sets.filter((s) => s.weight === weight).every((s) => s.reps >= range.max!);
	if (topReached || (rir !== undefined && rir >= EASY_RIR)) {
		if (weight === 0) {
			return { kind: "increase-weight", text: "Zusatzgewicht oder schwerere Variante" };
		}
		// Bodyweight is unknown, so there is no estimated max to bound the added weight.
		if (options.bodyweight) {
			return { kind: "increase-weight", text: "Zusatzgewicht erhöhen" };
		}
		// Heaviest weight that still reaches the bottom of the range. RIR applies to the last set;
		// without it every set counts as taken to failure, which keeps the bound conservative.
		const oneRepMax = Math.max(
			...sets.map((s, i) => estimateOneRepMax(s.weight, s.reps + (i === sets.length - 1 ? rir ?? 0 : 0)))
		);
		const ceiling = weightForReps(oneRepMax, range.min);
		if (ceiling >= weight * (1 + MIN_INCREASE)) {
			const bound = formatWeight(Math.floor(ceiling * 2) / 2);
			return {
				kind: "increase-weight",
				text: `Gewicht erhöhen · bis ${bound} ${unit} für ${range.min} Wdh.`,
			};
		}
	}

	// The set rows are pre-filled with last session's weight and reps, so the target names only the change.
	return { kind: "add-rep", text: "+1 Wdh." };
}
