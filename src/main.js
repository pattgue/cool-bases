/* Cool Bases — tipo de vista de Bases con tarjetas cuyo estilo se edita en un panel propio («✎ Editar tarjeta»). */
import { Plugin } from "obsidian";
import { CoolBasesView, VIEW, CLOSE_PANELS } from "./view.js";
import { clone } from "./util.js";

export default class CoolBasesPlugin extends Plugin {
  async onload() {
    this.store = Object.assign({ styles: [] }, await this.loadData());
    this.registerBasesView(VIEW, {
      name: "Cool Bases",
      icon: "lucide-id-card",
      factory: (controller, containerEl) => new CoolBasesView(controller, containerEl, this),
      options: () => [],          // todo se edita en el panel
    });
  }
  onunload() { this.app.workspace.trigger(CLOSE_PANELS, null); }

  /* «Mis estilos» (por vault, en los datos del plugin) */
  getStyles() { return this.store.styles || []; }
  saveStyle(name, style) {
    const list = this.getStyles();
    const i = list.findIndex(m => m.name === name), item = { name, s: clone(style) };
    i >= 0 ? list.splice(i, 1, item) : list.push(item);
    this.store.styles = list;
    void this.saveData(this.store);
  }
}
