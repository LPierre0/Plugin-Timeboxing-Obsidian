import TimeboxingPlugin from "../main";

export function registerCommands(plugin: TimeboxingPlugin): void {
	plugin.addCommand({
		id: "open-timebox",
		// eslint-disable-next-line obsidianmd/ui/sentence-case
		name: "Open Timebox",
		callback: () => {
			void plugin.openTimeboxView();
		},
	});

	plugin.addCommand({
		id: "open-timebox-right-sidebar",
		name: "Open timebox in right sidebar",
		callback: () => {
			void plugin.openTimeboxInRightSidebar();
		},
	});
}
