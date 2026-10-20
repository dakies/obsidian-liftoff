/** Gap after the last completed set beyond which Finish counts as forgotten. */
export const FORGOTTEN_FINISH_GAP_MS = 30 * 60 * 1000;
/** Time added after the last completed set when Finish was forgotten. */
export const FINISH_BUFFER_MS = 5 * 60 * 1000;

/**
 * End time for a finished workout. If Finish is tapped long after the last
 * completed set (e.g. the next day), end shortly after that set instead of now.
 */
export function resolveFinishTime(
	startMs: number,
	nowMs: number,
	lastSetCompletedMs: number | null | undefined
): number {
	if (lastSetCompletedMs == null) return nowMs;
	if (nowMs - lastSetCompletedMs <= FORGOTTEN_FINISH_GAP_MS) return nowMs;
	return Math.max(startMs, lastSetCompletedMs + FINISH_BUFFER_MS);
}
