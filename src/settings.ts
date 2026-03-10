import { App, Plugin, PluginSettingTab, Setting } from "obsidian";

export interface TaskPreset {
	name: string;
	color: string;
}

export interface TimeboxingSettings {
	timeStepMinutes: 15 | 30;
	taskPresets: TaskPreset[];
}

interface SettingsHost extends Plugin {
	settings: TimeboxingSettings;
	saveSettings: () => Promise<void>;
}

const DEFAULT_PRESETS: TaskPreset[] = [
	{ name: "Deep Work", color: "#4f9cff" },
	{ name: "Sport", color: "#34c759" },
	{ name: "Admin", color: "#ff9f0a" },
	{ name: "Meeting", color: "#af52de" },
];

export const DEFAULT_SETTINGS: TimeboxingSettings = {
	timeStepMinutes: 30,
	taskPresets: DEFAULT_PRESETS,
};

export function normalizeTaskPresets(presets: TaskPreset[] | undefined): TaskPreset[] {
	const normalized = (presets ?? [])
		.map((preset) => ({
			name: normalizePresetName(preset?.name),
			color: normalizePresetColor(preset?.color),
		}))
		.filter((preset) => preset.name.length > 0);

	if (normalized.length > 0) {
		return normalized;
	}

	return DEFAULT_PRESETS.map((preset) => ({ ...preset }));
}

export class TimeboxingSettingTab extends PluginSettingTab {
	private readonly plugin: SettingsHost;

	constructor(app: App, plugin: SettingsHost) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName("Time slot step")
			.setDesc("Choose the grid step used in the timeboxing view.")
			.addDropdown((dropdown) => {
				dropdown
					.addOption("15", "15 minutes")
					.addOption("30", "30 minutes")
					.setValue(String(this.plugin.settings.timeStepMinutes))
					.onChange(async (value) => {
						this.plugin.settings.timeStepMinutes = value === "15" ? 15 : 30;
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName("Task presets")
			.setDesc("Preset name and color for quick task creation.")
			.setHeading();

		const presetsContainer = containerEl.createDiv({ cls: "timeboxing-settings-presets" });
		for (const [index, preset] of this.plugin.settings.taskPresets.entries()) {
			this.renderPresetRow(presetsContainer, preset, index);
		}

		new Setting(containerEl)
			.setName("Add preset")
			.setDesc("Create a new preset for the task modal.")
			.addButton((button) => {
				button
					.setButtonText("Add")
					.setCta()
					.onClick(() => {
						void this.handleAddPreset();
					});
			});
	}

	private renderPresetRow(containerEl: HTMLElement, preset: TaskPreset, index: number): void {
		new Setting(containerEl)
			.setName(`Preset ${index + 1}`)
			.addText((text) => {
				text
					.setPlaceholder("Task name")
					.setValue(preset.name)
					.onChange((value) => {
						void this.handlePresetNameChange(index, value);
					});
			})
			.addColorPicker((colorPicker) => {
				colorPicker
					.setValue(normalizePresetColor(preset.color))
					.onChange((value) => {
						void this.handlePresetColorChange(index, value);
					});
			})
			.addExtraButton((button) => {
				button
					.setIcon("trash")
					.setTooltip("Remove preset")
					.onClick(() => {
						void this.handleRemovePreset(index);
					});
			});
	}

	private async handlePresetNameChange(index: number, value: string): Promise<void> {
		const preset = this.plugin.settings.taskPresets[index];
		if (!preset) {
			return;
		}

		const normalized = normalizePresetName(value);
		preset.name = normalized.length > 0 ? normalized : `Preset ${index + 1}`;
		await this.plugin.saveSettings();
	}

	private async handlePresetColorChange(index: number, value: string): Promise<void> {
		const preset = this.plugin.settings.taskPresets[index];
		if (!preset) {
			return;
		}

		preset.color = normalizePresetColor(value);
		await this.plugin.saveSettings();
	}

	private async handleRemovePreset(index: number): Promise<void> {
		if (this.plugin.settings.taskPresets.length <= 1) {
			return;
		}

		this.plugin.settings.taskPresets.splice(index, 1);
		await this.plugin.saveSettings();
		this.display();
	}

	private async handleAddPreset(): Promise<void> {
		this.plugin.settings.taskPresets.push({
			name: `Preset ${this.plugin.settings.taskPresets.length + 1}`,
			color: "#4f9cff",
		});
		await this.plugin.saveSettings();
		this.display();
	}
}

function normalizePresetName(value: string | undefined): string {
	return (value ?? "").replace(/\s+/g, " ").trim();
}

function normalizePresetColor(value: string | undefined): string {
	const normalized = (value ?? "").trim();
	if (/^#[0-9a-fA-F]{6}$/u.test(normalized)) {
		return normalized;
	}
	return "#4f9cff";
}
