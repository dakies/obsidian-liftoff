import { setIcon } from "obsidian";
import type WorkoutsPlugin from "../main";
import { HOME_VIEW_TYPE } from "../views/home-view";
import { WORKOUT_VIEW_TYPE } from "../views/workout-view";

/**
 * Floating pill with elapsed and rest time. Shown while a workout is running
 * but no workout or home view is on screen; tapping it returns to the workout.
 */
export class SessionIndicator {
	private el: HTMLElement;
	private elapsedEl: HTMLElement;
	private restEl: HTMLElement;

	constructor(private plugin: WorkoutsPlugin) {
		this.el = document.body.createDiv({
			cls: "ln-session-indicator ln-session-indicator-hidden",
			attr: { "aria-label": "Back to workout" },
		});
		setIcon(this.el.createSpan({ cls: "ln-session-indicator-icon" }), "dumbbell");
		this.elapsedEl = this.el.createSpan({ cls: "ln-session-indicator-elapsed" });
		this.restEl = this.el.createSpan({ cls: "ln-session-indicator-rest" });
		this.el.addEventListener("click", () => {
			void this.plugin.openWorkouts();
		});
	}

	update(): void {
		const session = this.plugin.activeSession;
		if (!session || this.pluginViewShown()) {
			this.el.addClass("ln-session-indicator-hidden");
			return;
		}
		this.el.removeClass("ln-session-indicator-hidden");

		const now = Date.now();
		this.elapsedEl.textContent = this.formatTime(now - session.startTimeMs);
		if (session.restStartTimeMs) {
			this.restEl.textContent = `Rest ${this.formatTime(now - session.restStartTimeMs)}`;
			this.restEl.removeClass("ln-session-indicator-hidden");
		} else {
			this.restEl.addClass("ln-session-indicator-hidden");
		}
	}

	private pluginViewShown(): boolean {
		const { workspace } = this.plugin.app;
		return [WORKOUT_VIEW_TYPE, HOME_VIEW_TYPE].some((type) =>
			workspace.getLeavesOfType(type).some((leaf) => leaf.view.containerEl.isShown())
		);
	}

	private formatTime(ms: number): string {
		const elapsed = Math.max(0, Math.floor(ms / 1000));
		const m = Math.floor(elapsed / 60);
		const s = elapsed % 60;
		return `${m}:${String(s).padStart(2, "0")}`;
	}

	destroy(): void {
		this.el.remove();
	}
}
