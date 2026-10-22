/* Cool Kit: la barra común de los plugins «Cool» (Cool Bar). Esta carpeta se copia tal cual en cada plugin (ver README.md).
   - Cada plugin se apunta con joinCoolKit(plugin, herramienta): un botón suyo en la barra.
   - Todos comparten un registro global (window.__coolKit). Solo pinta las barras el «líder»: el kit con la versión más nueva
     (si empatan, el id de plugin alfabéticamente primero). Si el líder se descarga, otro toma el relevo y las vuelve a pintar.
   - El registro solo crece: PROTOCOL fija su forma; se le pueden añadir cosas, nunca cambiar ni quitar. */
import { Component, Platform, setIcon } from "obsidian";
import type { Plugin, WorkspaceLeaf } from "obsidian";
import { kt } from "./i18n";

export const KIT_VERSION = 1;           // sube con cada cambio del kit
export const PROTOCOL = 1;

/* lo que registra cada plugin: su botón */
export interface CoolTool {
  id: string;                                       // el id del plugin, p. ej. "cool-bases"
  label: () => string;                              // «COOL BASES»
  icon?: string;                                    // icono Lucide, para los modos compactos
  order?: number;                                   // orden por defecto
  appliesTo(leaf: WorkspaceLeaf): boolean;          // ¿aplica a esta pestaña? (si no: Bloqueado)
  isOpen(leaf: WorkspaceLeaf): boolean;             // ¿su panel está abierto aquí? (Activo)
  toggle(leaf: WorkspaceLeaf, anchor: HTMLElement): void;
  afterPaint?(): void;                              // tras pintar las barras (para recolocar un panel que cuelga de su botón)
  saveShared?(data: BarSettings): Promise<void>;    // ajustes de la barra, compartidos por todos los plugins Cool
  loadShared?(): Promise<BarSettings | null | undefined>;
}

/* ajustes de la barra (iguales en todos los plugins; gana la copia más reciente) */
export type BarLocation = "top" | "bottom" | "float";
export type BarAlign = "left" | "center" | "right";
export type BarMode = "fixed" | "context" | "hidden";
export type ToolVisibility = "always" | "applies" | "never";
export interface BarPrefs {
  location: BarLocation; align: BarAlign; mode: BarMode; collapsed: boolean;
  tools: Record<string, { visibility?: ToolVisibility; order?: number }>;
}
export interface BarSettings { v: 1; updatedAt: number; desktop: BarPrefs; phone: BarPrefs }

interface KitEntry { version: number; start(): void; stop(): void; refresh(): void }
interface Registry {
  protocol: number;
  kits: Record<string, KitEntry>;
  tools: Record<string, CoolTool>;
  leader: string | null;
  settings: BarSettings | null;
  toggled: boolean;                                 // el comando «Mostrar u ocultar»: enseña la escondida, esconde las demás
  refresh(): void;
}

const basePrefs = (): BarPrefs => ({ location: "top", align: "right", mode: "fixed", collapsed: false, tools: {} });
export const defaultSettings = (): BarSettings => ({ v: 1, updatedAt: 0, desktop: basePrefs(), phone: basePrefs() });
function normSettings(s: Partial<BarSettings> | null | undefined): BarSettings {
  const d = defaultSettings();
  if (!s || typeof s !== "object") return d;
  return { v: 1, updatedAt: Number(s.updatedAt) || 0,
    desktop: Object.assign(d.desktop, s.desktop || {}), phone: Object.assign(d.phone, s.phone || {}) };
}

/* ---------- registro compartido ---------- */
type KitGlobal = { __coolKit?: Registry };
export function registry(): Registry {
  const g = window as unknown as KitGlobal;
  if (!g.__coolKit) {
    const reg: Registry = {
      protocol: PROTOCOL, kits: {}, tools: {}, leader: null, settings: null, toggled: false,
      refresh: () => { const k = reg.leader ? reg.kits[reg.leader] : null; if (k) k.refresh(); },
    };
    g.__coolKit = reg;
  }
  return g.__coolKit;
}
function elect(reg: Registry) {
  const best = Object.keys(reg.kits).sort((a, b) => reg.kits[b].version - reg.kits[a].version || a.localeCompare(b))[0] ?? null;
  if (best === reg.leader) { reg.refresh(); return; }
  const old = reg.leader ? reg.kits[reg.leader] : null;
  if (old) old.stop();                              // el líder saliente quita todo lo que pintó
  reg.leader = best;
  if (best) reg.kits[best].start();
}

