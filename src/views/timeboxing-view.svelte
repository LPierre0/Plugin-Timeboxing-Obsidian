<script>
	import { formatTimeLabel } from "../services/timebox-layout";

	export let rows = [];
	export let positionedTasks = [];
	export let gridHeightPx = 0;
	export let hourHeightPx = 72;
	export let slotMinutes = 30;
	export let nowIndicatorTopPx = null;
	export let compactMode = false;
	export let currentTimeLabel = "";
	export let nowTask = null;
	export let nextTask = null;
	export let nowTaskIndex = null;
	export let nextTaskIndex = null;
	export let quickPresets = [];

	$: rowHeightPx = (slotMinutes / 60) * hourHeightPx;

	function getTaskStyle(task) {
		const widthPercent = 100 / task.columnCount;
		const leftPercent = task.columnIndex * widthPercent;
		const bgColor = task.color ?? "var(--interactive-accent)";
		const textColor = getTaskTextColor(bgColor);
		return [
			`top: ${task.topPx}px`,
			`height: ${task.heightPx}px`,
			`left: calc(${leftPercent}% + 2px)`,
			`width: calc(${widthPercent}% - 4px)`,
			`background-color: ${bgColor}`,
			`color: ${textColor}`,
		].join(";");
	}

	function formatTaskRange(task) {
		if (!task) {
			return "";
		}
		return `${formatTimeLabel(task.startMinutes)} - ${formatTimeLabel(task.endMinutes)}`;
	}

	function getTaskTextColor(backgroundColor) {
		if (typeof backgroundColor !== "string") {
			return "var(--text-on-accent)";
		}

		const match = /^#([0-9a-fA-F]{6})$/u.exec(backgroundColor.trim());
		if (!match || !match[1]) {
			return "var(--text-on-accent)";
		}

		const hex = match[1];
		const red = Number.parseInt(hex.slice(0, 2), 16);
		const green = Number.parseInt(hex.slice(2, 4), 16);
		const blue = Number.parseInt(hex.slice(4, 6), 16);
		const luminance = ((0.2126 * red) + (0.7152 * green) + (0.0722 * blue)) / 255;

		return luminance > 0.62 ? "#101010" : "#ffffff";
	}
</script>

<div class="timeboxing-view">
	{#if compactMode}
		<div class="timeboxing-compact">
			<div class="timeboxing-compact-now">Now: {currentTimeLabel}</div>

			<div class="timeboxing-compact-card">
				<div class="timeboxing-compact-card-title">Now</div>
				{#if nowTask}
					<div class="timeboxing-compact-task-name">{nowTask.label}</div>
					<div class="timeboxing-compact-task-time">{formatTaskRange(nowTask)}</div>
					{#if nowTask.checkState === "/"}
						<div class="timeboxing-compact-running">Running</div>
						{:else if nowTaskIndex !== null}
							<button class="timeboxing-compact-start-btn" data-task-index={nowTaskIndex}>
								<span class="timeboxing-inline-icon" data-timeboxing-icon="play"></span>
								<span>Start</span>
							</button>
						{/if}
				{:else}
					<div class="timeboxing-compact-empty">No task running</div>
				{/if}
			</div>

			<div class="timeboxing-compact-card">
				<div class="timeboxing-compact-card-title">Next</div>
				{#if nextTask}
					<div class="timeboxing-compact-task-name">{nextTask.label}</div>
					<div class="timeboxing-compact-task-time">{formatTaskRange(nextTask)}</div>
						{#if nextTaskIndex !== null}
							<button class="timeboxing-compact-start-btn" data-task-index={nextTaskIndex}>
								<span class="timeboxing-inline-icon" data-timeboxing-icon="play"></span>
								<span>Start</span>
							</button>
						{/if}
				{:else}
					<div class="timeboxing-compact-empty">No upcoming task</div>
				{/if}
			</div>

			{#if quickPresets.length > 0}
				<div class="timeboxing-compact-card">
					<div class="timeboxing-compact-card-title">Quick add preset</div>
					<div class="timeboxing-compact-preset-list">
						{#each quickPresets as preset (`${preset.name}-${preset.index}`)}
							<button
								class="timeboxing-compact-preset-btn"
								data-preset-index={preset.index}
								style={`border-color: ${preset.color}; color: ${preset.color};`}
							>
								{preset.name}
							</button>
						{/each}
					</div>
				</div>
			{/if}
		</div>
	{:else}
		<div
			class="timeboxing-canvas"
			style={`--timeboxing-grid-height: ${gridHeightPx}px; --timeboxing-row-height: ${rowHeightPx}px;`}
		>
			<div class="timeboxing-grid" role="presentation">
				{#each rows as row (row.minutes)}
					<div
						class="timeboxing-row-mark time-slot"
						class:is-hour-mark={row.isHourMark}
						data-time={formatTimeLabel(row.minutes)}
						style={`top: ${row.topPx}px;`}
					>
						<div class="timeboxing-label">{row.label}</div>
						<div class="timeboxing-line"></div>
					</div>
				{/each}
			</div>

			{#if nowIndicatorTopPx !== null}
				<div class="timeboxing-now-line" style={`top: ${nowIndicatorTopPx}px;`}>
					<div class="timeboxing-now-dot"></div>
				</div>
			{/if}

			<div class="timeboxing-task-layer">
				{#each positionedTasks as task, index (`${task.label}-${task.startMinutes}-${task.endMinutes}-${index}`)}
					<div class="timeboxing-task-block" data-task-index={index} style={getTaskStyle(task)}>
						<div class="timeboxing-task-title">{task.label}</div>
						<div class="timeboxing-task-time">{formatTimeLabel(task.startMinutes)} - {formatTimeLabel(task.endMinutes)}</div>
					</div>
				{/each}
			</div>
		</div>
	{/if}
</div>
