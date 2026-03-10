declare module "*.svelte" {
	import type { ComponentConstructorOptions, SvelteComponentTyped } from "svelte";

	export default class SvelteComponent<
		Props extends Record<string, unknown> = Record<string, unknown>,
		Events extends Record<string, unknown> = Record<string, unknown>,
		Slots extends Record<string, unknown> = Record<string, unknown>,
	> extends SvelteComponentTyped<Props, Events, Slots> {
		constructor(options: ComponentConstructorOptions<Props>);
	}
}
