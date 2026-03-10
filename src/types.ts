export interface TaskBlock {
	taskId?: string;
	label: string;
	startMinutes: number;
	endMinutes: number;
	lineNumber?: number;
	color?: string;
	checkState?: " " | "/";
	rawLine?: string;
	extraInlineFields?: string[];
}

export interface PositionedTaskBlock extends TaskBlock {
	topPx: number;
	heightPx: number;
	columnIndex: number;
	columnCount: number;
}

export interface TimeRow {
	minutes: number;
	topPx: number;
	label: string;
	isHourMark: boolean;
}

export interface TimeboxLayout {
	rows: TimeRow[];
	positionedTasks: PositionedTaskBlock[];
	gridStartMinutes: number;
	gridEndMinutes: number;
	gridHeightPx: number;
	hourHeightPx: number;
	slotMinutes: 15 | 30;
}
