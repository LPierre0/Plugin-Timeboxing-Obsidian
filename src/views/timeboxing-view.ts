import { ItemView, WorkspaceLeaf, setIcon } from "obsidian";
import type { TaskPreset } from "../settings";
import { buildTimeboxLayout, formatTimeLabel } from "../services/timebox-layout";
import type { PositionedTaskBlock, TaskBlock, TimeRow } from "../types";
import TimeboxingViewComponent from "./timeboxing-view.svelte";

export const VIEW_TYPE_TIMEBOXING = "timeboxing-view";

const COMPACT_MODE_BREAKPOINT_PX = 520;
const NOW_NEXT_REFRESH_INTERVAL_MS = 30_000;

interface TimeboxingViewProps {
	rows: TimeRow[];
	positionedTasks: PositionedTaskBlock[];
	gridHeightPx: number;
	hourHeightPx: number;
	slotMinutes: 15 | 30;
	nowIndicatorTopPx: number | null;
	compactMode: boolean;
	currentTimeLabel: string;
	nowTask: TaskBlock | null;
	nextTask: TaskBlock | null;
	nowTaskIndex: number | null;
	nextTaskIndex: number | null;
	quickPresets: Array<TaskPreset & { index: number }>;
}

interface TimeboxingViewComponentHandle {
	$destroy: () => void;
	$set: (props: TimeboxingViewProps) => void;
}

interface TimeboxingViewCallbacks {
	onTimeSlotClick?: (startMinutes: number) => void;
	onTaskBlockClick?: (task: TaskBlock) => void;
	onPresetClick?: (presetIndex: number) => void;
	onTaskStartClick?: (task: TaskBlock) => void;
}

export class TimeboxingView extends ItemView {
	private slotMinutes: 15 | 30;
	private quickPresets: TaskPreset[];
	private readonly callbacks: TimeboxingViewCallbacks;
	private tasks: TaskBlock[];
	private component: TimeboxingViewComponentHandle | null = null;
	private clickBound = false;
	private compactMode = false;

	constructor(
		leaf: WorkspaceLeaf,
		slotMinutes: 15 | 30,
		initialTasks: TaskBlock[] = [],
		quickPresets: TaskPreset[] = [],
		callbacks: TimeboxingViewCallbacks = {},
	) {
		super(leaf);
		this.slotMinutes = slotMinutes;
		this.quickPresets = [...quickPresets];
		this.tasks = [...initialTasks];
		this.callbacks = callbacks;
	}

	getViewType(): string {
		return VIEW_TYPE_TIMEBOXING;
	}

	getDisplayText(): string {
		return "Timebox";
	}

	getIcon(): string {
		return "calendar";
	}

	async onOpen(): Promise<void> {
		this.updateCompactMode();
		this.mountOrUpdateComponent();
		this.bindClickListener();

		this.registerInterval(window.setInterval(() => {
			if (!this.component) {
				return;
			}
			this.mountOrUpdateComponent();
		}, NOW_NEXT_REFRESH_INTERVAL_MS));
	}

	onResize(): void {
		this.updateCompactMode();
		if (this.component) {
			this.mountOrUpdateComponent();
		}
	}

	async onClose(): Promise<void> {
		this.component?.$destroy();
		this.component = null;
		this.clickBound = false;
		this.contentEl.empty();
	}

	setTasks(tasks: TaskBlock[]): void {
		this.tasks = [...tasks];
		if (this.component) {
			this.mountOrUpdateComponent();
		}
	}

	setOptions(slotMinutes: 15 | 30, quickPresets: TaskPreset[]): void {
		this.slotMinutes = slotMinutes;
		this.quickPresets = [...quickPresets];
		if (this.component) {
			this.mountOrUpdateComponent();
		}
	}

	private mountOrUpdateComponent(): void {
		const layout = buildTimeboxLayout(this.tasks, this.slotMinutes);
		const currentMinutes = getCurrentMinutes();
		const { nowTask, nextTask } = getNowAndNextTasks(this.tasks, currentMinutes);
		const nowTaskIndex = nowTask ? this.tasks.indexOf(nowTask) : -1;
		const nextTaskIndex = nextTask ? this.tasks.indexOf(nextTask) : -1;
		const pixelsPerMinute = layout.hourHeightPx / 60;
		const nowIndicatorTopPx = currentMinutes >= layout.gridStartMinutes && currentMinutes <= layout.gridEndMinutes
			? (currentMinutes - layout.gridStartMinutes) * pixelsPerMinute
			: null;

		const props: TimeboxingViewProps = {
			rows: layout.rows,
			positionedTasks: layout.positionedTasks,
			gridHeightPx: layout.gridHeightPx,
			hourHeightPx: layout.hourHeightPx,
			slotMinutes: layout.slotMinutes,
			nowIndicatorTopPx,
			compactMode: this.compactMode,
			currentTimeLabel: formatTimeLabel(currentMinutes),
			nowTask,
			nextTask,
			nowTaskIndex: nowTaskIndex >= 0 ? nowTaskIndex : null,
			nextTaskIndex: nextTaskIndex >= 0 ? nextTaskIndex : null,
			quickPresets: this.quickPresets.map((preset, index) => ({ ...preset, index })),
		};

		if (!this.component) {
			this.contentEl.empty();
			this.component = new TimeboxingViewComponent({
				target: this.contentEl,
				props,
			}) as unknown as TimeboxingViewComponentHandle;
			this.applyIcons();
			return;
		}

		this.component.$set(props);
		this.applyIcons();
	}

