import type { WorkoutSet } from "../types";

export interface RepRange {
	min: number;
	max: number | null; // null = open-ended, e.g. "10+"
}

export interface ExerciseSession {
	date: string; // YYYY-MM-DD
	sets: WorkoutSet[];
}

export interface TargetOptions {
	range: RepRange | null;
	bodyweight?: boolean; // logged weight is added load on top of bodyweight
	since?: string | null; // YYYY-MM-DD, sessions before this date are ignored
}

export type TargetKind = "increase-weight" | "add-rep" | "unknown-range";

export interface NextTarget {
	kind: TargetKind;
	text: string; // German one-liner, e.g. "32 kg × 8 · Gewicht erhöhen"
}

const FALLBACK_STEP = 2.5;

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

function workingSets(sets: WorkoutSet[]): WorkoutSet[] {
	return sets.filter((s) => s.reps > 0);
}

/**
 * Smallest positive weight increase between consecutive working sets, in
 * chronological order. Sessions must be newest-first.
 */
export function detectWeightStep(sessions: ExerciseSession[]): number {
	let step = Infinity;
	let prev: number | null = null;
	for (const session of [...sessions].reverse()) {
		for (const set of workingSets(session.sets)) {
			if (prev !== null && set.weight > prev) {
				step = Math.min(step, set.weight - prev);
			}
			prev = set.weight;
		}
	}
	return Number.isFinite(step) ? roundWeight(step) : FALLBACK_STEP;
}

function roundWeight(w: number): number {
	return Math.round(w * 100) / 100;
}

export function formatWeight(w: number): string {
	return String(roundWeight(w)).replace(".", ",");
}

/**
 * Double-progression target for the next session, based on the most recent
 * session with working sets. Sessions must be newest-first.
 */
export function computeNextTarget(
	sessions: ExerciseSession[],
	options: TargetOptions
): NextTarget | null {
	const since = options.since ?? null;
	const relevant = sessions.filter((s) => !since || s.date >= since);
	const last = relevant.find((s) => workingSets(s.sets).length > 0);
	if (!last) return null;

	const sets = workingSets(last.sets);
	const weight = Math.max(...sets.map((s) => s.weight));
	const unit = sets[0]!.unit;
	const range = options.range;

	if (!range) {
		return { kind: "unknown-range", text: "+1 Wdh. oder +Gewicht" };
	}

	const atWeight = sets.filter((s) => s.weight === weight);
	const topReached = range.max !== null && atWeight.every((s) => s.reps >= range.max!);
	// Logged kg on bodyweight exercises is added weight; 0 kg means no load to step up from.
	const loadLabel = (w: number): string => {
		if (w === 0) return "Körpergewicht";
		return options.bodyweight
			? `Körpergewicht + ${formatWeight(w)} ${unit}`
			: `${formatWeight(w)} ${unit}`;
	};

	if (topReached) {
		if (weight === 0) {
			return {
				kind: "increase-weight",
				text: `Zusatzgewicht +${formatWeight(FALLBACK_STEP)} ${unit} oder schwerere Variante`,
			};
		}
		const next = weight + detectWeightStep(relevant);
		return {
			kind: "increase-weight",
			text: `${loadLabel(next)} × ${range.min} · Gewicht erhöhen`,
		};
	}

	// The set rows are pre-filled with last session's weight and reps, so the target names only the change.
	return { kind: "add-rep", text: "+1 Wdh." };
}
