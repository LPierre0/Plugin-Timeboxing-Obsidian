import { Notice, Plugin, TFile, WorkspaceLeaf } from "obsidian";
import { registerCommands } from "./commands";
import {
	buildTaskLine,
	createTaskId,
	findTaskLineIndex,
	formatStartedAt,
	upsertInlineField,
} from "./services/task-lines";
import { TaskParser } from "./services/task-parser";
import {
	DEFAULT_SETTINGS,
	normalizeTaskPresets,
	TimeboxingSettingTab,
	TimeboxingSettings,
} from "./settings";
import type { TaskBlock } from "./types";
import { TaskCreationModal } from "./ui/task-creation-modal";
import { TimeboxingView, VIEW_TYPE_TIMEBOXING } from "./views/timeboxing-view";

const REFRESH_DEBOUNCE_MS = 180;

export default class TimeboxingPlugin extends Plugin {
	settings: TimeboxingSettings = DEFAULT_SETTINGS;

	private taskParser: TaskParser | null = null;
	private latestTasks: TaskBlock[] = [];
	private refreshTimeoutId: number | null = null;
	private sourceFilePath: string | null = null;
	private mutationQueue: Promise<void> = Promise.resolve();

	async onload(): Promise<void> {
		await this.loadSettings();

		this.taskParser = new TaskParser(this.app);

		this.registerView(
			VIEW_TYPE_TIMEBOXING,
			(leaf: WorkspaceLeaf) => new TimeboxingView(
				leaf,
				this.settings.timeStepMinutes,
				this.latestTasks,
				this.settings.taskPresets,
				{
					onTimeSlotClick: (startMinutes: number) => {
						this.openTaskCreationModal(startMinutes);
					},
					onTaskBlockClick: (task: TaskBlock) => {
						this.openTaskEditModal(task);
					},
					onPresetClick: (presetIndex: number) => {
						this.openPresetTaskCreationModal(presetIndex);
					},
					onTaskStartClick: (task: TaskBlock) => {
						void this.startTaskInSourceFile(task);
					},
				},
			),
		);

		registerCommands(this);
		this.addSettingTab(new TimeboxingSettingTab(this.app, this));

		this.registerEvent(this.app.metadataCache.on("changed", (file: TFile) => {
			this.handleMetadataChanged(file);
		}));

		if (this.getTimeboxingViews().length > 0) {
			await this.refreshTasksForCurrentSource();
		}
	}

	onunload(): void {
		if (this.refreshTimeoutId !== null) {
			window.clearTimeout(this.refreshTimeoutId);
			this.refreshTimeoutId = null;
		}
	}

	async openTimeboxView(): Promise<void> {
		if (this.taskParser) {
			const dailyFile = await this.taskParser.getOrCreateTodayDailyFile();
			this.sourceFilePath = dailyFile.path;
		}

		const leaf = this.app.workspace.getLeaf(true);
		await leaf.setViewState({
			type: VIEW_TYPE_TIMEBOXING,
			active: true,
		});
		await this.app.workspace.revealLeaf(leaf);
		await this.refreshTasksForCurrentSource();
	}

	async openTimeboxInRightSidebar(): Promise<void> {
		if (this.taskParser) {
			const dailyFile = await this.taskParser.getOrCreateTodayDailyFile();
			this.sourceFilePath = dailyFile.path;
		}

		const rightLeaf = this.app.workspace.getRightLeaf(false)
			?? this.app.workspace.getRightLeaf(true)
			?? this.app.workspace.getLeaf(true);

		await rightLeaf.setViewState({
			type: VIEW_TYPE_TIMEBOXING,
			active: true,
		});
		await this.app.workspace.revealLeaf(rightLeaf);
		await this.refreshTasksForCurrentSource();
	}

	async loadSettings(): Promise<void> {
		const data = await this.loadData() as Partial<TimeboxingSettings> | null;
		this.settings = Object.assign({}, DEFAULT_SETTINGS, data ?? {});
		this.settings.taskPresets = normalizeTaskPresets(this.settings.taskPresets);
	}

