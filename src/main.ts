/* Cool Bases — tipo de vista de Bases con tarjetas cuyo estilo se edita en un panel propio (botón COOL BASES de la Cool Bar). */
import { Plugin } from "obsidian";
import type { WorkspaceLeaf } from "obsidian";
import { CoolBasesView, VIEW, CLOSE_PANELS } from "./view";
import { clone } from "./util";
import { t } from "./i18n";
import { joinCoolKit } from "./cool-kit/kit";
import type { BarSettings, CoolKitHandle } from "./cool-kit/kit";
import type { Style } from "./types";

export interface SavedStyle { name: string; s: Style }
interface PluginData { styles: SavedStyle[]; coolBar?: BarSettings }

export default class CoolBasesPlugin extends Plugin {
  store: PluginData = { styles: [] };
  views = new Set<CoolBasesView>();                   // las vistas Cool Bases vivas
  bar: CoolKitHandle | null = null;

  async onload() {
    this.store = Object.assign({ styles: [] }, await this.loadData() as Partial<PluginData> | null);
    this.registerBasesView(VIEW, {
      name: "Cool Bases",
      icon: "lucide-id-card",
      factory: (controller, containerEl) => new CoolBasesView(controller, containerEl, this),
      options: () => [],          // todo se edita en el panel
    });
    /* el botón COOL BASES de la Cool Bar */
    this.bar = joinCoolKit(this, {
      id: this.manifest.id,
      label: () => "Cool Bases",
      icon: "lucide-id-card",
      order: 40,
      appliesTo: leaf => !!this.viewIn(leaf),
      isOpen: leaf => !!this.viewIn(leaf)?.panel,
      toggle: leaf => this.viewIn(leaf)?.editCard(),
      saveShared: async data => { this.store.coolBar = data; await this.saveData(this.store); },
      loadShared: async () => this.store.coolBar,
    });
    this.addCommand({
      id: "edit-card",
      name: t("cmd.edit"),
      checkCallback: checking => {
        const view = this.viewIn(this.app.workspace.getMostRecentLeaf());
        if (!view) return false;
        if (!checking) view.editCard();
        return true;
      },
    });
  }
  onunload() { this.app.workspace.trigger(CLOSE_PANELS, null); }

  /* la vista Cool Bases que se ve en una pestaña (si la base muestra otra vista, ninguna) */
  viewIn(leaf: WorkspaceLeaf | null | undefined): CoolBasesView | null {
    const host = leaf?.view?.containerEl;
    if (!host) return null;
    for (const v of this.views) if (v.scrollEl.isConnected && host.contains(v.scrollEl)) return v;
    return null;
  }
  refreshBar() { this.bar?.refresh(); }

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
