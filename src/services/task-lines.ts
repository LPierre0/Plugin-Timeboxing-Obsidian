import type { TaskBlock } from "../types";
import { formatTimeLabel } from "./timebox-layout";

export interface BuildTaskLineOptions {
	checkState?: " " | "/";
	extraInlineFields?: string[];
	taskId?: string;
}

export function findTaskLineIndex(lines: string[], task: TaskBlock): number {
	if (task.taskId) {
		const byTaskId = lines.findIndex((line) => lineContainsTaskId(line, task.taskId ?? ""));
		if (byTaskId >= 0) {
			return byTaskId;
		}
	}

	if (task.rawLine) {
		const byRawLine = lines.findIndex((line) => line.trim() === task.rawLine?.trim());
		if (byRawLine >= 0) {
			return byRawLine;
		}
	}

	if (typeof task.lineNumber === "number" && task.lineNumber >= 0 && task.lineNumber < lines.length) {
		const candidate = lines[task.lineNumber];
		if (candidate && isSameTaskSignature(candidate, task)) {
			return task.lineNumber;
		}
	}

	return lines.findIndex((line) => isSameTaskSignature(line, task));
}

export function buildTaskLine(
	taskName: string,
	startMinutes: number,
	endMinutes: number,
	color: string | undefined,
	options: BuildTaskLineOptions,
): string {
	const start = formatTimeLabel(startMinutes);
	const end = formatTimeLabel(endMinutes);
	const normalizedTaskName = normalizeText(taskName);
	const colorInline = normalizeColor(color);
	const checkState = options.checkState === "/" ? "/" : " ";
	const taskId = sanitizeTaskId(options.taskId);
	const extraFields = sanitizeExtraInlineFields(options.extraInlineFields ?? []);

	const fields = [`[start:: ${start}]`, `[end:: ${end}]`];
	if (taskId) {
		fields.push(`[tbid:: ${taskId}]`);
	}
	if (colorInline) {
		fields.push(`[color:: ${colorInline}]`);
	}
	fields.push(...extraFields);

	return `- [${checkState}] ${normalizedTaskName} ${fields.join(" ")}`;
}

export function createTaskId(): string {
	if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
		return crypto.randomUUID().replace(/-/gu, "");
	}
	return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

export function formatStartedAt(date: Date): string {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	const hours = String(date.getHours()).padStart(2, "0");
	const minutes = String(date.getMinutes()).padStart(2, "0");
	return `${year}-${month}-${day} ${hours}:${minutes}`;
}

export function upsertInlineField(fields: string[], key: string, value: string): string[] {
	const normalizedKey = key.trim().toLowerCase();
	const cleanedValue = value.trim();
	if (normalizedKey.length === 0 || cleanedValue.length === 0) {
		return sanitizeExtraInlineFields(fields);
	}

	const safeKey = escapeRegex(normalizedKey);
	const keyRegex = new RegExp(`^\\[${safeKey}::`, "iu");
	const filteredFields = fields.filter((field) => !keyRegex.test(field.trim()));
	filteredFields.push(`[${normalizedKey}:: ${cleanedValue}]`);
	return sanitizeExtraInlineFields(filteredFields);
}

export function sanitizeTaskId(rawValue: string | undefined): string | null {
	if (!rawValue) {
		return null;
	}

	const normalized = rawValue.trim().toLowerCase();
	if (/^[a-z0-9-]{8,64}$/u.test(normalized)) {
		return normalized;
	}

	return null;
}

export function sanitizeExtraInlineFields(fields: string[]): string[] {
	const deduplicated = new Set<string>();
	for (const field of fields) {
		const normalized = field.trim();
		if (!/^\[[^\]]+::[^\]]+\]$/u.test(normalized)) {
			continue;
		}
		if (/^\[(?:start|end|color|tbid)::/iu.test(normalized)) {
			continue;
		}
		deduplicated.add(normalized);
	}
	return Array.from(deduplicated);
}

export function normalizeText(value: string): string {
	return value.replace(/\s+/g, " ").trim();
}

function isSameTaskSignature(line: string, task: TaskBlock): boolean {
	if (!/^\s*- \[[ /]\]\s+/u.test(line)) {
		return false;
	}

	const expectedStart = `[start:: ${formatTimeLabel(task.startMinutes)}]`;
	const expectedEnd = `[end:: ${formatTimeLabel(task.endMinutes)}]`;
	if (!line.includes(expectedStart) || !line.includes(expectedEnd)) {
		return false;
	}

	const normalizedLabel = normalizeTaskLabel(line);
	return normalizedLabel === normalizeText(task.label);
}

function normalizeTaskLabel(line: string): string {
	return normalizeText(
		line
			.replace(/^\s*- \[[ /]\]\s+/u, "")
			.replace(/\[[^\]]+::[^\]]+\]/gu, ""),
	);
}

function lineContainsTaskId(line: string, taskId: string): boolean {
	if (taskId.length === 0) {
		return false;
	}
	const escapedTaskId = escapeRegex(taskId);
	return new RegExp(`\\[tbid::\\s*${escapedTaskId}\\]`, "iu").test(line);
}

function normalizeColor(color: string | undefined): string | null {
	if (!color) {
		return null;
	}

	const normalized = color.trim();
	if (/^#[0-9a-fA-F]{6}$/u.test(normalized)) {
		return normalized;
	}

	return null;
}

function escapeRegex(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
