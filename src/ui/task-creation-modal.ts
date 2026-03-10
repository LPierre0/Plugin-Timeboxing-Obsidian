import { App, ButtonComponent, Modal, Notice, TextComponent } from "obsidian";
import { formatTimeLabel } from "../services/timebox-layout";
import type { TaskPreset } from "../settings";

interface TaskModalValues {
	taskName: string;
	startMinutes: number;
	endMinutes: number;
	color: string;
}

interface TaskCreationModalOptions {
	initialTaskName?: string;
	initialStartMinutes: number;
	initialEndMinutes?: number;
	initialColor?: string;
	presets?: TaskPreset[];
	mode?: "create" | "edit";
	onSubmit: (values: TaskModalValues) => Promise<void>;
}

const DEFAULT_TASK_COLOR = "#4f9cff";

export class TaskCreationModal extends Modal {
	private readonly options: TaskCreationModalOptions;
	private taskInput: TextComponent | null = null;
	private startInputEl: HTMLInputElement | null = null;
	private endInputEl: HTMLInputElement | null = null;
	private colorInputEl: HTMLInputElement | null = null;

	constructor(app: App, options: TaskCreationModalOptions) {
		super(app);
		this.options = options;
	}

	onOpen(): void {
		const { contentEl } = this;
		const initialStart = this.options.initialStartMinutes;
		const initialEnd = this.options.initialEndMinutes ?? (this.options.initialStartMinutes + 60);
		const mode = this.options.mode ?? "create";

		contentEl.empty();
		contentEl.addClass("timeboxing-task-modal");

		contentEl.createEl("h3", { text: mode === "edit" ? "Modifier la tâche" : "Créer une tâche" });
		this.renderPresetButtons(contentEl);

		this.taskInput = new TextComponent(contentEl);
		this.taskInput.setPlaceholder("Nom de la tâche");
		this.taskInput.setValue(this.options.initialTaskName ?? "");
		this.taskInput.inputEl.addClass("timeboxing-task-modal-input");

		const timeRow = contentEl.createDiv({ cls: "timeboxing-task-modal-time-row" });
		timeRow.createEl("label", { text: "Début", cls: "timeboxing-task-modal-label" });
		this.startInputEl = timeRow.createEl("input", {
			type: "time",
			cls: "timeboxing-task-modal-time-input",
		});
		this.startInputEl.value = formatTimeLabel(initialStart);

		timeRow.createEl("label", { text: "Fin", cls: "timeboxing-task-modal-label" });
		this.endInputEl = timeRow.createEl("input", {
			type: "time",
			cls: "timeboxing-task-modal-time-input",
		});
		this.endInputEl.value = formatTimeLabel(initialEnd);

		const colorRow = contentEl.createDiv({ cls: "timeboxing-task-modal-color-row" });
		colorRow.createEl("label", { text: "Couleur", cls: "timeboxing-task-modal-label" });
		this.colorInputEl = colorRow.createEl("input", {
			type: "color",
			cls: "timeboxing-task-modal-color-input",
		});
		this.colorInputEl.value = sanitizeColor(this.options.initialColor) ?? DEFAULT_TASK_COLOR;

		new ButtonComponent(contentEl)
			.setButtonText(mode === "edit" ? "Enregistrer" : "Créer")
			.setCta()
			.onClick(() => {
				void this.handleSubmit();
			});

		contentEl.addEventListener("keydown", (event: KeyboardEvent) => {
			if (event.key !== "Enter") {
				return;
			}
			event.preventDefault();
			void this.handleSubmit();
		});

		window.setTimeout(() => {
			this.taskInput?.inputEl.focus();
		}, 0);
	}

	onClose(): void {
		this.contentEl.empty();
		this.taskInput = null;
		this.startInputEl = null;
		this.endInputEl = null;
		this.colorInputEl = null;
	}

	private async handleSubmit(): Promise<void> {
		const taskName = (this.taskInput?.getValue() ?? "")
			.replace(/\r?\n/g, " ")
			.replace(/\s+/g, " ")
			.trim();
		if (!taskName) {
			new Notice("Saisissez un nom de tâche");
			return;
		}

		const startMinutes = parseTimeInput(this.startInputEl?.value ?? "");
		const endMinutes = parseTimeInput(this.endInputEl?.value ?? "");
		if (startMinutes === null || endMinutes === null) {
			new Notice("Heure invalide");
			return;
		}

		if (endMinutes <= startMinutes) {
			new Notice("L'heure de fin doit être après l'heure de début");
			return;
		}

		const color = sanitizeColor(this.colorInputEl?.value) ?? DEFAULT_TASK_COLOR;

		await this.options.onSubmit({
			taskName,
			startMinutes,
			endMinutes,
			color,
		});
		this.close();
	}

	private renderPresetButtons(contentEl: HTMLElement): void {
		const presets = this.options.presets ?? [];
		if (presets.length === 0) {
			return;
		}

		const presetsEl = contentEl.createDiv({ cls: "timeboxing-task-modal-presets" });
		presetsEl.createEl("span", { text: "Presets", cls: "timeboxing-task-modal-label" });

		const listEl = presetsEl.createDiv({ cls: "timeboxing-task-modal-preset-list" });
		for (const preset of presets) {
			const color = sanitizeColor(preset.color) ?? DEFAULT_TASK_COLOR;
			const buttonEl = listEl.createEl("button", {
				text: preset.name,
				cls: "timeboxing-task-modal-preset-btn",
			});
			buttonEl.style.borderColor = color;
			buttonEl.style.color = color;

			buttonEl.addEventListener("click", (event: MouseEvent) => {
				event.preventDefault();
				this.taskInput?.setValue(preset.name);
				if (this.colorInputEl) {
					this.colorInputEl.value = color;
				}
				this.taskInput?.inputEl.focus();
			});
		}
	}
}

function parseTimeInput(value: string): number | null {
	const match = /^([01]\d|2[0-3]):([0-5]\d)$/u.exec(value.trim());
	if (!match) {
		return null;
	}

	const hourRaw = match[1];
	const minuteRaw = match[2];
	if (!hourRaw || !minuteRaw) {
		return null;
	}

	const hours = Number.parseInt(hourRaw, 10);
	const minutes = Number.parseInt(minuteRaw, 10);
	return (hours * 60) + minutes;
}

function sanitizeColor(rawColor: string | undefined): string | null {
	if (!rawColor) {
		return null;
	}

	const color = rawColor.trim();
	if (/^#[0-9a-fA-F]{6}$/u.test(color)) {
		return color;
	}

	return null;
}
