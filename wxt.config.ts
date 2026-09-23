import { defineConfig } from "wxt";
export default defineConfig({
	modules: ["@wxt-dev/module-vue"],
	manifest: {
		name: "Dopakuj",
		description:
			"Znajduj produkty u sprzedawców, od których już kupujesz na Allegro.",
		version: "1.0.0",
		permissions: ["sidePanel", "storage", "tabs"],
		host_permissions: ["https://allegro.pl/*", "https://*.allegro.pl/*"],
		icons: {
			16: "icon/16.png",
			32: "icon/32.png",
			48: "icon/48.png",
			128: "icon/128.png",
		},
		action: {
			default_title: "Otwórz Dopakuj",
			default_icon: { 16: "icon/16.png", 24: "icon/24.png", 32: "icon/32.png" },
		},
		side_panel: { default_path: "sidepanel.html" },
	},
});
