import { describe, it, expect } from "vitest";
import { resolveFinishTime, FINISH_BUFFER_MS } from "../../src/utils/finish-time";

const MIN = 60 * 1000;
const start = Date.UTC(2026, 9, 16, 10, 0);

describe("resolveFinishTime", () => {
	it("uses now when finishing right after the last set", () => {
		const now = start + 60 * MIN;
		expect(resolveFinishTime(start, now, start + 55 * MIN)).toBe(now);
	});

	it("uses now when no set completion was tracked", () => {
		const now = start + 6 * 60 * MIN;
		expect(resolveFinishTime(start, now, null)).toBe(now);
		expect(resolveFinishTime(start, now, undefined)).toBe(now);
	});

	it("ends shortly after the last set when Finish was forgotten", () => {
		const lastSet = start + 58 * MIN;
		const now = start + 394 * MIN;
		expect(resolveFinishTime(start, now, lastSet)).toBe(lastSet + FINISH_BUFFER_MS);
	});

	it("keeps a 30 minute gap as a normal finish", () => {
		const lastSet = start + 40 * MIN;
		expect(resolveFinishTime(start, lastSet + 30 * MIN, lastSet)).toBe(lastSet + 30 * MIN);
	});

	it("never ends before the start", () => {
		expect(resolveFinishTime(start, start + 600 * MIN, start - 60 * MIN)).toBe(start);
	});
});
