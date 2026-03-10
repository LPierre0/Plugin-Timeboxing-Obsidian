import {
	appHasDailyNotesPluginLoaded,
	createDailyNote,
	getAllDailyNotes,
	getDailyNote,
	getDailyNoteSettings,
} from "obsidian-daily-notes-interface";
import { App, TFile, moment, normalizePath } from "obsidian";
import type { TaskBlock } from "../types";
import { parseTaskBlocksFromContent } from "./task-parser-core";

interface DailySettings {
	folder: string;
	format: string;
}

interface FileLike {
	path: string;
}

export class TaskParser {
	private readonly app: App;

	constructor(app: App) {
		this.app = app;
	}

	getTodayDailyPath(): string {
		const settings = this.getSafeDailySettings();
		const basename = moment().format(settings.format);
		const withExtension = basename.endsWith(".md") ? basename : `${basename}.md`;
		return settings.folder.length > 0
			? normalizePath(`${settings.folder}/${withExtension}`)
			: normalizePath(withExtension);
	}

	async getTodayTasks(): Promise<TaskBlock[]> {
		const dailyFile = await this.getOrCreateTodayDailyFile();
		return this.getTasksForFile(dailyFile);
	}

	async getTasksForFile(file: TFile): Promise<TaskBlock[]> {
		const content = await this.app.vault.read(file);
		return parseTaskBlocksFromContent(content);
	}

	async getOrCreateTodayDailyFile(): Promise<TFile> {
		const today = moment();
		let todayFile: TFile | null = null;

		try {
			const allDailyNotes = getAllDailyNotes();
			const resolvedDailyNote = getDailyNote(today, allDailyNotes) as FileLike | null;
			if (resolvedDailyNote?.path) {
				const candidate = this.app.vault.getAbstractFileByPath(resolvedDailyNote.path);
				if (candidate instanceof TFile) {
					todayFile = candidate;
				}
			}
		} catch (error) {
			console.debug("[timeboxing] Could not index daily notes, creating today's note.", error);
		}

		if (!todayFile) {
			const dailyPluginLoaded = appHasDailyNotesPluginLoaded();
			if (!dailyPluginLoaded) {
				console.debug("[timeboxing] Daily Notes plugin is not enabled; creating today's note anyway.");
			}
			const createdDailyNote = await createDailyNote(today) as FileLike | null;
			if (createdDailyNote?.path) {
				const candidate = this.app.vault.getAbstractFileByPath(createdDailyNote.path);
				if (candidate instanceof TFile) {
					todayFile = candidate;
				}
			}
		}

		if (!todayFile) {
			const fallbackPath = this.getTodayDailyPath();
			const existingFile = this.app.vault.getAbstractFileByPath(fallbackPath);
			if (existingFile instanceof TFile) {
				return existingFile;
			}
			return await this.app.vault.create(fallbackPath, "");
		}

		return todayFile;
	}

	private getSafeDailySettings(): DailySettings {
		const settings = getDailyNoteSettings();
		return {
			folder: settings?.folder?.trim() ?? "",
			format: settings?.format?.trim() || "YYYY-MM-DD",
		};
	}
}
