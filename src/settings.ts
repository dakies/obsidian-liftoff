import { App, PluginSettingTab, Setting } from "obsidian";
import type WorkoutsPlugin from "./main";

export class WorkoutsSettingTab extends PluginSettingTab {
	plugin: WorkoutsPlugin;

	constructor(app: App, plugin: WorkoutsPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName("Workout folder")
			.setDesc("Folder where workout notes are saved")
			.addText((text) =>
				text
					.setPlaceholder("Workouts")
					.setValue(this.plugin.settings.workoutFolder)
					.onChange(async (value) => {
						this.plugin.settings.workoutFolder = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Template folder")
			.setDesc("Folder where workout templates are stored")
			.addText((text) =>
				text
					.setPlaceholder("Workout templates")
					.setValue(this.plugin.settings.templateFolder)
					.onChange(async (value) => {
						this.plugin.settings.templateFolder = value;
						await this.plugin.saveSettings();
					})
			);

		/* eslint-disable obsidianmd/ui/sentence-case -- German UI text capitalizes nouns */
		new Setting(containerEl)
			.setName("Vorlagen im Quelltextmodus öffnen")
			.setDesc("Workout-Vorlagen als rohes YAML öffnen statt im Eigenschaften-Editor.")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.templatesInSourceMode)
					.onChange(async (value) => {
						this.plugin.settings.templatesInSourceMode = value;
						await this.plugin.saveSettings();
					})
			);
		/* eslint-enable obsidianmd/ui/sentence-case */

		new Setting(containerEl)
			.setName("Exercise folder")
			.setDesc(
				"Folder where per-exercise notes live (e.g. Exercises). The details modal auto-resolves a note named like the exercise from this folder, in addition to any explicit linked note."
			)
			.addText((text) =>
				text
					.setPlaceholder("Exercises")
					.setValue(this.plugin.settings.exerciseFolder)
					.onChange(async (value) => {
						this.plugin.settings.exerciseFolder = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Weight unit")
			.setDesc("Default weight unit for new sets")
			.addDropdown((dropdown) =>
				dropdown
					.addOption("kg", "Kilograms (kg)")
					.addOption("lbs", "Pounds (lbs)")
					.setValue(this.plugin.settings.weightUnit)
					.onChange(async (value: "kg" | "lbs") => {
						this.plugin.settings.weightUnit = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Rest timer presets")
			.setDesc("Comma-separated list of rest timer durations in seconds")
			.addText((text) =>
				text
					.setPlaceholder("30, 60, 90, 120")
					.setValue(this.plugin.settings.restTimerPresets.join(", "))
					.onChange(async (value) => {
						const presets = value
							.split(",")
							.map((s) => parseInt(s.trim(), 10))
							.filter((n) => !isNaN(n) && n > 0);
						if (presets.length > 0) {
							this.plugin.settings.restTimerPresets = presets;
							await this.plugin.saveSettings();
						}
					})
			);

		new Setting(containerEl)
			.setName("Default rest duration")
			.setDesc("Default rest timer duration in seconds")
			.addText((text) =>
				text
					.setPlaceholder("90")
					.setValue(String(this.plugin.settings.defaultRestDuration))
					.onChange(async (value) => {
						const num = parseInt(value, 10);
						if (!isNaN(num) && num > 0) {
							this.plugin.settings.defaultRestDuration = num;
							await this.plugin.saveSettings();
						}
					})
			);

		new Setting(containerEl).setName("Timer exercises").setHeading();

		new Setting(containerEl)
			.setName("Default work duration")
			.setDesc("Default work phase duration in seconds for timer exercises")
			.addText((text) =>
				text
					.setPlaceholder("40")
					.setValue(String(this.plugin.settings.defaultWorkDuration))
					.onChange(async (value) => {
						const num = parseInt(value, 10);
						if (!isNaN(num) && num > 0) {
							this.plugin.settings.defaultWorkDuration = num;
							await this.plugin.saveSettings();
						}
					})
			);

		new Setting(containerEl)
			.setName("Default rest interval duration")
			.setDesc("Default rest phase duration in seconds for timer exercises")
			.addText((text) =>
				text
					.setPlaceholder("20")
					.setValue(String(this.plugin.settings.defaultRestIntervalDuration))
					.onChange(async (value) => {
						const num = parseInt(value, 10);
						if (!isNaN(num) && num > 0) {
							this.plugin.settings.defaultRestIntervalDuration = num;
							await this.plugin.saveSettings();
						}
					})
			);
	}
}