	async saveSettings(): Promise<void> {
		this.settings.taskPresets = normalizeTaskPresets(this.settings.taskPresets);
		await this.saveData(this.settings);
		this.pushSettingsToViews();
	}

	private handleMetadataChanged(file: TFile): void {
		if (!this.taskParser || this.getTimeboxingViews().length === 0) {
			return;
		}

		if (!this.sourceFilePath || file.path !== this.sourceFilePath) {
			return;
		}

		this.scheduleRefresh();
	}

	private scheduleRefresh(): void {
		if (this.refreshTimeoutId !== null) {
			window.clearTimeout(this.refreshTimeoutId);
		}

		this.refreshTimeoutId = window.setTimeout(() => {
			this.refreshTimeoutId = null;
			void this.refreshTasksForCurrentSource();
		}, REFRESH_DEBOUNCE_MS);
	}

	private async refreshTasksForCurrentSource(): Promise<void> {
		if (!this.taskParser) {
			return;
		}

		const sourceFile = await this.getSourceFile();
		if (!sourceFile) {
			this.latestTasks = [];
			this.pushTasksToViews();
			return;
		}

		this.latestTasks = await this.taskParser.getTasksForFile(sourceFile);
		this.pushTasksToViews();
	}

	private pushTasksToViews(): void {
		for (const view of this.getTimeboxingViews()) {
			view.setTasks(this.latestTasks);
		}
	}

	private pushSettingsToViews(): void {
		for (const view of this.getTimeboxingViews()) {
			view.setOptions(this.settings.timeStepMinutes, this.settings.taskPresets);
		}
	}

	private getTimeboxingViews(): TimeboxingView[] {
		return this.app.workspace
			.getLeavesOfType(VIEW_TYPE_TIMEBOXING)
			.map((leaf) => leaf.view)
			.filter((view): view is TimeboxingView => view instanceof TimeboxingView);
	}

	private openTaskCreationModal(startMinutes: number): void {
		new TaskCreationModal(this.app, {
			initialStartMinutes: startMinutes,
			initialEndMinutes: startMinutes + 60,
			presets: this.settings.taskPresets,
			mode: "create",
			onSubmit: async ({ taskName, startMinutes: start, endMinutes: end, color }): Promise<void> => {
				await this.createTaskInSourceFile(taskName, start, end, color);
			},
		}).open();
	}

	private openPresetTaskCreationModal(presetIndex: number): void {
		const preset = this.settings.taskPresets[presetIndex];
		if (!preset) {
			return;
		}

		const startMinutes = roundCurrentTimeToStep(this.settings.timeStepMinutes);
		new TaskCreationModal(this.app, {
			initialTaskName: preset.name,
			initialStartMinutes: startMinutes,
			initialEndMinutes: Math.min(startMinutes + 60, (23 * 60) + 59),
			initialColor: preset.color,
			presets: this.settings.taskPresets,
			mode: "create",
			onSubmit: async ({ taskName, startMinutes: start, endMinutes: end, color }): Promise<void> => {
				await this.createTaskInSourceFile(taskName, start, end, color);
			},
		}).open();
	}

	private openTaskEditModal(task: TaskBlock): void {
		new TaskCreationModal(this.app, {
			initialTaskName: task.label,
			initialStartMinutes: task.startMinutes,
			initialEndMinutes: task.endMinutes,
			initialColor: task.color,
			presets: this.settings.taskPresets,
			mode: "edit",
			onSubmit: async ({ taskName, startMinutes, endMinutes, color }): Promise<void> => {
				await this.updateTaskInSourceFile(task, taskName, startMinutes, endMinutes, color);
			},
		}).open();
	}

	private async createTaskInSourceFile(
		taskName: string,
		startMinutes: number,
		endMinutes: number,
		color: string,
	): Promise<void> {
		const taskLine = buildTaskLine(taskName, startMinutes, endMinutes, color, {
			checkState: " ",
			extraInlineFields: [],
			taskId: createTaskId(),
		});

		try {
			await this.runQueuedMutation(async (sourceFile) => {
				await this.app.vault.process(sourceFile, (content) => {
					const withoutTrailingNewlines = content.replace(/\n+$/u, "");
					if (withoutTrailingNewlines.length === 0) {
						return taskLine;
					}
					return `${withoutTrailingNewlines}\n${taskLine}`;
				});
			});
		} catch (error) {
			console.error("[timeboxing] Unable to create task in source file.", error);
			new Notice("Impossible d'ajouter la tâche");
			return;
		}

		await this.refreshTasksForCurrentSource();
	}

