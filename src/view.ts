/* La vista «cool-bases».
   - Si la vista tiene `coolbases`, se pinta con ese modelo (el que guarda el panel).
   - Si no, con el modelo de fábrica: el título y las propiedades marcadas en «Propiedades» de Bases. */
import { BasesView, IconValue, Keymap, ListValue, NullValue, parseYaml, TFile } from "obsidian";
import type { BasesEntry, BasesPropertyId, Events, QueryController, Value, View } from "obsidian";
import { clean, clone, str, ICON_MARK } from "./util";
import { normalizeModel, storable, getStyle, defaultModel } from "./model";
import { Facts, renderModel, postRender } from "./render";
import { createPanel } from "./panel";
import type { Panel } from "./panel";
import { setVars } from "./dom";
import { t } from "./i18n";
import type CoolBasesPlugin from "./main";
import type { Frontmatter, Model, Rec, RecValue, Source, Style } from "./types";

export const VIEW = "cool-bases";
export const KEY = "coolbases";
/* evento del espacio de trabajo para que solo haya un panel abierto */
export const CLOSE_PANELS = "cool-bases:close-panels";
const normProp = (p: unknown) => { const s = clean(p); return !s ? null : /^(note|file|formula)\./.test(s) ? s : "note." + s; };
const isNull = (v: Value | null | undefined) => { if (!v || v instanceof NullValue) return true; const s = v.toString().trim(); return s === "" || s === "null"; };
const asList = (v: unknown): unknown[] => ([] as unknown[]).concat(v);

export class CoolBasesView extends BasesView {
  declare type: string;
  declare plugin: CoolBasesPlugin;
  declare scrollEl: HTMLElement;
  declare cbUid: string;
  declare containerEl: HTMLElement;
  declare panel: Panel | null;
  declare sheet: { doc: Document; css: CSSStyleSheet } | null;
  declare _src: Source | null;
  declare _facts: Facts | null;
  declare _backIdx: Record<string, Record<string, TFile[]>> | null;
  declare editBar: HTMLDivElement;
  declare editBtn: HTMLButtonElement;
  declare cbResize: ResizeObserver;
  declare unloading: boolean;
  declare _postRaf: number;

  constructor(controller: QueryController, scrollEl: HTMLElement, plugin: CoolBasesPlugin) {
    super(controller);
    this.type = VIEW;
    this.plugin = plugin;
    this.scrollEl = scrollEl;
    this.cbUid = "cbv-" + Math.random().toString(36).slice(2, 8);
    this.containerEl = scrollEl.createDiv({ cls: "cb-view " + this.cbUid });
    this.panel = null;
    this.sheet = null;
    this._src = null;
    this._facts = null;
    this._backIdx = null;

    /* botón «Editar tarjeta», arriba a la derecha de la vista (la barra de Bases no admite botones de plugins) */
    this.editBar = createDiv({ cls: "cb-editbar" });
    this.editBtn = this.editBar.createEl("button", { cls: "cb-edit-btn", text: t("edit"), attr: { type: "button", "aria-expanded": "false" } });
    scrollEl.prepend(this.editBar);
    this.registerDomEvent(this.editBtn, "click", () => this.panel ? this.panel.root.querySelector<HTMLElement>("#cbp-done")?.focus() : this.openPanel());

    /* clics: enlaces, datos para copiar, casillas y la tarjeta (abre la nota) */
    const el = this.containerEl;
    this.registerDomEvent(el, "click", evt => {
      const tg = evt.target as HTMLElement;
      const a = tg.closest && tg.closest("a.cb-a");
      if (a) {
        if (a.classList.contains("internal-link")) {
          evt.preventDefault(); evt.stopPropagation();
          void this.app.workspace.openLinkText(a.getAttribute("data-link")!, a.getAttribute("data-from") || "", Keymap.isModEvent(evt));
        }
        return;                                                         // los externos los abre Obsidian
      }
      const ck = tg.closest && tg.closest(".cb-st[data-toggle]");
      if (ck) { evt.preventDefault(); evt.stopPropagation(); this.toggleState(ck); return; }   // casilla: se marca sin abrir la nota
      if (tg.closest && tg.closest(".cb-copy")) return;                  // correo y teléfono: texto para copiar
      if (String(window.getSelection && window.getSelection()).length) return;
      const card = tg.closest && tg.closest(".cb-card[data-path]");
      if (card) void this.app.workspace.openLinkText(card.getAttribute("data-path")!, "", Keymap.isModEvent(evt));
    });
    this.registerDomEvent(el, "keydown", evt => {
      const tg = evt.target as HTMLElement;
      const ck = tg.closest && tg.closest(".cb-st[data-toggle]");
      if (ck && (evt.key === " " || evt.key === "Enter")) { evt.preventDefault(); evt.stopPropagation(); this.toggleState(ck); return; }
      if (evt.key !== "Enter") return;
      const card = tg.closest && tg.closest(".cb-card[data-path]");
      if (card) void this.app.workspace.openLinkText(card.getAttribute("data-path")!, "", Keymap.isModEvent(evt));
    });
    this.registerDomEvent(el, "mouseover", evt => {
      const tg = evt.target as HTMLElement;
      const a = tg.closest && tg.closest("a.cb-a.internal-link");
      const card = tg.closest && tg.closest(".cb-card[data-path]");
      if (!card) return;
      this.app.workspace.trigger("hover-link", { event: evt, source: "bases", hoverParent: this.app.renderContext, targetEl: a || card,
        linktext: a ? a.getAttribute("data-link") : card.getAttribute("data-path"), sourcePath: a ? a.getAttribute("data-from") : "" });
    });
    this.cbResize = new ResizeObserver(() => this.schedulePost());
    this.cbResize.observe(el);
    const events: Events = this.app.workspace;
    this.registerEvent(events.on(CLOSE_PANELS, except => { if (except !== this) this.closePanel(); }));
  }