/* los ajustes del dispositivo (el teléfono tiene los suyos; la tablet usa los del ordenador) */
export type Device = "desktop" | "phone";
export const thisDevice = (): Device => Platform.isPhone ? "phone" : "desktop";
export function devicePrefs(device: Device = thisDevice()): BarPrefs {
  const reg = registry();
  reg.settings ??= defaultSettings();
  return reg.settings[device];
}
/* las herramientas en el orden de la barra (el del usuario; si no, el de cada plugin) */
export function sortedTools(prefs: BarPrefs): CoolTool[] {
  return Object.values(registry().tools)
    .sort((a, b) => (prefs.tools[a.id]?.order ?? a.order ?? 0) - (prefs.tools[b.id]?.order ?? b.order ?? 0) || a.id.localeCompare(b.id));
}
/* guarda los ajustes en todos los plugins Cool */
export async function saveBarSettings(): Promise<void> {
  const reg = registry();
  reg.settings ??= defaultSettings();
  reg.settings.updatedAt = Date.now();
  const copy = JSON.parse(JSON.stringify(reg.settings)) as BarSettings;
  await Promise.all(Object.values(reg.tools).flatMap(t => t.saveShared ? [t.saveShared(copy).catch(() => {})] : []));
  reg.refresh();
}

export interface CoolKitHandle { refresh(): void }

/* el plugin se apunta a la barra; al descargarse se borra solo (plugin.register) */
export function joinCoolKit(plugin: Plugin, tool: CoolTool): CoolKitHandle {
  const reg = registry();
  const id = plugin.manifest.id;
  const painter = new BarPainter(plugin);
  reg.kits[id] = { version: KIT_VERSION, start: () => painter.start(), stop: () => painter.stop(), refresh: () => painter.refresh() };
  reg.tools[tool.id] = tool;
  elect(reg);
  /* ajustes: si la copia de este plugin es más nueva que la que hay, manda la suya */
  if (tool.loadShared) void tool.loadShared().then(s => {
    if (!s) return;
    const mine = normSettings(s);
    if (!reg.settings || mine.updatedAt > reg.settings.updatedAt) { reg.settings = mine; reg.refresh(); }
  }).catch(() => {});
  plugin.register(() => {
    if (reg.leader === id) { reg.kits[id]?.stop(); reg.leader = null; }
    delete reg.kits[id];
    if (reg.tools[tool.id] === tool) delete reg.tools[tool.id];
    elect(reg);
  });
  return { refresh: () => reg.refresh() };
}

/* ---------- la barra en cada pestaña (solo la pinta el líder) ----------
   Se cuelga del contenedor de la pestaña (.workspace-leaf-content, el containerEl de la vista), entre la cabecera
   (.view-header) y el contenido (.view-content): queda fuera de lo que hace scroll. Si no hay .view-content, al principio
   o al final del contenedor. No es API oficial de Obsidian: solo se usan esas dos clases. */
type State = "active" | "available" | "locked";
const COMMAND = "toggle-cool-bar";

class BarPainter {
  plugin: Plugin;
  comp: Component | null = null;
  bars = new Map<WorkspaceLeaf, HTMLElement>();
  raf = 0;
  constructor(plugin: Plugin) { this.plugin = plugin; }

  start() {
    if (this.comp) return;
    const ws = this.plugin.app.workspace;
    this.comp = new Component();
    this.comp.load();
    this.comp.registerEvent(ws.on("layout-change", () => this.refresh()));
    this.comp.registerEvent(ws.on("active-leaf-change", () => this.refresh()));
    this.comp.registerEvent(ws.on("file-open", () => this.refresh()));
    /* el comando lo registra solo el líder (así no sale repetido en la paleta, uno por plugin Cool) */
    this.plugin.addCommand({ id: COMMAND, name: kt("cmd.toggle"), callback: () => { const reg = registry(); reg.toggled = !reg.toggled; this.refresh(); } });
    this.paint();
  }
  stop() {
    window.cancelAnimationFrame(this.raf);
    try { this.plugin.removeCommand(COMMAND); } catch { /* ya no estaba */ }
    this.comp?.unload();
    this.comp = null;
    for (const el of this.bars.values()) { el.parentElement?.removeClass("cool-has-bar"); el.remove(); }
    this.bars.clear();
  }
  refresh() {
    if (!this.comp) return;
    window.cancelAnimationFrame(this.raf);
    this.raf = window.requestAnimationFrame(() => this.paint());
  }