	private async updateTaskInSourceFile(
		originalTask: TaskBlock,
		taskName: string,
		startMinutes: number,
		endMinutes: number,
		color: string,
	): Promise<void> {
		const updatedLine = buildTaskLine(taskName, startMinutes, endMinutes, color, {
			checkState: originalTask.checkState,
			extraInlineFields: originalTask.extraInlineFields,
			taskId: originalTask.taskId ?? createTaskId(),
		});

		try {
			await this.runQueuedMutation(async (sourceFile) => {
				await this.app.vault.process(sourceFile, (content) => {
					const lines = content.split(/\r?\n/u);
					const targetIndex = findTaskLineIndex(lines, originalTask);

					if (targetIndex >= 0) {
						lines[targetIndex] = updatedLine;
						return lines.join("\n");
					}

					const withoutTrailingNewlines = content.replace(/\n+$/u, "");
					if (withoutTrailingNewlines.length === 0) {
						return updatedLine;
					}
					return `${withoutTrailingNewlines}\n${updatedLine}`;
				});
			});
		} catch (error) {
			console.error("[timeboxing] Unable to update task in source file.", error);
			new Notice("Impossible de modifier la tâche");
			return;
		}

		await this.refreshTasksForCurrentSource();
	}

	private async startTaskInSourceFile(task: TaskBlock): Promise<void> {
		const startedAt = formatStartedAt(new Date());
		const updatedLine = buildTaskLine(task.label, task.startMinutes, task.endMinutes, task.color, {
			checkState: "/",
			taskId: task.taskId ?? createTaskId(),
			extraInlineFields: upsertInlineField(task.extraInlineFields ?? [], "started_at", startedAt),
		});

		try {
			await this.runQueuedMutation(async (sourceFile) => {
				await this.app.vault.process(sourceFile, (content) => {
					const lines = content.split(/\r?\n/u);
					const targetIndex = findTaskLineIndex(lines, task);

					if (targetIndex >= 0) {
						lines[targetIndex] = updatedLine;
						return lines.join("\n");
					}

					const withoutTrailingNewlines = content.replace(/\n+$/u, "");
					if (withoutTrailingNewlines.length === 0) {
						return updatedLine;
					}
					return `${withoutTrailingNewlines}\n${updatedLine}`;
				});
			});
		} catch (error) {
			console.error("[timeboxing] Unable to start task in source file.", error);
			new Notice("Impossible de démarrer la tâche");
			return;
		}

		await this.refreshTasksForCurrentSource();
	}

	private async runQueuedMutation(mutation: (sourceFile: TFile) => Promise<void>): Promise<void> {
		const nextMutation = this.mutationQueue.then(async () => {
			const sourceFile = await this.getSourceFile();
			if (!sourceFile) {
				new Notice("Ouvrez une note pour ajouter une tâche");
				return;
			}

			await mutation(sourceFile);
		});

		this.mutationQueue = nextMutation.catch((error) => {
			console.error("[timeboxing] Queued mutation failed.", error);
		});

		await nextMutation;
	}

	private async getSourceFile(): Promise<TFile | null> {
		if (this.sourceFilePath) {
			const existingFile = this.app.vault.getAbstractFileByPath(this.sourceFilePath);
			if (existingFile instanceof TFile && existingFile.extension === "md") {
				return existingFile;
			}
			this.sourceFilePath = null;
		}

		if (this.taskParser) {
			const dailyFile = await this.taskParser.getOrCreateTodayDailyFile();
			this.sourceFilePath = dailyFile.path;
			return dailyFile;
		}

		return null;
	}
}

function roundCurrentTimeToStep(step: 15 | 30): number {
	const now = new Date();
	const totalMinutes = (now.getHours() * 60) + now.getMinutes();
	return Math.floor(totalMinutes / step) * step;
}