  /* ---------- lectura de la configuración ---------- */
  cfgGet(k: string): unknown { try { return this.config.get(k); } catch { return undefined; } }
  savedModel(): object | null { const m = this.cfgGet(KEY); return m && typeof m === "object" ? m : null; }

  onDataUpdated() {
    this._src = null; this._facts = null; this._backIdx = null;
    if (this.panel) { this.panel.onData(); this.renderCool(this.panel.model); return; }
    this.renderCool(this.initialModel());
  }
  onResize() { this.schedulePost(); }
  onunload() {
    this.unloading = true;
    this.closePanel();
    this.cbResize?.disconnect();
    window.cancelAnimationFrame(this._postRaf);
    this.setCss("");
    this.editBar?.remove();
  }

  /* casilla de un estado: cambia la propiedad sí/no en la nota */
  toggleState(ck: Element) {
    const prop = ck.getAttribute("data-toggle") || "", card = ck.closest(".cb-card[data-path]");
    if (!card || !prop.startsWith("note.")) return;
    const path = card.getAttribute("data-path") || "";
    const f = this.app.vault.getAbstractFileByPath(path) || this.app.metadataCache.getFirstLinkpathDest(path, "");
    if (!(f instanceof TFile)) return;
    const key = prop.slice(5);
    void this.app.fileManager.processFrontMatter(f, (fm: Frontmatter) => {
      const cur = fm[key], v: unknown = Array.isArray(cur) ? (cur as unknown[])[0] : cur;
      fm[key] = !(v === true || ["true", "sí", "si", "yes", "1", "x", "✓"].includes(str(v ?? "").trim().toLowerCase()));
    });
  }
  renderCool(model: Model) {
    const el = this.containerEl;
    const src = this.source(), facts = this.factsFor(src);
    const groups = this.data.groupedData.map(g => ({ hasKey: g.hasKey(), key: g.key, recs: g.entries.map(e => this.rec(e)) }));
    renderModel(el, model, groups, src, facts, this.cbUid, (hd, g) => g.key!.renderTo(hd, this.app.renderContext));
    this.setCss(model.css && model.css.trim() ? ".cb-view." + this.cbUid + " {\n" + model.css + "\n}" : "");
    el.querySelectorAll("img").forEach(im => { if (!im.complete) im.addEventListener("load", () => this.schedulePost(), { once: true }); });
    if (document.fonts && document.fonts.status !== "loaded") void document.fonts.ready.then(() => this.schedulePost());
  }
  /* el CSS libre de la vista, en una hoja propia del documento de la vista (sin elementos <style>) */
  setCss(text: string) {
    const doc = this.containerEl.ownerDocument;
    if (this.sheet && this.sheet.doc !== doc) { const old = this.sheet; old.doc.adoptedStyleSheets = old.doc.adoptedStyleSheets.filter(x => x !== old.css); this.sheet = null; }

    if (!text && !this.sheet) return;
    if (!this.sheet) {
      const Sheet = doc.defaultView && doc.defaultView.CSSStyleSheet;
      if (!Sheet || !("adoptedStyleSheets" in doc)) return;          // sistemas muy antiguos: sin CSS libre
      this.sheet = { doc, css: new Sheet() };
      doc.adoptedStyleSheets = [...doc.adoptedStyleSheets, this.sheet.css];
    }
    try { this.sheet.css.replaceSync(text); } catch { this.sheet.css.replaceSync(""); }
    if (!text) { const css = this.sheet.css; doc.adoptedStyleSheets = doc.adoptedStyleSheets.filter(x => x !== css); this.sheet = null; }
  }
  schedulePost() {
    window.cancelAnimationFrame(this._postRaf);
    this._postRaf = window.requestAnimationFrame(() => postRender(this.containerEl));
  }

