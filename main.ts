import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, TFile } from 'obsidian';

// Remember to rename these classes and interfaces!

interface MyPluginSettings {
	metadataFeature: boolean;
	zoomRange: number;

}

const DEFAULT_SETTINGS: MyPluginSettings = {
	metadataFeature: true,
	zoomRange: 5,
}

export default class MyPlugin extends Plugin {
	settings: MyPluginSettings;
	originalMtimes: Map<string, number> = new Map();


	async onload() {
		await this.loadSettings();

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new SampleSettingTab(this.app, this));

		const win = (window as any).require('electron').remote.getCurrentWindow();

		const webFrame = (window as any).require('electron').webFrame;

		if (webFrame) {
			webFrame.setVisualZoomLevelLimits(1, this.settings.zoomRange);
		}


		// Clean up when plugin is disabled
        this.register(() => {
            if (webFrame) {
                webFrame.setVisualZoomLevelLimits(1, 1); // Reset to default
            }
        });


		// removes obsidian from changing the last modified date on just opening a file

		
		// Register event to capture original mtime when file is opened
        this.registerEvent(
            this.app.workspace.on('file-open', (file: TFile) => {
                if (file && this.settings.metadataFeature) {
                    this.originalMtimes.set(file.path, file.stat.mtime);
                }
            })
        );

        // Register event to check content changes before saving
        this.registerEvent(
            this.app.vault.on('modify', async (file: TFile) => {
                if (!this.settings.metadataFeature) return;

                const originalContent = await this.app.vault.read(file);
                const originalMtime = this.originalMtimes.get(file.path);

                if (originalMtime && file.stat.mtime !== originalMtime) {
                    // Only preserve mtime if content hasn't changed
                    const currentContent = await this.app.vault.read(file);
                    if (originalContent === currentContent) {
                        // Use Node.js fs to directly set mtime
						const fsPath = this.app.vault.adapter.getResourcePath(file.path);
                        await window.require('fs').promises.utimes(fsPath, new Date(), new Date(originalMtime));
                    }
                }
            })
        );
	}

	onunload() {

	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class SampleSettingTab extends PluginSettingTab {
	plugin: MyPlugin;

	constructor(app: App, plugin: MyPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('Metadata Feature')
			.setDesc('Enable the metadata feature')
			.addToggle(cb => cb
				.setValue(this.plugin.settings.metadataFeature)
				.onChange(async (value) => {
					this.plugin.settings.metadataFeature = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Maximum Zoom Level')
			.setDesc('Set the maximum zoom level (1-8)')
			.addSlider(slider => slider
				.setLimits(1, 8, 0.5)
				.setDynamicTooltip()
				.setValue(this.plugin.settings.zoomRange)
				.onChange(async (value) => {
					this.plugin.settings.zoomRange = value;
					const webFrame = (window as any).require('electron').webFrame;
					if (webFrame) {
						webFrame.setVisualZoomLevelLimits(1, value);
					}
				}));

	}
}
