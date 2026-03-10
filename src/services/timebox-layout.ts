import type { PositionedTaskBlock, TaskBlock, TimeRow, TimeboxLayout } from "../types";

const BASE_START_MINUTES = 8 * 60;
const BASE_END_MINUTES = 22 * 60;
const DEFAULT_HOUR_HEIGHT_PX = 72;

interface WorkingTask {
	task: TaskBlock;
	columnIndex: number;
	clusterId: number;
}

export function buildTimeboxLayout(tasks: TaskBlock[], slotMinutes: 15 | 30): TimeboxLayout {
	const sanitizedTasks = tasks
		.filter((task) => Number.isFinite(task.startMinutes)
			&& Number.isFinite(task.endMinutes)
			&& task.endMinutes > task.startMinutes)
		.sort((a, b) => {
			if (a.startMinutes !== b.startMinutes) {
				return a.startMinutes - b.startMinutes;
			}
			return a.endMinutes - b.endMinutes;
		});

	const minTaskStart = sanitizedTasks.length > 0
		? Math.min(...sanitizedTasks.map((task) => task.startMinutes))
		: BASE_START_MINUTES;
	const maxTaskEnd = sanitizedTasks.length > 0
		? Math.max(...sanitizedTasks.map((task) => task.endMinutes))
		: BASE_END_MINUTES;

	const gridStartMinutes = alignMinutes(Math.min(BASE_START_MINUTES, minTaskStart), slotMinutes, "down");
	const gridEndMinutes = alignMinutes(Math.max(BASE_END_MINUTES, maxTaskEnd), slotMinutes, "up");
	const safeGridEnd = gridEndMinutes > gridStartMinutes
		? gridEndMinutes
		: gridStartMinutes + slotMinutes;

	const pixelsPerMinute = DEFAULT_HOUR_HEIGHT_PX / 60;
	const gridHeightPx = (safeGridEnd - gridStartMinutes) * pixelsPerMinute;
	const rows = buildRows(gridStartMinutes, safeGridEnd, slotMinutes, pixelsPerMinute);
	const positionedTasks = buildPositionedTasks(sanitizedTasks, gridStartMinutes, pixelsPerMinute);

	return {
		rows,
		positionedTasks,
		gridStartMinutes,
		gridEndMinutes: safeGridEnd,
		gridHeightPx,
		hourHeightPx: DEFAULT_HOUR_HEIGHT_PX,
		slotMinutes,
	};
}

function buildRows(
	gridStartMinutes: number,
	gridEndMinutes: number,
	slotMinutes: 15 | 30,
	pixelsPerMinute: number,
): TimeRow[] {
	const rows: TimeRow[] = [];
	for (let minutes = gridStartMinutes; minutes <= gridEndMinutes; minutes += slotMinutes) {
		const isHourMark = minutes % 60 === 0;
		rows.push({
			minutes,
			topPx: (minutes - gridStartMinutes) * pixelsPerMinute,
			label: isHourMark ? formatMinutes(minutes) : "",
			isHourMark,
		});
	}
	return rows;
}

function buildPositionedTasks(
	tasks: TaskBlock[],
	gridStartMinutes: number,
	pixelsPerMinute: number,
): PositionedTaskBlock[] {
	const workingTasks: WorkingTask[] = [];
	const clusterMaxColumns = new Map<number, number>();
	let activeTasks: WorkingTask[] = [];
	let currentClusterId = -1;

	for (const task of tasks) {
		activeTasks = activeTasks.filter((activeTask) => activeTask.task.endMinutes > task.startMinutes);
		if (activeTasks.length === 0) {
			currentClusterId += 1;
		}

		const usedColumns = new Set(activeTasks.map((activeTask) => activeTask.columnIndex));
		let columnIndex = 0;
		while (usedColumns.has(columnIndex)) {
			columnIndex += 1;
		}

		const workingTask: WorkingTask = {
			task,
			columnIndex,
			clusterId: currentClusterId,
		};

		activeTasks.push(workingTask);
		workingTasks.push(workingTask);

		const previousMax = clusterMaxColumns.get(currentClusterId) ?? 1;
		clusterMaxColumns.set(currentClusterId, Math.max(previousMax, activeTasks.length));
	}

	return workingTasks.map((workingTask) => {
		const durationMinutes = Math.max(workingTask.task.endMinutes - workingTask.task.startMinutes, 1);
		return {
			...workingTask.task,
			topPx: (workingTask.task.startMinutes - gridStartMinutes) * pixelsPerMinute,
			heightPx: durationMinutes * pixelsPerMinute,
			columnIndex: workingTask.columnIndex,
			columnCount: clusterMaxColumns.get(workingTask.clusterId) ?? 1,
		};
	});
}

function alignMinutes(value: number, step: number, mode: "down" | "up"): number {
	const ratio = value / step;
	return mode === "down" ? Math.floor(ratio) * step : Math.ceil(ratio) * step;
}

function formatMinutes(totalMinutes: number): string {
	const normalized = ((totalMinutes % (24 * 60)) + (24 * 60)) % (24 * 60);
	const hours = Math.floor(normalized / 60);
	const minutes = normalized % 60;
	return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function formatTimeLabel(totalMinutes: number): string {
	return formatMinutes(totalMinutes);
}
