import { Plugin, WorkspaceLeaf } from "obsidian";
import {
	DEFAULT_SETTINGS,
	type ActiveSession,
	type LiftOffSettings,
	type WorkoutTemplate,
} from "./types";
import { LiftOffSettingTab } from "./settings";
import { WorkoutStore } from "./storage/workout-store";
import { TemplateStore } from "./storage/template-store";
import { HomeView, HOME_VIEW_TYPE } from "./views/home-view";
import { WorkoutView, WORKOUT_VIEW_TYPE } from "./views/workout-view";
import { ConfirmModal } from "./components/modals";

interface PersistedData {
	settings: LiftOffSettings;
	activeSession: ActiveSession | null;
}

export default class LiftOffPlugin extends Plugin {
	settings: LiftOffSettings = DEFAULT_SETTINGS;
	activeSession: ActiveSession | null = null;
	workoutStore: WorkoutStore = null!;
	templateStore: TemplateStore = null!;

	async onload() {
		await this.loadSettings();

		this.workoutStore = new WorkoutStore(this.app, () => this.settings);
		this.templateStore = new TemplateStore(this.app, () => this.settings);

		this.registerView(HOME_VIEW_TYPE, (leaf) => new HomeView(leaf, this));
		this.registerView(WORKOUT_VIEW_TYPE, (leaf) => new WorkoutView(leaf, this));

		this.addSettingTab(new LiftOffSettingTab(this.app, this));

		this.addRibbonIcon("dumbbell", "Open liftoff", () => {
			void this.openLiftoff();
		});

		this.addCommand({
			id: "open-home",
			name: "Open home",
			callback: () => {
				void this.showHomeView();
			},
		});

		this.addCommand({
			id: "start-empty-workout",
			name: "Start empty workout",
			callback: () => {
				void this.startWorkout(null);
			},
		});

		this.addCommand({
			id: "resume-workout",
			name: "Resume in-progress workout",
			callback: () => {
				void this.resumeWorkout();
			},
		});
	}

	onunload() {}

	private getOrCreateLeaf(): WorkspaceLeaf {
		// Reuse an existing plugin leaf to avoid "No tab group" errors
		const existing =
			this.app.workspace.getLeavesOfType(HOME_VIEW_TYPE)[0] ??
			this.app.workspace.getLeavesOfType(WORKOUT_VIEW_TYPE)[0];
		return existing ?? this.app.workspace.getLeaf(false);
	}

	private async cleanupExtraLeaves(keep: WorkspaceLeaf): Promise<void> {
		for (const l of this.app.workspace.getLeavesOfType(HOME_VIEW_TYPE)) {
			if (l !== keep) l.detach();
		}
		for (const l of this.app.workspace.getLeavesOfType(WORKOUT_VIEW_TYPE)) {
			if (l !== keep) l.detach();
		}
	}

	async openLiftoff(): Promise<void> {
		// Ribbon entry point: resume in-flight session if any, else home.
		if (this.activeSession) {
			await this.resumeWorkout();
		} else {
			await this.showHomeView();
		}
	}

	async showHomeView(): Promise<void> {
		const leaf = this.getOrCreateLeaf();
		await this.cleanupExtraLeaves(leaf);

		await leaf.setViewState({
			type: HOME_VIEW_TYPE,
			active: true,
		});
		await this.app.workspace.revealLeaf(leaf);
	}

	async startWorkout(template: WorkoutTemplate | null): Promise<void> {
		if (this.activeSession) {
			const confirmed = await new ConfirmModal(
				this.app,
				"Discard the in-progress workout and start a new one?"
			).openAndWait();
			if (!confirmed) return;
			await this.clearActiveSession();
		}

		const leaf = this.getOrCreateLeaf();
		await this.cleanupExtraLeaves(leaf);

		await leaf.setViewState({
			type: WORKOUT_VIEW_TYPE,
			active: true,
		});
		await this.app.workspace.revealLeaf(leaf);

		const view = leaf.view;
		if (view instanceof WorkoutView) {
			if (template) {
				view.startFromTemplate(template);
			} else {
				view.startEmpty();
			}
		}
	}

	async resumeWorkout(): Promise<void> {
		if (!this.activeSession) {
			await this.showHomeView();
			return;
		}

		const leaf = this.getOrCreateLeaf();
		await this.cleanupExtraLeaves(leaf);

		await leaf.setViewState({
			type: WORKOUT_VIEW_TYPE,
			active: true,
		});
		await this.app.workspace.revealLeaf(leaf);

		const view = leaf.view;
		if (view instanceof WorkoutView) {
			view.restoreFromActiveSession();
		}
	}

	async loadSettings() {
		const raw = (await this.loadData()) as
			| Partial<PersistedData>
			| Partial<LiftOffSettings>
			| null;

		if (raw && typeof raw === "object" && "settings" in raw && raw.settings) {
			const persisted = raw as Partial<PersistedData>;
			this.settings = { ...DEFAULT_SETTINGS, ...persisted.settings };
			this.activeSession = persisted.activeSession ?? null;
		} else {
			// Legacy format: data.json was the settings object directly.
			this.settings = { ...DEFAULT_SETTINGS, ...(raw as Partial<LiftOffSettings> ?? {}) };
			this.activeSession = null;
		}
	}

	async saveSettings() {
		await this.persist();
	}

	async saveActiveSession(session: ActiveSession): Promise<void> {
		this.activeSession = session;
		await this.persist();
	}

	async clearActiveSession(): Promise<void> {
		this.activeSession = null;
		await this.persist();
	}

	private async persist(): Promise<void> {
		const data: PersistedData = {
			settings: this.settings,
			activeSession: this.activeSession,
		};
		await this.saveData(data);
	}
}
