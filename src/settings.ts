/* Pestaña de ajustes de Cool Bases: por ahora, la sección común «Cool Bar» (el diseño de cada vista se edita en su panel). */
import { PluginSettingTab } from "obsidian";
import { renderCoolBarSettings } from "./cool-kit/settings";

export class CoolBasesSettingTab extends PluginSettingTab {
  display(): void {
    this.containerEl.empty();
    renderCoolBarSettings(this.containerEl);
  }
}
