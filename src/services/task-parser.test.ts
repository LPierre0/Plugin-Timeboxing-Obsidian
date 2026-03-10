import { describe, expect, it } from "vitest";
import { parseTaskBlocksFromContent } from "./task-parser-core";

describe("task-parser", () => {
	it("parses daily tasks with start/end, check state, color and task id", () => {
		const markdown = [
			"- [ ] Sport [start:: 09:00] [end:: 10:00] [color:: #34c759] [tbid:: abcd1234] [project:: Health]",
			"- [/] Focus [start:: 10:00] [end:: 11:30] [started_at:: 2026-03-10 10:01]",
			"- [ ] Missing end [start:: 11:00]",
			"- [ ] Invalid range [start:: 12:00] [end:: 11:59]",
		].join("\n");

		const tasks = parseTaskBlocksFromContent(markdown);

		expect(tasks).toHaveLength(2);
		expect(tasks[0]).toMatchObject({
			label: "Sport",
			startMinutes: 540,
			endMinutes: 600,
			checkState: " ",
			color: "#34c759",
			taskId: "abcd1234",
		});
		expect(tasks[0]?.extraInlineFields).toEqual(["[project:: Health]"]);
		expect(tasks[1]).toMatchObject({
			label: "Focus",
			startMinutes: 600,
			endMinutes: 690,
			checkState: "/",
		});
		expect(tasks[1]?.extraInlineFields).toEqual(["[started_at:: 2026-03-10 10:01]"]);
	});

	it("sorts by start then end minutes", () => {
		const markdown = [
			"- [ ] B [start:: 10:00] [end:: 11:00]",
			"- [ ] A [start:: 09:00] [end:: 10:00]",
			"- [ ] C [start:: 10:00] [end:: 10:30]",
		].join("\n");

		const tasks = parseTaskBlocksFromContent(markdown);
		expect(tasks.map((task) => task.label)).toEqual(["A", "C", "B"]);
	});
});
