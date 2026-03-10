import { describe, expect, it } from "vitest";
import type { TaskBlock } from "../types";
import {
	buildTaskLine,
	createTaskId,
	findTaskLineIndex,
	upsertInlineField,
} from "./task-lines";

describe("task-lines", () => {
	it("builds a normalized line with id, color and clean extra fields", () => {
		const line = buildTaskLine("  Deep   Work  ", 9 * 60, 10 * 60, "#4f9cff", {
			checkState: "/",
			taskId: "abc12345",
			extraInlineFields: [
				"[project:: Build]",
				"[end:: 12:00]",
				"[project:: Build]",
				"invalid",
			],
		});

		expect(line).toBe("- [/] Deep Work [start:: 09:00] [end:: 10:00] [tbid:: abc12345] [color:: #4f9cff] [project:: Build]");
	});

	it("prefers tbid over raw signature when finding line index", () => {
		const lines = [
			"- [ ] Deep Work [start:: 09:00] [end:: 10:00] [tbid:: oldid123]",
			"- [ ] Deep Work [start:: 09:00] [end:: 10:00] [tbid:: newid456]",
		];

		const task: TaskBlock = {
			taskId: "newid456",
			label: "Deep Work",
			startMinutes: 9 * 60,
			endMinutes: 10 * 60,
		};

		expect(findTaskLineIndex(lines, task)).toBe(1);
	});

	it("upserts an inline field without duplicates", () => {
		const fields = ["[project:: Build]", "[started_at:: 2026-03-10 09:30]"];
		const updated = upsertInlineField(fields, "started_at", "2026-03-10 10:00");

		expect(updated).toEqual(["[project:: Build]", "[started_at:: 2026-03-10 10:00]"]);
	});

	it("generates compact ids for new tasks", () => {
		const taskId = createTaskId();
		expect(taskId).toMatch(/^[a-z0-9]{8,}$/u);
	});
});
