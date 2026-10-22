/* Simulación mínima de la API de Obsidian y Bases para probar Cool Bases en un navegador, sin Obsidian.
   Solo lo que usa el plugin: vistas de Bases, config (get/set/getOrder…), valores de las notas, enlaces, caché de metadatos,
   los ayudantes de DOM (createEl, createSvg, setCssProps…), eventos del espacio de trabajo e idioma. */
(function () {
  "use strict";
  /* ---------- ayudantes de DOM que Obsidian añade a los elementos ---------- */
  const P = HTMLElement.prototype;
  function opts(el, o) {
    if (!o) return el;
    if (typeof o === "string") { el.setAttribute("class", o); return el; }
    if (o.cls) el.setAttribute("class", Array.isArray(o.cls) ? o.cls.join(" ") : o.cls);
    if (o.text != null) el.textContent = o.text;
    if (o.attr) for (const [k, v] of Object.entries(o.attr)) if (v != null) el.setAttribute(k, v);
    if (o.title) el.title = o.title;
    return el;
  }
  window.createEl = (tag, o) => opts(document.createElement(tag), o);
  window.createSvg = (tag, o) => opts(document.createElementNS("http://www.w3.org/2000/svg", tag), o);
  window.createFragment = () => document.createDocumentFragment();
  window.createDiv = o => window.createEl("div", o);
  window.createSpan = o => window.createEl("span", o);
  P.createEl = function (tag, o) { const el = window.createEl(tag, o); this.appendChild(el); return el; };
  P.createDiv = function (o) { return this.createEl("div", o); };
  P.createSpan = function (o) { return this.createEl("span", o); };
  P.empty = function () { while (this.firstChild) this.removeChild(this.firstChild); };
  P.setText = function (t) { this.textContent = t; };
  P.appendText = function (t) { this.appendChild(document.createTextNode(t)); };
  P.addClass = function (...c) { this.classList.add(...c); };
  P.removeClass = function (...c) { this.classList.remove(...c); };
  P.toggleClass = function (c, on) { this.classList.toggle(c, !!on); };
  P.createSvg = function (tag, o) { const el = window.createSvg(tag, o); this.appendChild(el); return el; };
  P.setCssProps = function (props) { for (const [k, v] of Object.entries(props)) this.style.setProperty(k, v); };
  P.setCssStyles = function (st) { Object.assign(this.style, st); };
  for (const k of ["addClass", "removeClass", "toggleClass", "setCssProps", "empty"]) SVGElement.prototype[k] = P[k];

  /* ---------- valores ---------- */
  class Value { renderTo(el) { el.appendText(this.toString()); } }
  class NullValue extends Value { toString() { return "null"; } isTruthy() { return false; } }
  class StringValue extends Value {
    constructor(v) { super(); this.v = v; }
    toString() { return String(this.v); }
    isTruthy() { return !!this.v; }
    renderTo(el) {
      const m = /^\[\[([^\]|]+)(?:\|([^\]]+))?\]\]$/.exec(String(this.v).trim());
      if (m) { const a = el.createEl("a", { cls: "internal-link", text: m[2] || m[1], attr: { "data-href": m[1], href: m[1] } }); return; }
      if (/^https?:\/\//.test(String(this.v))) { el.createEl("a", { cls: "external-link", text: String(this.v), attr: { href: String(this.v) } }); return; }
      el.appendText(String(this.v));
    }
  }
  class ListValue extends Value {
    constructor(a) { super(); this.a = a; }
    length() { return this.a.length; }
    get(i) { return this.a[i]; }
    toString() { return this.a.map(x => x.toString()).join(", "); }
    isTruthy() { return this.a.length > 0; }
    renderTo(el) { this.a.forEach((x, i) => { if (i) el.appendText(", "); x.renderTo(el); }); }
  }
  const toValue = raw => raw == null || raw === "" ? new NullValue() : Array.isArray(raw) ? new ListValue(raw.filter(x => x != null).map(x => new StringValue(x))) : new StringValue(raw);

  class TFile { constructor(path) { this.path = path; this.name = path.split("/").pop(); this.extension = this.name.split(".").pop(); this.basename = this.name.replace(/\.[^.]+$/, ""); } }
  class Component {
    constructor() { this._cb = []; }
    register(cb) { this._cb.push(cb); }
    registerDomEvent(el, t, f) { el.addEventListener(t, f); this._cb.push(() => el.removeEventListener(t, f)); }
    registerEvent(ref) { this._cb.push(() => ref.off()); }
    load() {}
    unload() { this._cb.forEach(f => f()); this._cb = []; this.onunload && this.onunload(); }
  }
  /* eventos (los del espacio de trabajo) */
  class Events {
    constructor() { this._h = {}; }
    on(name, cb) { (this._h[name] ||= []).push(cb); return { off: () => { this._h[name] = (this._h[name] || []).filter(x => x !== cb); } }; }
    trigger(name, ...a) { (this._h[name] || []).slice().forEach(cb => cb(...a)); }
  }
  class BasesView extends Component {
    constructor(controller) { super(); this.app = controller.app; this.config = controller.config; this.data = controller.data; this.allProperties = controller.allProperties; }
  }
  class Plugin extends Component {
    constructor(app, manifest) { super(); this.app = app; this.manifest = manifest; }
    registerBasesView(id, reg) { (window.__basesViews ||= {})[id] = reg; return true; }
    get dataKey() { return this.manifest.id === "cool-bases" ? "__pluginData" : "__pluginData_" + this.manifest.id; }
    async loadData() { return window[this.dataKey] || null; }
    async saveData(d) { window[this.dataKey] = JSON.parse(JSON.stringify(d)); }
    addCommand(c) { (window.__commands ||= {})[this.manifest.id + ":" + c.id] = c; return c; }
    removeCommand(id) { delete (window.__commands || {})[this.manifest.id + ":" + id]; }
    addSettingTab(tab) { (window.__settingTabs ||= {})[this.manifest.id] = tab; }
  }
  /* ajustes: lo justo de PluginSettingTab y Setting (desplegables, interruptores y botones pequeños) */
  class PluginSettingTab { constructor(app, plugin) { this.app = app; this.plugin = plugin; this.containerEl = document.createElement("div"); this.containerEl.className = "vertical-tab-content"; } }
  class Setting {
    constructor(el) {
      this.settingEl = el.createDiv({ cls: "setting-item" });
      const info = this.settingEl.createDiv({ cls: "setting-item-info" });
      this.nameEl = info.createDiv({ cls: "setting-item-name" }); this.descEl = info.createDiv({ cls: "setting-item-description" });
      this.controlEl = this.settingEl.createDiv({ cls: "setting-item-control" });
    }
    setName(t) { this.nameEl.textContent = t; return this; }
    setDesc(t) { this.descEl.textContent = t; return this; }
    setClass(c) { this.settingEl.addClass(c); return this; }
    setHeading() { this.settingEl.addClass("setting-item-heading"); return this; }
    addDropdown(cb) {
      const sel = this.controlEl.createEl("select", { cls: "dropdown" }); let fn = null;
      sel.addEventListener("change", () => fn && fn(sel.value));
      const dd = { selectEl: sel, addOption: (v, t) => { sel.createEl("option", { text: t, attr: { value: v } }); return dd; },
        addOptions: o => { for (const [v, t] of Object.entries(o)) dd.addOption(v, t); return dd; },
        setValue: v => { sel.value = v; return dd; }, onChange: f => { fn = f; return dd; } };
      cb(dd); return this;
    }
    addToggle(cb) {
      const el = this.controlEl.createEl("input", { cls: "checkbox-container", attr: { type: "checkbox" } }); let fn = null;
      el.addEventListener("change", () => fn && fn(el.checked));
      const tg = { toggleEl: el, setValue: v => { el.checked = !!v; return tg; }, onChange: f => { fn = f; return tg; } };
      cb(tg); return this;
    }
    addExtraButton(cb) {
      const el = this.controlEl.createEl("button", { cls: "clickable-icon extra-setting-button" }); let fn = null;
      el.addEventListener("click", () => fn && !el.disabled && fn());
      const b = { extraSettingsEl: el, setIcon: i => { el.setAttribute("data-icon", i); return b; }, setTooltip: t => { el.setAttribute("aria-label", t); return b; },
        setDisabled: d => { el.disabled = !!d; return b; }, onClick: f => { fn = f; return b; } };
      cb(b); return this;
    }
  }
  class Notice {
    constructor(msg, ms) {
      const box = document.getElementById("notices") || document.body.appendChild(Object.assign(document.createElement("div"), { id: "notices" }));
      this.el = box.appendChild(document.createElement("div")); this.el.className = "notice";
      typeof msg === "string" ? this.el.textContent = msg : this.el.appendChild(msg);
      setTimeout(() => this.hide(), ms || 4000);
    }
    hide() { this.el.remove(); }
  }
  const Keymap = { isModEvent: e => !!(e && (e.metaKey || e.ctrlKey)) };
  const MarkdownRenderer = { render: async (app, md, el) => { el.appendText(md); } };
  const getLanguage = () => window.__lang || "en";
  const Platform = { get isPhone() { return !!window.__phone; }, get isMobile() { return !!window.__phone; }, isDesktop: true };
  const moment = { locale: () => window.__lang || "en" };
  window.__obsidian = { Plugin, PluginSettingTab, Setting, BasesView, Component, Events, ListValue, NullValue, StringValue, Value, TFile, Notice, Keymap, MarkdownRenderer,
    parseYaml: s => window.jsyaml.load(s), Platform,
    setIcon: (el, name) => {
      el.empty();
      const paths = { "move-horizontal": ["m18 8 4 4-4 4", "M2 12h20", "m6 8-4 4 4 4"], "move-vertical": ["M12 2v20", "m8 18 4 4 4-4", "m8 6 4-4 4 4"] }[name];
      if (!paths) { el.createSpan({ cls: "icon-" + name, text: /up/.test(name) ? "⌃" : /down/.test(name) ? "⌄" : "•" }); return; }
      const s = el.createSvg("svg", { attr: { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": "2", "stroke-linecap": "round", "stroke-linejoin": "round", width: "24", height: "24" } });
      for (const d of paths) s.appendChild(window.createSvg("path", { attr: { d } }));
    }, toValue, getLanguage, moment };
  window.require = name => { if (name === "obsidian") return window.__obsidian; throw new Error("módulo desconocido: " + name); };
})();
