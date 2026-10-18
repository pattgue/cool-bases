/* Cool Bases — tipo de vista de Bases con tarjetas cuyo estilo se edita en un panel propio («✎ Editar tarjeta»). */
import { Plugin } from "obsidian";
import { CoolBasesView, VIEW, CLOSE_PANELS } from "./view";
import { clone } from "./util";
import type { Style } from "./types";

export interface SavedStyle { name: string; s: Style }
interface PluginData { styles: SavedStyle[] }

export default class CoolBasesPlugin extends Plugin {
  store: PluginData = { styles: [] };

  async onload() {
    this.store = Object.assign({ styles: [] }, await this.loadData() as Partial<PluginData> | null);
    this.registerBasesView(VIEW, {
      name: "Cool Bases",
      icon: "lucide-id-card",
      factory: (controller, containerEl) => new CoolBasesView(controller, containerEl, this),
      options: () => [],          // todo se edita en el panel
    });
  }
  onunload() { this.app.workspace.trigger(CLOSE_PANELS, null); }

  /* «Mis estilos» (por vault, en los datos del plugin) */
  getStyles(): SavedStyle[] { return this.store.styles || []; }
  saveStyle(name: string, style: Style) {
    const list = this.getStyles();
    const i = list.findIndex(m => m.name === name), item = { name, s: clone(style) };
    i >= 0 ? list.splice(i, 1, item) : list.push(item);
    this.store.styles = list;
    void this.saveData(this.store);
  }
}
