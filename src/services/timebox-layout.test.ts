import { describe, expect, it } from "vitest";
import type { TaskBlock } from "../types";
import { buildTimeboxLayout } from "./timebox-layout";

describe("timebox-layout", () => {
	it("extends grid bounds when tasks are outside 08:00-22:00", () => {
		const tasks: TaskBlock[] = [
			{ label: "Early", startMinutes: 6 * 60 + 30, endMinutes: 7 * 60 },
			{ label: "Late", startMinutes: 22 * 60 + 30, endMinutes: 23 * 60 + 15 },
		];

		const layout = buildTimeboxLayout(tasks, 30);

		expect(layout.gridStartMinutes).toBe(6 * 60 + 30);
		expect(layout.gridEndMinutes).toBe(23 * 60 + 30);
		expect(layout.rows.length).toBeGreaterThan(0);
	});

	it("assigns columns to overlapping tasks", () => {
		const tasks: TaskBlock[] = [
			{ label: "A", startMinutes: 9 * 60, endMinutes: 11 * 60 },
			{ label: "B", startMinutes: 10 * 60, endMinutes: 12 * 60 },
			{ label: "C", startMinutes: 10 * 60 + 30, endMinutes: 10 * 60 + 45 },
		];

		const layout = buildTimeboxLayout(tasks, 30);
		const positionedByLabel = new Map(layout.positionedTasks.map((task) => [task.label, task]));

		expect(positionedByLabel.get("A")?.columnCount).toBe(3);
		expect(positionedByLabel.get("B")?.columnCount).toBe(3);
		expect(positionedByLabel.get("C")?.columnCount).toBe(3);

		const a = positionedByLabel.get("A");
		const b = positionedByLabel.get("B");
		const c = positionedByLabel.get("C");
		expect(a?.columnIndex).not.toBe(b?.columnIndex);
		expect(b?.columnIndex).not.toBe(c?.columnIndex);
		expect(a?.columnIndex).not.toBe(c?.columnIndex);
	});

	it("converts minutes to pixel top and height", () => {
		const tasks: TaskBlock[] = [{ label: "Focus", startMinutes: 9 * 60, endMinutes: 10 * 60 }];
		const layout = buildTimeboxLayout(tasks, 30);
		const positioned = layout.positionedTasks[0];

		expect(layout.gridStartMinutes).toBe(8 * 60);
		expect(positioned?.topPx).toBe(72);
		expect(positioned?.heightPx).toBe(72);
	});
});
