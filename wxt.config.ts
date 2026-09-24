import { defineConfig } from "wxt";

const PANEL_PATH = "sidepanel.html";
const ACTION_TITLE = "Otwórz Dopakuj";

type OperaManifest = chrome.runtime.ManifestV3 & {
	side_panel?: { default_path: string };
	sidebar_action?: {
		default_icon: Record<string, string>;
		default_title: string;
		default_panel: string;
	};
};

export default defineConfig({
	modules: ["@wxt-dev/module-vue"],
	targetBrowsers: ["chrome", "opera"],
	manifest: ({ browser }) => ({
		name: "Dopakuj",
		description:
			"Znajduj produkty u sprzedawców, od których już kupujesz na Allegro.",
		version: "1.0.0",
		permissions: ["storage", "tabs"],
		host_permissions: ["https://allegro.pl/*", "https://*.allegro.pl/*"],
		icons: {
			16: "icon/16.png",
			32: "icon/32.png",
			48: "icon/48.png",
			128: "icon/128.png",
		},
		action: browser === "opera" ? undefined : {
			default_title: ACTION_TITLE,
			default_icon: { 16: "icon/16.png", 24: "icon/24.png", 32: "icon/32.png" },
		},
	}),
	hooks: {
		"build:manifestGenerated": (wxt, manifest) => {
			if (wxt.config.browser !== "opera") return;

			const operaManifest = manifest as OperaManifest;
			delete operaManifest.side_panel;
			operaManifest.permissions = operaManifest.permissions?.filter(
				(permission) => permission !== "sidePanel",
			);
			operaManifest.sidebar_action = {
				default_icon: {
					16: "icon/16.png",
					24: "icon/24.png",
					32: "icon/32.png",
				},
				default_title: ACTION_TITLE,
				default_panel: PANEL_PATH,
			};
		},
	},
});
