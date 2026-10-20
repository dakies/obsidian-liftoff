import { describe, it, expect } from "vitest";
import { isPathInFolder } from "../../src/utils/folder";

describe("isPathInFolder", () => {
	it("matches files inside the folder", () => {
		expect(isPathInFolder("Workouts/Templates/Oberkörper 1.md", "Workouts/Templates")).toBe(true);
		expect(isPathInFolder("Workouts/Templates/Archiv/Alt.md", "Workouts/Templates")).toBe(true);
	});

	it("tolerates leading and trailing slashes", () => {
		expect(isPathInFolder("Workouts/Templates/A.md", "/Workouts/Templates/")).toBe(true);
	});

	it("rejects siblings and prefixes", () => {
		expect(isPathInFolder("Workouts/Sessions/2026-10-16 Unterkörper 1.md", "Workouts/Templates")).toBe(false);
		expect(isPathInFolder("Workouts/Templates2/A.md", "Workouts/Templates")).toBe(false);
		expect(isPathInFolder("Workouts/Templates", "Workouts/Templates")).toBe(false);
	});

	it("never matches an empty folder setting", () => {
		expect(isPathInFolder("Note.md", "")).toBe(false);
		expect(isPathInFolder("Workouts/Templates/A.md", "  ")).toBe(false);
	});
});