	private updateCompactMode(): void {
		const width = this.contentEl.clientWidth;
		this.compactMode = width > 0 && width <= COMPACT_MODE_BREAKPOINT_PX;
	}

	private bindClickListener(): void {
		if (this.clickBound) {
			return;
		}

		this.clickBound = true;
		this.registerDomEvent(this.contentEl, "click", (event: MouseEvent) => {
			const target = event.target;
			if (!(target instanceof HTMLElement)) {
				return;
			}

			const startTaskEl = target.closest(".timeboxing-compact-start-btn");
			if (startTaskEl instanceof HTMLElement) {
				const indexRaw = startTaskEl.getAttribute("data-task-index");
				if (!indexRaw) {
					return;
				}

				const index = Number.parseInt(indexRaw, 10);
				if (Number.isNaN(index) || index < 0 || index >= this.tasks.length) {
					return;
				}

				const selectedTask = this.tasks[index];
				if (!selectedTask) {
					return;
				}

				this.callbacks.onTaskStartClick?.(selectedTask);
				return;
			}

			const presetEl = target.closest(".timeboxing-compact-preset-btn");
			if (presetEl instanceof HTMLElement) {
				const indexRaw = presetEl.getAttribute("data-preset-index");
				if (!indexRaw) {
					return;
				}

				const presetIndex = Number.parseInt(indexRaw, 10);
				if (Number.isNaN(presetIndex) || presetIndex < 0) {
					return;
				}

				this.callbacks.onPresetClick?.(presetIndex);
				return;
			}

			const taskEl = target.closest(".timeboxing-task-block");
			if (taskEl instanceof HTMLElement) {
				const indexRaw = taskEl.getAttribute("data-task-index");
				if (!indexRaw) {
					return;
				}

				const index = Number.parseInt(indexRaw, 10);
				if (Number.isNaN(index) || index < 0 || index >= this.tasks.length) {
					return;
				}

				const selectedTask = this.tasks[index];
				if (!selectedTask) {
					return;
				}

				this.callbacks.onTaskBlockClick?.(selectedTask);
				return;
			}

			const slotEl = target.closest(".time-slot");
			if (!(slotEl instanceof HTMLElement)) {
				return;
			}

			const timeValue = slotEl.getAttribute("data-time");
			if (!timeValue) {
				return;
			}

			const parsedMinutes = parseTimeSlotToMinutes(timeValue);
			if (parsedMinutes === null) {
				return;
			}

			this.callbacks.onTimeSlotClick?.(parsedMinutes);
		});
	}

	private applyIcons(): void {
		const iconNodes = this.contentEl.querySelectorAll("[data-timeboxing-icon]");
		for (let index = 0; index < iconNodes.length; index += 1) {
			const node = iconNodes.item(index);
			if (!(node instanceof HTMLElement)) {
				continue;
			}

			const iconName = node.getAttribute("data-timeboxing-icon");
			if (!iconName) {
				continue;
			}

			setIcon(node, iconName);
		}
	}
}

function parseTimeSlotToMinutes(timeValue: string): number | null {
	const match = /^([01]?\d|2[0-3]):([0-5]\d)$/u.exec(timeValue.trim());
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

function getCurrentMinutes(): number {
	const now = new Date();
	return (now.getHours() * 60) + now.getMinutes();
}

function getNowAndNextTasks(tasks: TaskBlock[], currentMinutes: number): { nowTask: TaskBlock | null; nextTask: TaskBlock | null } {
	const sortedTasks = [...tasks].sort((a, b) => {
		if (a.startMinutes !== b.startMinutes) {
			return a.startMinutes - b.startMinutes;
		}
		return a.endMinutes - b.endMinutes;
	});

	const nowTask = sortedTasks.find((task) => task.startMinutes <= currentMinutes && currentMinutes < task.endMinutes) ?? null;
	const nextTask = sortedTasks.find((task) => task.startMinutes > currentMinutes) ?? null;

	return { nowTask, nextTask };
}
