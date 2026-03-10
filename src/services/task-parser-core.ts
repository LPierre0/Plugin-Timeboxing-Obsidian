import type { TaskBlock } from "../types";

const TASK_LINE_REGEX = /^\s*- \[([ /])\]\s+/;
const START_INLINE_REGEX = /\[start::\s*([01]?\d|2[0-3]):([0-5]\d)\]/i;
const END_INLINE_REGEX = /\[end::\s*([01]?\d|2[0-3]):([0-5]\d)\]/i;
const COLOR_INLINE_REGEX = /\[color::\s*([^\]]+)\]/i;
const TASK_ID_INLINE_REGEX = /\[tbid::\s*([a-z0-9-]{8,64})\]/i;
const ANY_INLINE_FIELD_REGEX = /\[[^\]]+::[^\]]+\]/gi;

export function parseTaskBlocksFromContent(content: string): TaskBlock[] {
	const tasks: TaskBlock[] = [];
	const lines = content.split(/\r?\n/);

	for (const [lineNumber, rawLine] of lines.entries()) {
		const taskLineMatch = rawLine.match(TASK_LINE_REGEX);
		if (!taskLineMatch) {
			continue;
		}
		const checkState = taskLineMatch[1] === "/" ? "/" : " ";

		const startMatch = rawLine.match(START_INLINE_REGEX);
		const endMatch = rawLine.match(END_INLINE_REGEX);
		if (!startMatch || !endMatch) {
			continue;
		}

		const startHour = startMatch[1];
		const startMinute = startMatch[2];
		const endHour = endMatch[1];
		const endMinute = endMatch[2];
		if (!startHour || !startMinute || !endHour || !endMinute) {
			continue;
		}

		const startMinutes = parseHoursToMinutes(startHour, startMinute);
		const endMinutes = parseHoursToMinutes(endHour, endMinute);
		if (endMinutes <= startMinutes) {
			continue;
		}

		const colorMatch = rawLine.match(COLOR_INLINE_REGEX);
		const color = sanitizeColor(colorMatch?.[1]);
		const taskIdMatch = rawLine.match(TASK_ID_INLINE_REGEX);
		const taskId = sanitizeTaskId(taskIdMatch?.[1]);
		const extraInlineFields = (rawLine.match(ANY_INLINE_FIELD_REGEX) ?? []).filter((field) => !/^\[(?:start|end|color|tbid)::/iu.test(field));

		const label = rawLine
			.replace(TASK_LINE_REGEX, "")
			.replace(ANY_INLINE_FIELD_REGEX, "")
			.replace(/\s+/g, " ")
			.trim();

		tasks.push({
			taskId: taskId ?? undefined,
			label: label.length > 0 ? label : "Untitled task",
			startMinutes,
			endMinutes,
			lineNumber,
			color,
			checkState,
			rawLine,
			extraInlineFields,
		});
	}

	return tasks.sort((a, b) => {
		if (a.startMinutes !== b.startMinutes) {
			return a.startMinutes - b.startMinutes;
		}
		if (a.endMinutes !== b.endMinutes) {
			return a.endMinutes - b.endMinutes;
		}
		return (a.lineNumber ?? 0) - (b.lineNumber ?? 0);
	});
}

function parseHoursToMinutes(hourRaw: string, minuteRaw: string): number {
	const hour = Number.parseInt(hourRaw, 10);
	const minute = Number.parseInt(minuteRaw, 10);
	return (hour * 60) + minute;
}

function sanitizeColor(rawColor: string | undefined): string | undefined {
	if (!rawColor) {
		return undefined;
	}

	const normalized = rawColor.trim();
	if (/^#[0-9a-fA-F]{6}$/u.test(normalized)) {
		return normalized;
	}

	return undefined;
}

function sanitizeTaskId(rawValue: string | undefined): string | undefined {
	if (!rawValue) {
		return undefined;
	}

	const normalized = rawValue.trim().toLowerCase();
	if (/^[a-z0-9-]{8,64}$/u.test(normalized)) {
		return normalized;
	}

	return undefined;
}