  paint() {
    if (!this.comp) return;
    const reg = registry(), prefs = devicePrefs(), ws = this.plugin.app.workspace;
    const vis = (t: CoolTool): ToolVisibility => prefs.tools[t.id]?.visibility || "always";
    const tools = sortedTools(prefs).filter(t => vis(t) !== "never");
    const seen = new Set<WorkspaceLeaf>();
    ws.iterateAllLeaves(leaf => {
      const root = typeof leaf.getRoot === "function" ? leaf.getRoot() : null;
      if (root && (root === ws.leftSplit || root === ws.rightSplit)) return;          // las barras laterales, no
      const host = leaf.view?.containerEl;
      if (!host) return;
      const stateOf = (t: CoolTool): State => !safe(() => t.appliesTo(leaf)) ? "locked" : safe(() => t.isOpen(leaf)) ? "active" : "available";
      const states = tools.map(t => ({ t, s: stateOf(t) }))
        .filter(x => vis(x.t) === "always" || x.s !== "locked");
      const applies = states.some(x => x.s !== "locked");
      const show = states.length > 0 && (prefs.mode === "hidden" ? reg.toggled : !reg.toggled && (prefs.mode === "fixed" || applies));
      if (!show) return;
      seen.add(leaf);
      let bar = this.bars.get(leaf);
      if (!bar || bar.ownerDocument !== host.ownerDocument) { bar?.remove(); bar = this.makeBar(leaf); this.bars.set(leaf, bar); }
      this.place(host, bar, prefs);
      this.fill(leaf, bar, states, prefs);
    });
    for (const [leaf, el] of this.bars) if (!seen.has(leaf)) { el.parentElement?.removeClass("cool-has-bar"); el.remove(); this.bars.delete(leaf); }
    for (const t of Object.values(reg.tools)) safe(() => { t.afterPaint?.(); return true; });
  }

  makeBar(leaf: WorkspaceLeaf): HTMLElement {
    /* se crea dentro de la pestaña (en su documento, también en ventanas emergentes); place() la coloca */
    const bar = leaf.view.containerEl.createDiv({ cls: "cool-bar", attr: { "data-ck": String(KIT_VERSION), role: "toolbar", "aria-label": kt("bar") } });
    const fold = bar.createEl("button", { cls: "cool-fold", attr: { type: "button" } });
    fold.addEventListener("click", () => { const p = devicePrefs(); p.collapsed = !p.collapsed; void saveBarSettings(); });
    bar.createDiv({ cls: "cool-tools" });
    /* el botón de cada herramienta: se busca por su data-tool */
    bar.addEventListener("click", evt => {
      const b = (evt.target as HTMLElement).closest<HTMLButtonElement>(".cool-tool");
      if (!b || b.disabled) return;
      const tool = registry().tools[b.getAttribute("data-tool") || ""];
      if (!tool) return;
      tool.toggle(leaf, b);
      this.refresh();
    });
    return bar;
  }
  place(host: HTMLElement, bar: HTMLElement, prefs: BarPrefs) {
    const content = host.querySelector<HTMLElement>(":scope > .view-content");
    if (prefs.location === "bottom") {
      if (content ? content.nextElementSibling !== bar : host.lastElementChild !== bar) content ? content.after(bar) : host.append(bar);
    } else if (prefs.location === "top") {
      if (content ? content.previousElementSibling !== bar : host.firstElementChild !== bar) content ? content.before(bar) : host.prepend(bar);
    } else if (bar.parentElement !== host) host.append(bar);
    host.addClass("cool-has-bar");
    bar.setAttribute("data-loc", prefs.location);
    bar.setAttribute("data-align", prefs.align);
    bar.toggleClass("is-collapsed", prefs.collapsed);
    bar.toggleClass("is-phone", Platform.isPhone);
  }
  fill(leaf: WorkspaceLeaf, bar: HTMLElement, states: { t: CoolTool; s: State }[], prefs: BarPrefs) {
    const fold = bar.querySelector<HTMLButtonElement>(".cool-fold")!, box = bar.querySelector<HTMLElement>(".cool-tools")!;
    const icon = prefs.collapsed ? "chevron-down" : "chevron-up";
    if (fold.getAttribute("data-icon") !== icon) { fold.empty(); setIcon(fold, icon); fold.setAttribute("data-icon", icon); }
    fold.setAttribute("aria-label", kt(prefs.collapsed ? "expand" : "collapse"));
    fold.setAttribute("aria-expanded", String(!prefs.collapsed));
    box.hidden = prefs.collapsed;
    /* solo se rehacen los botones si cambia la lista (así no se pierde el foco) */
    const ids = states.map(x => x.t.id).join("|");
    if (box.getAttribute("data-ids") !== ids) {
      box.empty();
      for (const { t } of states) box.createEl("button", { cls: "cool-tool", attr: { type: "button", "data-tool": t.id } });
      box.setAttribute("data-ids", ids);
    }
    states.forEach(({ t, s }, i) => {
      const b = box.children[i] as HTMLButtonElement;
      const label = t.label();
      if (b.textContent !== label) b.textContent = label;
      b.setAttribute("data-state", s);
      b.disabled = s === "locked";
      b.setAttribute("aria-disabled", String(s === "locked"));
      b.setAttribute("aria-pressed", String(s === "active"));
    });
  }
}
function safe(f: () => boolean): boolean { try { return !!f(); } catch { return false; } }