  /* ---------- datos: cada nota como un registro con los valores ya limpios ---------- */
  readValue(entry: BasesEntry, prop: string): RecValue {
    if (prop === "file.name") return entry.file.basename;
    if (prop.startsWith("note.")) {                       // tal cual está en la nota (con [[enlaces|alias]])
      const fm: Frontmatter | undefined = this.app.metadataCache.getFileCache(entry.file)?.frontmatter;
      if (fm) {
        const raw = fm[prop.slice(5)];
        const one = (x: unknown): string => x == null ? "" : typeof x === "object" ? (Array.isArray(x) ? x.map(one).join(", ") : JSON.stringify(x)) : clean(x);
        if (Array.isArray(raw)) { const a = raw.map(one).filter(x => x && x !== "null"); return a.length ? a : null; }
        const s = one(raw); return s && s !== "null" ? s : null;
      }
    }
    let v: Value | null; try { v = entry.getValue(prop as BasesPropertyId); } catch { return null; }
    if (!v || v instanceof NullValue) return null;
    if (v instanceof ListValue) {
      const a: string[] = [];
      for (let i = 0; i < v.length(); i++) { const x = v.get(i); if (!x || x instanceof NullValue) continue; const s = clean(x.toString()); if (s && s !== "null") a.push(x instanceof IconValue ? ICON_MARK + s : s); }
      return a.length ? a : null;
    }
    const s = clean(v.toString()); if (!s || s === "null") return null;
    return v instanceof IconValue ? ICON_MARK + s : s;   // un icono de una fórmula: se dibuja en la tarjeta
  }
  rec(entry: BasesEntry): Rec {
    const cache = new Map<string, RecValue>();
    return { entry, path: entry.file.path, name: entry.file.basename, get: p => { if (!cache.has(p)) cache.set(p, this.readValue(entry, p)); return cache.get(p)!; } };
  }
  /* la imagen de una nota: una URL, o una imagen del vault enlazada */
  imageUrl(entry: BasesEntry, prop: string): string | null {
    if (!prop) return null;
    let v: Value | null; try { v = entry.getValue(prop as BasesPropertyId); } catch { return null; }
    if (isNull(v)) return null;
    const first = v instanceof ListValue ? (v.length() ? v.get(0) : null) : v;
    if (isNull(first)) return null;
    const s = String(first!.toString()).replace(/^!?\[\[|\]\]$/g, "").replace(/\|.*$/, "").trim();
    if (/^(https?:|data:|app:)/.test(s)) return s;
    const f = this.app.metadataCache.getFirstLinkpathDest(s, entry.file.path);
    return f ? this.app.vault.getResourcePath(f) : null;
  }
  source(): Source {
    if (this._src) return this._src;
    const mc = this.app.metadataCache;
    const recs = this.data.data.map(e => this.rec(e));
    this._src = {
      recs,
      displayName: p => this.propLabel(p),
      imageUrl: (rec, p) => this.imageUrl(rec.entry!, p),
      linkTarget: (path, from) => { const f = mc.getFirstLinkpathDest(path, from); return f ? { path: f.path, fm: mc.getFileCache(f)?.frontmatter || {} } : null; },
      backlinks: (prop, path) => (this.backIndex(prop)[path] || []).map(f => ({ n: f.basename, path: f.path, fm: mc.getFileCache(f)?.frontmatter || {} })),
    };
    return this._src;
  }
  /* notas que enlazan a cada nota por una propiedad («← propiedad») */
  backIndex(prop: string): Record<string, TFile[]> {
    this._backIdx ??= {};
    if (this._backIdx[prop]) return this._backIdx[prop];
    const idx: Record<string, TFile[]> = {}, mc = this.app.metadataCache;
    for (const f of this.app.vault.getMarkdownFiles()) {
      const fm: Frontmatter | undefined = mc.getFileCache(f)?.frontmatter;
      if (!fm || fm[prop] == null) continue;
      for (const v of asList(fm[prop])) {
        const s = clean(String(v)).replace(/^\[\[|\]\]$/g, "").replace(/\|.*$/, "");
        const dest = mc.getFirstLinkpathDest(s, f.path);
        if (dest) (idx[dest.path] ??= []).push(f);
      }
    }
    return this._backIdx[prop] = idx;
  }
  factsFor(src: Source): Facts {
    if (this._facts && this._facts.src === src) return this._facts;
    return this._facts = new Facts(src, this.allProps());
  }
  allProps(): string[] {
    const order = this.config.getOrder();
    const all = Array.isArray(this.allProperties) ? this.allProperties : [];
    return [...new Set([...order, ...all])].filter(p => p !== "file.name");
  }
  propLabel(p: string): string {
    if (!p) return "";
    if (p.startsWith("rel:")) return "← " + p.slice(4);
    try { return this.config.getDisplayName(p as BasesPropertyId); } catch { return p.replace(/^note\./, ""); }
  }
  /* propiedades para «Añadir dato»: las de la base y las que enlazan aquí desde otras notas */
  panelProps(facts: Facts): string[] {
    const props = this.allProps().filter(p => !facts.isImage(p));
    const rel = new Set<string>(), paths = new Set(this.data.data.map(e => e.file.path)), mc = this.app.metadataCache;
    for (const f of this.app.vault.getMarkdownFiles()) {
      const fm: Frontmatter | undefined = mc.getFileCache(f)?.frontmatter; if (!fm) continue;
      for (const [k, v] of Object.entries(fm)) {
        if (rel.has(k)) continue;
        for (const x of asList(v)) {
          if (typeof x !== "string" || !/^\[\[/.test(clean(x))) continue;
          const d = mc.getFirstLinkpathDest(clean(x).replace(/^\[\[|\]\]$/g, "").replace(/\|.*$/, ""), f.path);
          if (d && paths.has(d.path)) { rel.add(k); break; }
        }
      }
    }
    return [...props, ...[...rel].sort().map(k => "rel:" + k)];
  }
  containsFocus() { const a = document.activeElement; return !!a && (this.scrollEl.contains(a)); }

  /* ---------- modelos ---------- */
  factoryModel(): Model { return defaultModel(this.config.getOrder(), this.factsFor(this.source())); }
  initialModel(): Model {
    const saved = this.savedModel();
    return saved ? normalizeModel(clone(saved)) : this.factoryModel();
  }

  /* ---------- panel ---------- */
  openPanel() {
    this.app.workspace.trigger(CLOSE_PANELS, this);
    const host = this.scrollEl.parentElement || document.body;
    if (getComputedStyle(host).position === "static") host.addClass("cb-panel-host");
    this.panel = createPanel(this, host);
    setVars(this.panel.root, { "--cbp-top": (this.scrollEl.offsetTop || 0) + "px" });
    this.scrollEl.addClass("cb-editing");
    this.editBtn.setAttribute("aria-expanded", "true");
  }
  /* cerrar sin «Listo» (otra vista abre su panel, se cierra la vista…) descarta los cambios y vuelve a lo guardado */
  closePanel(saving?: boolean) {
    if (!this.panel) return;
    this.panel.destroy();
    this.panel = null;
    this.scrollEl.removeClass("cb-editing");
    this.editBtn.setAttribute("aria-expanded", "false");
    if (!saving && !this.unloading) this.onDataUpdated();
  }
  savePanel(model: Model) {
    const out = storable(model);
    this.closePanel(true);
    this.config.set(KEY, out);
    this.renderCool(normalizeModel(clone(out)));
  }

  /* ---------- «Copiar de otra vista»: las vistas Cool Bases de todos los .base del vault ---------- */
  async otherViews(): Promise<{ label: string; style: Style }[]> {
    const out: { label: string; style: Style }[] = [];
    const files = this.app.vault.getFiles().filter(f => f.extension === "base");
    const self = this.baseFile();
    type Loose = Record<string, unknown>;
    for (const f of files) {
      let y: unknown; try { y = parseYaml(await this.app.vault.cachedRead(f)); } catch { continue; }
      const views = y && Array.isArray((y as Loose).views) ? (y as Loose).views as (Loose | null)[] : [];
      for (const v of views) {
        if (!v || v.type !== VIEW) continue;
        if (v.name === this.config.name && self && self.path === f.path) continue;
        try {
          const model = v[KEY] && typeof v[KEY] === "object" ? normalizeModel(clone(v[KEY])) : defaultModel(((v.order || []) as unknown[]).map(normProp).filter((p): p is string => !!p), null);
          out.push({ label: f.basename + " · " + (v.name as string), style: getStyle(model) });
        } catch { /* vista ilegible: se salta */ }
      }
    }
    return out;
  }
  baseFile(): TFile | null {
    let file: TFile | null = null;
    this.app.workspace.iterateAllLeaves(l => { const v = l.view as View & { file?: unknown }; if
 (!file && v && v.containerEl && v.containerEl.contains(this.scrollEl) && v.file instanceof TFile) file = v.file; });
    return file;
  }
}
