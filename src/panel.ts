/* Panel «Editar tarjeta». Edita una copia del modelo; las tarjetas de la vista cambian al momento.
   No se escribe nada en la vista hasta pulsar «Listo». Todo se construye con el DOM; los textos, en i18n.js. */
import { Notice, setIcon } from "obsidian";
import { clone, clamp, fmt, merge, hex6, hexToHsva, hsvaToHex, fmtNum, str } from "./util";
import { TYPES, FONTS, fontStack, fontName, WEIGHTS, SEPS, FMTS, ITEM_DEF, TITLE_KEYS, splitSpace, BASE_STYLE, STYLE_KEYS, PRESETS,
  mkItem, syncStruct, getStyle, textish, ST_FMTS, ST_ICONS, mkState, framed } from "./model";
import { itemContent, rateNode, rateProp, imgSrc, tokCol, plainSample, nodeText, stateNode, stateOf } from "./render";
import { h, svg, append, setVars } from "./dom";
import type { AttrVal, Kid } from "./dom";
import { t, fontLabel } from "./i18n";
import { KIT_VERSION } from "./cool-kit/kit";
import type { Hsva } from "./util";
import type { CoolBasesView } from "./view";
import type { Item, Model, Rec, State, Style } from "./types";

const chain = () => svg("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": 2, "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": "true" },
  svg("path", { d: "M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.5 1.5" }), svg("path", { d: "M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.5-1.5" }));
const D = (d: unknown) => d ? true : null;
const fid = (p: string) => "cbp-" + p.replace(/[^a-z0-9]/gi, "-");
const quote = (s: string) => t("q.open") + s + t("q.close");
let localFonts: string[] | null = null;            // familias instaladas (si el sistema deja listarlas)

/* opciones de un desplegable: [valor, texto, desactivada] o un grupo */
type Opt = [string | number, string] | [string | number, string, boolean];
type OptGroup = { group: string; items: Opt[] };
type ListKey = "items" | "fitems";
/* ventanita flotante abierta: menú, fuentes, color… (el color lleva su ruta y el color en HSVA) */
interface Fp { kind: string; anchorId: string; path?: string; st?: Hsva }
interface Ui { open: Set<string>; add: { prop: string; type: string } | null; addF: { prop: string } | null; fp: Fp | null }
export interface Panel { readonly model: Model; destroy(): void; onData(): void; root: HTMLElement; undo(): void }

/* view: la vista (model inicial, src/facts, render(model), guardar); host: dónde se monta el panel */
export function createPanel(view: CoolBasesView, host: HTMLElement): Panel {
  const plugin = view.plugin;
  let model = view.initialModel();
  const atOpen = JSON.stringify(model);                 // para saber si «Cancelar» descarta algo
  const ui: Ui = { open: new Set(["tamano"]), add: null, addF: null, fp: null };
  const hist: string[] = []; let lastPush = 0, lastPath = "";
  let src = view.source(), facts = view.factsFor(src);

  /* ---------- montaje ---------- */
  const btn = (id: string, label: Kid, o?: { primary?: boolean; attr?: Record<string, AttrVal> }) => h("button", { cls: "btn" + (o && o.primary ? " primary" : ""), attr: Object.assign({ type: "button", id }, o && o.attr || {}) }, label);
  const undoBtn = btn("cbp-undo", t("p.undo"), { attr: { disabled: true } });
  const cancelBtn = btn("cbp-cancel", t("p.cancel"), { attr: { "aria-haspopup": "dialog", "aria-expanded": "false" } });
  const doneBtn = btn("cbp-done", t("p.done"), { primary: true });
  const presetsBtn = btn("cbp-presets", t("p.presets"), { attr: { "aria-haspopup": "menu", "aria-expanded": "false" } });
  const saveBtn = btn("cbp-save", t("p.saveShort"), { attr: { "aria-haspopup": "dialog", "aria-expanded": "false", "aria-label": t("p.saveStyle") } });
  const copyBtn = btn("cbp-copy", t("p.copyShort"), { attr: { "aria-haspopup": "menu", "aria-expanded": "false", "aria-label": t("p.copyFrom") } });
  const pb = h("div", { cls: "pb", attr: { id: "cbp-pb" } });
  /* cabecera en tres columnas: Cancelar · Deshacer · Listo | EDIT CARD y la vista | Predeterminados · Guardar · Copiar vista */
  const root = h("aside", { cls: "cb-panel cool-ui", attr: { "aria-label": t("p.title"), "data-ck": KIT_VERSION } },
    h("header", "ph cbp-head",
      h("div", "ph-l", cancelBtn, undoBtn, doneBtn),
      h("div", "ph-c", h("h2", null, t("p.title")), h("p", "ph-sub", h("b", null, t("p.view")), " ", h("span", null, view.config.name || ""))),
      h("div", { cls: "ph-r", attr: { role: "toolbar", "aria-label": t("p.styles") } }, presetsBtn, saveBtn, copyBtn)),
    pb);
  host.appendChild(root);
  const fp = document.body.createDiv({ cls: "cb-fp cool-ui", attr: { "data-ck": KIT_VERSION } });
  fp.hidden = true;
  const $ = (sel: string) => (root.querySelector(sel) || fp.querySelector(sel)) as HTMLElement;
  const byId = (id: string) => $("#" + CSS.escape(id));

  /* ---------- hechos de la vista ---------- */
  const S = () => model;
  const ents = () => src.recs;
  const propsOf = () => view.panelProps(facts);
  const pname = (p: string) => view.propLabel(p);
  const imgProps = () => facts.imgProps();
  const urlProps = () => facts.urlProps();
  const isUrlProp = (p: string) => facts.isUrlProp(p);
  const rateProps = () => facts.rateProps();
  const okType = (p: string, ty: string) => ty === "enlace" && !isUrlProp(p) ? "texto" : ty;
  const netProp = (name: string) => { const p = "note." + name; return isUrlProp(p) ? p : null; };
  const typeName = (id: string) => t("type." + id);
  const wName = (w: number) => t("w." + w) + " " + w;
  const weightOpts = (): Opt[] => WEIGHTS.map((w): Opt => [w, wName(w)]);

  /* ---------- rutas e historial ---------- */
  /* una ruta del modelo: «card.w», «items.#id.t.max» (# = el elemento de la lista con ese id) */
  function walk(o: unknown, k: string): unknown { return o == null ? o : (k.startsWith("#") ? (o as { id: string }[]).find(x => x.id === k.slice(1)) : (o as Record<string, unknown>)[k]); }
  function getP(path: string): unknown { return path.split(".").reduce(walk, S()); }
  function setP(path: string, val: unknown) { const ks = path.split("."); const last = ks.pop()!; (ks.reduce(walk, S()) as Record<string, unknown>)[last] = val; }
  function snapshot() { hist.push(JSON.stringify(model)); if (hist.length > 100) hist.shift(); undoBtn.disabled = false; }
  function pushFor(path: string) { const now = Date.now(); if (path !== lastPath || now - lastPush > 800) snapshot(); lastPush = now; lastPath = path; }
  function undo() {
    if (!hist.length) return;
    model = JSON.parse(hist.pop()!) as Model;
    lastPath = ""; undoBtn.disabled = !hist.length; closeFp(); ui.add = null; ui.addF = null;
    renderPanel(); preview(); toast(t("toast.undone"));
  }
  let raf = 0;
  function preview() { window.cancelAnimationFrame(raf); raf = window.requestAnimationFrame(() => view.renderCool(model)); }

  /* ---------- controles ---------- */
  interface RowOpts { stk?: boolean; full?: boolean; dis?: boolean }
  function row(label: Kid, ctl: Kid, path?: string | null, o?: RowOpts) {
    o = o || {};
    return h("div", "row" + (o.stk ? " stk" : "") + (o.full ? " full" : "") + (o.dis ? " dis" : ""),
      o.full ? null : path ? h("label", { attr: { for: fid(path) } }, label) : h("span", "lbl", label),
      h("div", "ctl", ctl));
  }
  /* celdas en una fila; `cols` es la clase de las columnas (ver styles: .cells.c-…) */
  function cells(list: [Kid, Kid, unknown?][], cols: string) { return h("div", "cells " + cols, list.map(x => h("div", "cell" + (x[2] ? " dis" : ""), h("span", "cap", x[0]), h("div", "ctl", x[1])))); }
  const outTxt = (v: unknown, unit: string | undefined, d?: number | null): Kid[] => [fmt(v, d), unit ? h("small", null, unit) : null];
  function slider(path: string, min: number, max: number, step: number, unit: string, d?: number | null, dis?: unknown): Kid[] {
    const v = getP(path) as number;
    return [h("input", { attr: { type: "range", id: fid(path), "data-p": path, "data-k": "num", min, max, step, value: v, "data-unit": unit || "", "data-d": d == null ? "" : d, disabled: D(dis) } }),
      h("output", { attr: { "data-out": path } }, outTxt(v, unit, d))];
  }
  function seg(path: string, opts: (Opt | [string | number, Kid])[], label: string, dis?: unknown, mini?: boolean) {
    const v = getP(path);
    return h("div", { cls: "seg" + (mini ? " mini" : ""), attr: { role: "group", "aria-label": label || "" } },
      opts.map(([val, l]) => h("button", { attr: { type: "button", id: fid(path + "=" + val), "data-p": path, "data-k": "seg", "data-v": String(val), "data-vt": typeof val, "aria-pressed": String(v === val), disabled: D(dis) } }, l)));
  }
  function sw(path: string, label: string, dis?: unknown) { return h("button", { cls: "sw", attr: { type: "button", role: "switch", id: fid(path), "data-p": path, "data-k": "bool", "aria-checked": String(!!getP(path)), "aria-label": label || "", disabled: D(dis) } }); }
  function swl(path: string, label: string, dis?: unknown, ml?: boolean) { return h("span", "swl" + (ml ? " ml" : "") + (dis ? " dis" : ""), sw(path, label, dis), h("span", null, label)); }
  function sel(path: string, opts: (Opt | OptGroup)[], dis?: unknown, shown?: unknown) {
    const v = shown !== undefined ? shown : getP(path), vs = v == null ? "" : str(v);
    const o = ([val, l, off]: Opt) => h("option", { attr: { value: String(val), selected: D(vs === String(val)), disabled: D(off) } }, l);
    const num = opts.some(x => Array.isArray(x) && typeof x[0] === "number");
    return h("select", { attr: { id: fid(path), "data-p": path, "data-k": "sel", "data-num": num ? "1" : null, disabled: D(dis) } },
      opts.map(x => Array.isArray(x) ? o(x) : h("optgroup", { attr: { label: x.group } }, x.items.map(o))));
  }
  function txt(path: string, ph: string, dis?: unknown) { return h("input", { attr: { type: "text", id: fid(path), "data-p": path, "data-k": "txt", value: (getP(path) as string | null) ?? "", placeholder: ph || "", spellcheck: "false", disabled: D(dis) } }); }
  function swatch(path: string, dis?: unknown, resolver?: (v: unknown) => string) {
    const v = resolver ? resolver(getP(path)) : getP(path) as string;
    return h("button", { cls: "swc", attr: { type: "button", id: fid(path) + "-sw", "data-p": path, "data-k": "pick", "aria-label": t("p.pickColor"), "aria-expanded": "false", disabled: D(dis) } },
      h("span", { cls: "fill", attr: { "data-fill": path }, css: { "--cbp-fill": v } }));
  }
  function hexIn(path: string, dis?: unknown) { return h("input", { cls: "hex", attr: { type: "text", id: fid(path), "data-p": path, "data-k": "hex", value: getP(path) as string, spellcheck: "false", maxlength: 9, "aria-label": t("p.colorCode"), disabled: D(dis) } }); }
  function color(path: string, dis?: unknown) { return [swatch(path, dis), hexIn(path, dis)]; }
  function tok(path: string, dis?: unknown) {
    const v = getP(path), s = S(), own = v !== "tx" && v !== "det";
    const b = (k: string, label: string, on: boolean) => h("button", { attr: { type: "button", id: fid(path + "=" + k), "data-p": path, "data-k": "tok", "data-v": k, "aria-pressed": String(on), disabled: D(dis) } }, label);
    return [h("div", { cls: "seg", attr: { role: "group", "aria-label": t("c.color") } }, b("tx", t("c.text"), v === "tx"), b("det", t("c.details"), v === "det"), b("own", t("c.other"), own)),
      swatch(path, dis, x => tokCol(x, s))];
  }
  const ffSpan = (label: string, cls?: string) => h("span", { cls: "cbp-ff" + (cls ? " " + cls : ""), css: { "--cbp-ff": fontStack(label) } }, fontLabel(fontName(label)));
  function fontBtn(path: string, dis?: unknown) {
    const v = getP(path) as string | null, label = v == null ? S().font.family : v;
    return h("button", { cls: "fontb", attr: { type: "button", id: fid(path), "data-p": path, "data-k": "font", "aria-haspopup": "listbox", "aria-expanded": "false", disabled: D(dis), title: fontStack(label) } },
      ffSpan(label), h("span", "caret cbp-none", "▼"));
  }
  function scrub(path: string, min: number, max: number, step: number, unit: string, dis?: unknown) {
    const v = getP(path) as number | null, shown = v == null ? S().font.size : v;
    return h("span", "numw", h("input", { cls: "num", attr: { type: "text", id: fid(path), "data-p": path, "data-k": "scrub", "data-min": min, "data-max": max, "data-step": step, "data-unit": unit,
      value: fmt(shown) + " " + unit, spellcheck: "false", inputmode: "decimal", disabled: D(dis) } }));
  }
  /* tile de SIZE: un número grande que se cambia arrastrando (en horizontal o vertical), escribiendo o con las flechas */
  interface TileOpts { min: number; max: number; step: number; rate: number; unit: string; axis: "x" | "y"; icon?: string; dis?: boolean; cls?: string }
  function tile(path: string, label: string, o: TileOpts) {
    const v = tileVal(path);
    const icon = o.icon ? h("span", "tile-i") : null;
    if (icon && o.icon) setIcon(icon, o.icon);
    const inner = [h("label", { cls: "tile-l", attr: { for: fid(path) } }, label),
      h("span", "tile-pill", h("input", { cls: "num", attr: { type: "text", id: fid(path), "data-p": path, "data-k": "scrub", "data-min": o.min, "data-max": o.max, "data-step": o.step,
        "data-rate": o.rate, "data-axis": o.axis, "data-unit": o.unit, "data-tight": "1", value: fmt(v) + o.unit, spellcheck: "false", inputmode: "decimal", disabled: D(o.dis) } })),
      icon];
    return h("div", { cls: "tile" + (o.cls ? " " + o.cls : "") + (o.dis ? " dis" : ""), attr: { "data-tile": path }, css: tileVars(path, v) },
      path === "card.pad" ? [h("span", { cls: "tile-guide", attr: { "aria-hidden": "true" } }), inner] : inner);
  }
  /* RADIUS enseña su esquina y PADDING su guía, según el valor (con un tope) */
  function tileVars(path: string, v: number): Record<string, string> | undefined {
    if (path === "card.radius") return { "--cbp-r": Math.min(v, 18) + "px" };
    if (path === "card.pad") return { "--cbp-inset": (12 * Math.sqrt(Math.max(0, v) / 14)).toFixed(1) + "px" };   // 0 % = sin margen; 5 % ≈ 7 px; 14 % = 12 px
    return undefined;
  }
  /* interruptor con palabra: encendido, en acento y con la bola a la derecha; apagado, en gris, con la otra palabra */
  let animTgl: string | null = null;                 // el interruptor recién pulsado: se pinta en su estado anterior y se anima al nuevo
  function toggle(path: string, on: string, off: string, label: string, cls: string) {
    const v = !!getP(path), id = fid(path), shown = animTgl === id ? !v : v;
    return h("button", { cls: "tgl " + cls, attr: { type: "button", role: "switch", id, "data-p": path, "data-k": "bool", "aria-checked": String(shown), "data-v": String(v), "aria-label": label } },
      h("span", "tgl-w w-on", on), h("span", "tgl-w w-off", off), h("span", "tgl-k"));
  }
  /* cada palabra del interruptor cabe en su hueco (el botón no cambia de ancho): si no cabe, encoge */
  function fitToggles() {
    pb.querySelectorAll<HTMLElement>(".tgl").forEach(b => {
      const k = b.querySelector<HTMLElement>(".tgl-k"); if (!k || !b.offsetWidth) return;
      const avail = b.clientWidth - k.offsetWidth - 12;          // menos la bola y los márgenes
      b.querySelectorAll<HTMLElement>(".tgl-w").forEach(w => {
        setVars(w, { "--cbp-tk": null });
        const rg = document.createRange(); rg.selectNodeContents(w);
        const need = rg.getBoundingClientRect().width / (b.getBoundingClientRect().width / b.offsetWidth || 1);   // el ancho del texto (sin el zoom)
        if (avail > 0 && need > avail) setVars(w, { "--cbp-tk": (avail / need).toFixed(3) });
      });
    });
  }
  /* el valor de un tile; HEIGHT con una proporción enseña el alto calculado */
  function tileVal(path: string): number {
    const c = S().card;
    if (path === "card.h" && c.fmt !== "libre") { const [a, b] = c.fmt.split("/").map(Number); return a && b ? Math.round(c.w * b / a) : c.h; }
    return getP(path) as number;
  }
  /* GAP: la separación entre las letras es la separación real entre tarjetas (a escala); se arrastra en horizontal */
  const GAP_K = 0.5, GAP_MAX = 48;
  function gapCtl() {
    const g = S().card.gap;
    const L = (x: string) => h("span", { cls: "gap-l", attr: { "aria-hidden": "true" } }, x);
    const M = (n?: boolean) => h("span", { cls: "gap-m", attr: { "aria-hidden": "true" } }, n ? h("span", "gap-v", String(g)) : null);
    return h("div", { cls: "gapc", attr: { role: "slider", tabindex: 0, id: fid("card.gap"), "data-gap": "card.gap", "aria-label": t("c.gap"), "aria-valuemin": 0, "aria-valuemax": GAP_MAX,
      "aria-valuenow": g, "aria-valuetext": g + " px" }, css: { "--cbp-gap": (g * GAP_K) + "px" } },
      L("G"), M(true), L("A"), M(), L("P"));
  }
  function syncTiles() {
    pb.querySelectorAll<HTMLElement>("[data-tile]").forEach(tl => {
      const p = tl.dataset.tile!, v = tileVal(p), inp = tl.querySelector<HTMLInputElement>("input.num");
      if (inp && document.activeElement !== inp) inp.value = numTxt(inp, v);
      const tv = tileVars(p, v); if (tv) setVars(tl, tv);
    });
  }
  function syncGap() {
    const el = pb.querySelector<HTMLElement>(".gapc"); if (!el) return;
    const g = S().card.gap;
    setVars(el, { "--cbp-gap": (g * GAP_K) + "px" });
    el.setAttribute("aria-valuenow", String(g)); el.setAttribute("aria-valuetext", g + " px");
    const v = el.querySelector(".gap-v"); if (v) v.textContent = String(g);
  }
  /* la mini tarjeta de COLORS: fondo (o degradado), borde, texto y detalles del modelo, en vivo */
  function colorPreview() {
    const el = h("div", { cls: "mini-card", attr: { role: "img", "aria-label": t("c.preview") } },
      h("span", "mc-t", t("mc.title")), h("span", "mc-s", t("mc.sub")), h("span", "mc-line"),
      h("span", "mc-tags", h("i", "on", t("mc.tags")), h("i", null, t("mc.tags")), h("i", null, t("mc.tags"))));
    syncMini(el);
    return el;
  }
  function syncMini(el?: HTMLElement | null) {
    el = el || pb.querySelector<HTMLElement>(".mini-card"); if (!el) return;
    const s = S(), col = s.col;
    setVars(el, { "--mc-bg": col.grad ? "linear-gradient(" + col.angle + "deg," + col.bg + "," + col.bg2 + ")" : col.bg, "--mc-text": col.text, "--mc-bgc": col.bg, "--mc-det": col.det,
      "--mc-bw": Math.min(col.bw, 4) + "px", "--mc-bc": col.bc, "--mc-r": Math.min(s.card.radius, 14) + "px", "--mc-ff": fontStack(s.font.family) });
  }
  /* una fila de COLORS: etiqueta (o un interruptor) y su muestra */
  function crow(label: Kid, ctl: Kid, chip?: boolean) { return h("div", "crow", chip ? label : h("span", "crow-l", label), h("div", "crow-c", ctl)); }
  /* ↺ solo cuando el dato tiene un valor propio distinto del de la tarjeta */
  function capR(label: string, path: string, cardVal: unknown): Kid[] {
    const v = getP(path);
    return [label, v != null && v !== cardVal ? h("button", { cls: "rst", attr: { type: "button", "data-p": path, "data-k": "reset", "aria-label": t("p.resetTo", { what: label }) } }, "↺") : null];
  }
  function block(key: string, title: string, content: Kid, o?: { sw?: string; off?: boolean }) {
    o = o || {}; const open = ui.open.has(key);
    const body = h("div", "blk-b", content); body.hidden = !open;
    return h("div", { cls: "blk" + (o.off ? " off" : ""), attr: { "data-blk": key } },
      h("div", "blk-hd", h("button", { cls: "blk-h", attr: { type: "button", "data-toggle": key, "aria-expanded": String(open) } },
        h("span", "chev"), h("span", "blk-t", title), h("span", { cls: "sum", attr: { "data-sum": key } })), o.sw ? sw(o.sw, title) : null),
      body);
  }
  const sepH = () => h("div", "sep-h");

  /* ---------- Tarjeta ---------- */
  function tarjetaNode(s: Model) {
    const c = s.card, col = s.col, im = s.img, sp = imgSrc(s, facts), noImg = !sp;
    const fondo = im.fit === "fondo";
    const sideOrig = !noImg && im.fit === "original" && (im.pos === "left" || im.pos === "right");
    const ip = imgProps().slice(); if (sp && !ip.includes(sp)) ip.unshift(sp);
    const fx = im.fx === "color" ? "bn" : im.fx;
    return h("section", "grp", h("div", "grp-h", h("h3", null, t("g.card"))), h("div", "stack",
      /* SIZE: WIDTH y HEIGHT | FILL y proporciones | PADDING y RADIUS; debajo, GAP */
      block("tamano", t("b.size"), h("div", "size-grid",
        h("div", "sz-c1",
          tile("card.w", t("c.width"), { min: 140, max: 700, step: 1, rate: 2, unit: "px", axis: "x", icon: "move-horizontal", cls: "t-w" }),
          tile("card.h", t("c.height"), { min: 40, max: 700, step: 1, rate: 2, unit: "px", axis: "y", icon: "move-vertical", cls: "t-h", dis: c.fmt !== "libre" || sideOrig })),
        h("div", "sz-c2",
          toggle("card.fill", t("c.fill"), t("c.fixed"), t("c.fillWidth"), "tg-fill"),
          h("div", { cls: "fmts" + (sideOrig ? " dis" : ""), attr: { role: "group", "aria-label": t("c.format") } }, FMTS.map(([v, l]) =>
            h("button", { attr: { type: "button", id: fid("card.fmt=" + v), "data-p": "card.fmt", "data-k": "seg", "data-v": v, "data-vt": "string", "aria-pressed": String(c.fmt === v), disabled: D(sideOrig) } }, l || t("fmt.free"))))),
        h("div", "sz-c3",
          tile("card.pad", t("c.padShort"), { min: 0, max: 14, step: 0.5, rate: 0.25, unit: "%", axis: "x", cls: "t-pad" }),
          tile("card.radius", t("c.radiusShort"), { min: 0, max: 40, step: 1, rate: 0.5, unit: "px", axis: "x", cls: "t-radius" })),
        gapCtl())),
      /* COLORS: la mini tarjeta en vivo y, al lado, las muestras */
      block("colores", t("b.colors"), h("div", "colors",
        colorPreview(),
        h("div", "crows",
          crow(t("c.background"), swatch("col.bg")),
          crow(toggle("col.grad", t("c.gradient"), t("c.solid"), t("c.gradient"), "tg-grad"), swatch("col.bg2", !col.grad), true),
          crow(t("c.text"), swatch("col.text")),
          crow(t("c.details"), swatch("col.det")),
          crow(t("c.border"), [h("span", "numw bw", h("input", { cls: "num pill-in", attr: { type: "text", id: fid("col.bw"), "data-p": "col.bw", "data-k": "scrub", "data-min": 0, "data-max": 20,
            "data-step": 1, "data-rate": 0.25, "data-unit": "px", "data-tight": "1", value: fmt(col.bw) + "px", spellcheck: "false", inputmode: "decimal", "aria-label": t("c.border") } })),
            swatch("col.bc", col.bw === 0)])))),
      block("fuente", t("b.font"), [
        row(t("c.typeface"), fontBtn("font.family"), "font.family"),
        cells([[t("c.weight"), sel("font.weight", weightOpts())], [t("c.size"), slider("font.size", 2, 8, 0.1, "%")]], "c-1-13"),
        row(t("c.align"), seg("font.align", [["left", t("al.left")], ["center", t("al.center")], ["right", t("al.right")]], t("c.align")))]),
      block("imagen", t("b.image"), [
        row(t("c.source"), sel("img.src", [...ip.map((p): Opt => [p, pname(p)]), ["none", t("img.none")]], false, sp || "none"), "img.src"),
        row(t("c.position"), seg("img.pos", [["top", t("pos.top")], ["bottom", t("pos.bottom")], ["left", t("pos.left")], ["right", t("pos.right")]], t("c.position"), noImg || fondo), null, { dis: noImg || fondo }),
        row(t("c.fit"), seg("img.fit", [["encajar", t("fit.encajar")], ["original", t("fit.original")], ["enmarcada", t("fit.enmarcada")], ["fondo", t("fit.fondo")]], t("c.fit"), noImg), null, { stk: true, dis: noImg }),
        row(t("c.noImage"), seg("img.empty", [["nada", t("empty.nada")], ["iniciales", t("empty.iniciales")], ["hueco", t("empty.hueco")], ["portada", t("empty.portada")]], t("c.noImageAria"), noImg), null, { stk: true, dis: noImg }),
        im.empty === "portada" && !noImg ? coverCtl(s) : null,
        row(t("c.margin"), slider("img.frame", 0, 14, 0.5, "%", null, noImg || im.fit !== "enmarcada"), "img.frame", { dis: noImg || im.fit !== "enmarcada" }),
        row(t("c.effect"), seg("img.fx", [["color", t("fx.color")], ["bn", t("fx.bn")], ["duo", t("fx.duo")], ["blur", t("fx.blur")], ["inv", t("fx.inv")]], t("c.effect"), noImg), null, { stk: true, dis: noImg }),
        row(t("c.intensity"), slider("img.amt." + fx, 0, 100, 1, "%", 0, noImg || im.fx === "color"), "img.amt." + fx, { dis: noImg || im.fx === "color" }),
        row(t("fx.duo"), [swatch("img.duo1", noImg || im.fx !== "duo"), swatch("img.duo2", noImg || im.fx !== "duo")], null, { dis: noImg || im.fx !== "duo" }),
        row(t("c.grain"), sw("img.grain", t("c.grain"), noImg), "img.grain", { dis: noImg }),
        cells([[t("c.brightness"), slider("img.bright", 20, 140, 1, "%", 0, noImg), noImg],
          [t("c.shade"), [sw("img.shade", t("c.shade"), noImg || !fondo), swatch("img.shadeC", noImg || !fondo || !im.shade)], noImg || !fondo]], "c-1-a")]),
    ));
  }

  /* «Sin imagen: Portada» */
  const coverTextProps = () => propsOf().filter(p => !p.startsWith("rel:") && p !== "file.name" && !facts.isImage(p) && !facts.isUrlProp(p));
  function coverCtl(s: Model) {
    const tp = coverTextProps(), cur = s.img.cvText; if (cur && !tp.includes(cur)) tp.unshift(cur);
    return [row(t("c.bottomText"), sel("img.cvText", [["", t("o.none")], ...tp.map((p): Opt => [p, pname(p)])], false, cur || ""), "img.cvText"),
      row(t("b.colors"), seg("img.cvColors", [["auto", t("cv.auto")], ["card", t("cv.card")]], t("b.colors"))),
      row(t("c.shape"), seg("img.cvShape", [["auto", t("cv.shapeAuto")], ["none", t("cv.shapeNone")]], t("c.shape"))),
      row(t("c.typeface"), fontBtn("img.cvFont"), "img.cvFont")];
  }

  /* ---------- Datos ---------- */
  function visibleItems(s: Model) {
    return s.items.filter(it => textish(it) || (it.kind === "line" && s.lines.on) || (it.kind === "rating" && s.rate.on && s.rate.place === "entre") ||
      (it.kind === "state" && s.states.on && (stateOf(s, it.sid) || {}).place === "entre"));
  }
  const sample = (s: Model, it: Item) => plainSample(s, it, src);
  function linkOpts() {
    const o: (Opt | OptGroup)[] = [["none", t("o.none")], ["note", t("link.note")]];
    const u = urlProps(); if (u.length) o.push({ group: t("link.prop"), items: u.map(p => ["prop:" + p, pname(p)]) });
    return o;
  }
  function typeCtl(s: Model, it: Item, p: string, inFoot: boolean): Kid {
    const tt = it.t, q = p + ".t.";
    switch (it.type) {
      case "texto": return row(t("c.multi"), seg(q + "multi", [["inline", t("multi.inline")], ["lines", t("multi.lines")]], t("c.multi")));
      case "numero": return [row(t("c.numFormat"), seg(q + "nfmt", [["full", fmtNum(12345, "full", 0)], ["short", fmtNum(12345, "short", 1)]], t("c.numFormat"))),
        row(t("c.decimals"), seg(q + "dec", [[0, "0"], [1, "1"], [2, "2"]], t("c.decimals")))];
      case "smart": return [row(t("c.updatesWith"), sel(q + "src", [["spotify", t("smart.spotify")], ["instagram", t("smart.instagram")], ["manual", t("smart.manual")]]), q + "src"),
        row(t("c.short"), sw(q + "short", t("c.short")), q + "short")];
      case "etiquetas": return [row(t("c.tagStyle"), seg(q + "tagStyle", [["fill", t("tag.fill")], ["outline", t("tag.outline")], ["text", t("tag.text")]], t("c.tagStyle"))),
        cells([[t("c.max"), slider(q + "max", 1, 12, 1, "", 0)], [t("c.separator"), txt(q + "tsep", " · ", tt.tagStyle !== "text"), tt.tagStyle !== "text"]], "c-13-1"),
        row(t("c.more"), txt(q + "more", t("ph.more")), q + "more")];
      case "enlace": return [row(t("c.shows"), seg(q + "show", [["value", t("show.value")], ["site", t("show.site")], ["fixed", t("show.fixed")]], t("c.shows")), null, { stk: true }),
        row(t("show.fixed"), txt(q + "fixed", t("ph.fixed"), tt.show !== "fixed"), q + "fixed", { dis: tt.show !== "fixed" }),
        row("↗", sw(q + "arrow", t("c.arrow"), inFoot), q + "arrow", { dis: inFoot })];
      case "notas": {
        const sorts = facts.linkedNumeric(it.prop); if (tt.sort && tt.sort !== "orig" && !sorts.includes(tt.sort)) sorts.unshift(tt.sort);
        return [cells([[t("c.max"), slider(q + "max", 1, 30, 1, "", 0)], [t("c.layout"), seg(q + "nlay", [["lines", t("multi.lines")], ["inline", t("multi.inline")]], t("c.layout"))]], "c-1-125"),
          row(t("c.more"), txt(q + "more", t("ph.more")), q + "more"),
          row(t("c.sortBy"), [sel(q + "sort", [["orig", t("sort.orig")], ...sorts.map((k): Opt => [k, k])]), seg(q + "dir", [["desc", "↓"], ["asc", "↑"]], t("c.direction"), tt.sort === "orig", true)], q + "sort"),
          row(t("c.heading"), [txt(q + "head", ""), swatch(q + "headColor", !tt.head)], q + "head")];
      }
    }
    return null;
  }
  function itemCtl(s: Model, it: Item, p: string, ctx: ListKey, idx: number, list: Item[]): Kid[] {
    const isT = it.kind === "title", foot = ctx === "fitems";
    const prev = list[idx - 1];
    const supDis = isT || foot || !textish(prev);
    const allPlain = !isT && facts.allPlain(it.prop);
    const linkDis = foot || it.type === "enlace" || allPlain;
    const chip = (k: "ital" | "under" | "hl" | "strike" | "sup", label: string, dis?: boolean) => h("button", { cls: "chip" + (dis ? " is-off" : ""), attr: { type: "button", id: fid(p + "." + k), "data-p": p + "." + k, "data-k": "bool", "aria-pressed": String(!!it[k]), disabled: D(dis) } }, label);
    const deco = [chip("ital", t("d.italic")), chip("under", t("d.underline")), h("span", "chipwrap", chip("hl", t("d.highlight")), swatch(p + ".hlc", !it.hl)), chip("strike", t("d.strike")), chip("sup", t("d.sup"), supDis)];
    const isRel = it.prop.startsWith("rel:");
    const typeRow = (!isT && !foot) ? row(t("c.type"), sel(p + ".type", TYPES.map(ty => [ty.id, typeName(ty.id), (ty.id === "enlace" && !isUrlProp(it.prop)) || (isRel && ty.id !== "notas")])), p + ".type") : null;
    const linkCtl = foot || it.type === "enlace" ? h("select", { attr: { disabled: true, "aria-label": t("c.link") } }, h("option", null, pname(it.prop))) : sel(p + ".link", linkOpts(), linkDis);
    const open = ui.open.has("adv:" + it.id);
    const tc = isT ? null : typeCtl(s, it, p, foot);
    const titleRow = isT ? row(t("c.show"), sel(p + ".t.tsrc", [["name", t("ti.name")], ["alias", t("ti.alias")],
      ...coverTextProps().filter(x => x !== "note.aliases").map((x): Opt => [x, pname(x)]), ["none", t("ti.none")]], false, it.t?.tsrc || "name"), p + ".t.tsrc") : null;
    const hoverDis = it.link === "none" && !foot && it.type !== "enlace";
    const adv = h("details", { cls: "adv", attr: { "data-adv": it.id, open: D(open) } }, h("summary", null, h("span", "chev"), t("c.advanced")),
      row(t("c.before"), txt(p + ".before", ""), p + ".before"),
      row(t("c.after"), txt(p + ".after", ""), p + ".after"),
      row(t("c.hide"), txt(p + ".hide", ""), p + ".hide"));
    return [titleRow, typeRow, tc, tc || typeRow || titleRow ? sepH() : null,
      cells([[capR(t("c.typeface"), p + ".font", s.font.family), fontBtn(p + ".font")], [t("c.upper"), sw(p + ".upper", t("c.upper"))]], "c-1-a"),
      row(t("c.color"), tok(p + ".color"), null),
      cells([[capR(t("c.size"), p + ".size", s.font.size), scrub(p + ".size", 1, 24, 0.1, "%")], [capR(t("c.weight"), p + ".weight", s.font.weight), sel(p + ".weight", weightOpts(), false, it.weight == null ? s.font.weight : it.weight)], [t("c.fit1"), sw(p + ".fit", t("c.fit1"))]], "c-1-1-a"),
      cells([[t("c.spaceT"), slider(p + ".spaceT", 0, 8, 0.1, "%")], [t("c.spaceB"), slider(p + ".spaceB", 0, 8, 0.1, "%")]], "c-1-1"),
      row(t("c.decorations"), h("div", "chips", deco), null, { stk: true }),
      cells([[t("c.link"), linkCtl, linkDis], [t("b.hover"), sw(p + ".hover", t("b.hover"), hoverDis), hoverDis]], "c-1-a"),
      adv];
  }
  const grip = (id: string, label: string) => h("button", { cls: "grip", attr: { type: "button", "data-grip": "", "data-id": id, "aria-label": label } }, "⋮⋮");
  const miniCard = (it: Item, ctx: ListKey, cls: string, gripLabel: string, name: string, chipTxt: Kid, sumKids: Kid, extra: Kid) =>
    h("div", { cls: "sc mini" + cls, attr: { "data-id": it.id, "data-list": ctx } }, h("div", "sc-h", grip(it.id, gripLabel),
      h("div", "sc-main", h("span", "sc-name", h("span", "prop", name), chipTxt), sumKids), extra));
  function itemCard(s: Model, it: Item, idx: number, list: Item[], ctx: ListKey, cls: string) {
    const p = ctx + ".#" + it.id;
    if (it.kind === "line") {
      const n = s.items.filter(x => x.kind === "line").indexOf(it) + 1, label = t("i.line", { n });
      return miniCard(it, ctx, cls, t("i.moveLine", { n }), label,
        h("span", { cls: "rule-prev", css: { "--cbp-rule-c": tokCol(s.lines.color, s), "--cbp-rule-w": clamp(s.lines.w, 1, 4) + "px" } }), null,
        h("button", { cls: "ib del", attr: { type: "button", "data-act": "delline", "data-id": it.id, "aria-label": t("i.removeLine", { n }) } }, "✕"));
    }
    if (it.kind === "state") {
      const st = stateOf(s, it.sid)!, smp = stateSample(s, st);
      return miniCard(it, ctx, cls, t("i.moveState", { what: pname(st.prop) }), t("i.state"), h("span", "tchip", pname(st.prop)), h("span", "sc-sum", smp), null);
    }
    if (it.kind === "rating") {
      const e = ents().find(x => rateNode(s, x, facts)); const smp = e ? nodeText(rateNode(s, e, facts)) : "";
      return miniCard(it, ctx, cls, t("i.moveRating"), t("b.rating"), h("span", "tchip", pname(rateProp(s, facts) || "")), h("span", "sc-sum", smp), null);
    }
    const isT = it.kind === "title", key = "it:" + it.id, open = ui.open.has(key);
    const smp = sample(s, it);
    const body = h("div", "sc-b", open ? itemCtl(s, it, p, ctx, idx, list) : null); body.hidden = !open;
    return h("div", { cls: "sc" + cls, attr: { "data-id": it.id, "data-list": ctx, "data-fixed": isT ? "" : null } },
      h("div", "sc-h",
        isT ? h("span", { cls: "grip lock", attr: { "aria-hidden": "true" } }, "🔒︎") : grip(it.id, t("i.move", { what: pname(it.prop) })),
        h("button", { cls: "sc-main", attr: { type: "button", "data-toggle": key, "aria-expanded": String(open) } },
          h("span", "sc-name", h("span", "chev"), h("span", "prop", isT ? t("i.title") : pname(it.prop)), isT ? null : h("span", "tchip", typeName(it.type)), it.sup ? h("span", "tchip", "x²") : null),
          h("span", { cls: "sc-sum", attr: { "data-sum": key } }, sumText(smp))),
        isT ? null : h("button", { cls: "ib del", attr: { type: "button", "data-act": "del", "data-list": ctx, "data-id": it.id, "aria-label": t("i.remove", { what: pname(it.prop) }) } }, "✕")),
      body);
  }
  const sumText = (smp: string | null) => smp ? quote(smp.length > 52 ? smp.slice(0, 51) + "…" : smp) : "—";
  /* se pueden juntar en una línea: datos, y la valoración y los estados colocados «entre los datos» */
  const joinable = (s: Model, it: Item) => textish(it) || (it.kind === "rating" && s.rate.on && s.rate.place === "entre") ||
    (it.kind === "state" && s.states.on && !!stateOf(s, it.sid) && stateOf(s, it.sid)!.place === "entre");
  const jname = (it: Item) => it.kind === "rating" ? t("j.rating") : it.kind === "state" ? t("j.state") : pname(it.prop);
  function listNodes(s: Model, list: Item[], ctx: ListKey) {
    const out: HTMLElement[] = [];
    list.forEach((it, i) => {
      const prev = list[i - 1], next = list[i + 1];
      const joinedUp = i > 0 && ctx === "items" && joinable(s, prev) && joinable(s, it) && (it.join || it.sup);
      const joinedDown = next && ctx === "items" && joinable(s, it) && joinable(s, next) && (next.join || next.sup);
      if (i > 0) {
        if (ctx === "items" && joinable(s, prev) && joinable(s, it)) {
          const gp = "items.#" + it.id + ".gap";
          out.push(joinedUp
            ? h("div", "jn on", h("button", { cls: "chain", attr: { type: "button", "data-act": "join", "data-id": it.id, "aria-pressed": "true", "aria-label": t("j.split", { what: jname(it) }) } }, chain()),
              h("span", "cap", t("c.separator")), seg("items.#" + it.id + ".sep", SEPS.map((x): Opt => [x, x === " " ? t("sep.space") : x]), t("c.separator"), it.sup, true),
              h("div", "jn-sp", h("label", { cls: "cap", attr: { for: fid(gp) } }, t("c.space")), slider(gp, 0, 8, 0.1, "%")))
            : h("div", "jn", h("button", { cls: "chain", attr: { type: "button", "data-act": "join", "data-id": it.id, "aria-pressed": "false", "aria-label": t("j.join", { what: jname(it) }) } }, chain())));
        } else out.push(h("div", "jn gap"));
      }
      out.push(itemCard(s, it, i, list, ctx, (joinedUp ? " j-top" : "") + (joinedDown ? " j-bot" : "")));
    });
    return out;
  }
  function newItem(prop: string, type: string) {
    const it = mkItem(prop, type, {}, type === "smart" ? { src: /follow|seguid/i.test(prop) ? "instagram" : "spotify" } : {});
    if (type === "smart") { const n = netProp(it.t.src); if (n) it.link = "prop:" + n; }
    if (type === "notas") it.t.sort = facts.linkedNumeric(prop)[0] === "listeners" ? "listeners" : "orig";
    return it;
  }
  const previewLine = (rec: Rec | undefined, smp: string | null) => h("div", "pop-prev", smp ? [t("pop.in", { name: rec!.name }) + " ", h("b", null, smp)] : "—");
  function addPopNode(s: Model) {
    const pp = ui.add; if (!pp) return null;
    const tmp = newItem(pp.prop, pp.type);
    const smpRec = ents().find(x => itemContent(s, tmp, x, src) != null);
    const smp = smpRec ? sample(s, tmp) : null;
    return h("div", { cls: "pop", attr: { id: "pop", role: "dialog", "aria-label": t("p.addData") } },
      h("h4", null, t("c.property")),
      h("select", { attr: { id: "popProp", "aria-label": t("c.property") } }, propsOf().map(p => h("option", { attr: { value: p, selected: D(p === pp.prop) } }, pname(p)))),
      h("h4", "mt", t("c.type")),
      h("div", { cls: "types", attr: { role: "group", "aria-label": t("c.type") } }, TYPES.map(ty => h("button", { attr: { type: "button", "data-ptype": ty.id, "aria-pressed": String(ty.id === pp.type),
        disabled: D((ty.id === "enlace" && !isUrlProp(pp.prop)) || (pp.prop.startsWith("rel:") && ty.id !== "notas")) } }, h("span", "ti", ty.ic), typeName(ty.id)))),
      previewLine(smpRec, smp),
      h("div", "pop-act", h("button", { cls: "btn", attr: { type: "button", "data-pop": "cancel" } }, t("p.cancel")), h("button", { cls: "btn primary", attr: { type: "button", "data-pop": "ok" } }, t("p.add"))));
  }
  const freeUrl = (s: Model) => urlProps().filter(p => !s.fitems.some(x => x.prop === p));
  const footItem = (p: string) => mkItem(p, "enlace", { size: 3.2, spaceT: 0.2, spaceB: 0.2, hover: true }, { show: /website|web$/.test(p) ? "value" : "site" });
  function fillFoot(s: Model) { urlProps().filter(p => !s.fitems.some(x => x.prop === p) && !s.items.some(x => x.prop === p)).forEach(p => s.fitems.push(footItem(p))); s.foot.filled = true; }
  function addFootNode(s: Model) {
    const pp = ui.addF; if (!pp) return null;
    const tmp = footItem(pp.prop);
    const e = ents().find(x => itemContent(s, tmp, x, src) != null), smp = e ? sample(s, tmp) : null;
    return h("div", { cls: "pop", attr: { id: "popF", role: "dialog", "aria-label": t("p.addLink") } }, h("h4", null, t("c.property")),
      h("select", { attr: { id: "footProp", "aria-label": t("c.property") } }, freeUrl(s).map(p => h("option", { attr: { value: p, selected: D(p === pp.prop) } }, pname(p)))),
      previewLine(e, smp),
      h("div", "pop-act", h("button", { cls: "btn", attr: { type: "button", "data-popf": "cancel" } }, t("p.cancel")), h("button", { cls: "btn primary", attr: { type: "button", "data-popf": "ok" } }, t("p.add"))));
  }
  function datosNode(s: Model) {
    return h("section", "grp", h("div", "grp-h", h("h3", null, t("g.data"))), h("div", { cls: "lbox", attr: { "data-listbox": "items" } },
      h("div", { cls: "dlist", attr: { id: "dlist" } }, listNodes(s, visibleItems(s), "items")),
      h("div", "addwrap", h("button", { cls: "add", attr: { type: "button", id: "addBtn", "aria-expanded": String(!!ui.add) } }, t("p.addDataBtn")), addPopNode(s))));
  }

  /* ---------- Decoraciones ---------- */
  function placeCtl(base: string, s: Model) {
    const path = base + ".place", v = getP(path), pts = ["tl", "tc", "tr", "ml", "mc", "mr", "bl", "bc", "br"];
    const sp = imgSrc(s, facts), canImg = !!sp && s.img.fit !== "fondo";
    return [row(t("c.placement"), h("div", "place",
      h("button", { cls: "btn tog", attr: { type: "button", id: fid(path + "=entre"), "data-p": path, "data-k": "seg", "data-v": "entre", "data-vt": "string", "aria-pressed": String(v === "entre") } }, t("place.entre")),
      h("div", { cls: "pts", attr: { role: "group", "aria-label": t("place.where") } }, pts.map(k => h("button", { attr: { type: "button", id: fid(path + "=" + k), "data-p": path, "data-k": "seg", "data-v": k, "data-vt": "string", "aria-pressed": String(v === k), "aria-label": t("pt." + k) } }))),
      swl(base + ".onImg", t("place.onImg"), v === "entre" || !canImg)), null),
    cells([[t("c.mx"), slider(base + ".mx", 0, 20, 0.5, "%", null, v === "entre"), v === "entre"], [t("c.my"), slider(base + ".my", 0, 20, 0.5, "%", null, v === "entre"), v === "entre"]], "c-1-1")];
  }
  /* ---------- Estados ---------- */
  const boolProps = () => facts.boolProps();
  function stateSample(s: Model, st: State | undefined): string {
    if (!st) return "";
    const e = ents().find(x => stateNode(s, st, x)); if (!e) return "—";
    return st.fmt === "icon" ? st.icon : st.fmt === "dot" ? "●" : nodeText(stateNode(s, st, e));
  }
  function stateCtl(s: Model, st: State, p: string): Kid[] {
    const bp = boolProps().slice(); if (st.prop && !bp.includes(st.prop)) bp.unshift(st.prop);
    const fr = framed(st), noTxt = st.fmt === "icon" || st.fmt === "dot", pill = st.fmt === "pill";
    return [row(t("c.property"), sel(p + ".prop", bp.length ? bp.map((x): Opt => [x, pname(x)]) : [["", "—"]], !bp.length), p + ".prop"),
      row(t("c.visible"), seg(p + ".show", [["yes", t("show.yes")], ["no", t("show.no")], ["always", t("show.always")]], t("c.visible"), st.fmt === "check")),
      cells([[t("c.textYes"), txt(p + ".yes", "", noTxt), noTxt], [t("c.textNo"), txt(p + ".no", "", noTxt), noTxt]], "c-1-1"),
      row(t("c.format"), seg(p + ".fmt", ST_FMTS.map((f): Opt => [f, t("stf." + f)]), t("c.format")), null, { stk: true }),
      st.fmt === "icon" ? row(t("stf.icon"), seg(p + ".icon", ST_ICONS.map((i): Opt => [i, i]), t("stf.icon"))) : null,
      st.fmt === "check" ? cells([[t("c.thickness"), slider(p + ".bw", 1, 4, 0.5, "px")], [t("c.roundness"), slider(p + ".radius", 0, 20, 1, "px", 0)]], "c-1-1") : null,
      fr ? [row(t("c.frame"), seg(p + ".frame", [["fill", t("frame.fill")], ["border", t("frame.border")], ["both", t("frame.both")]], t("c.frame"))),
        cells([[t("c.thickness"), slider(p + ".bw", 0, 6, 0.5, "px", null, st.frame === "fill"), st.frame === "fill"], [t("c.roundness"), slider(p + ".radius", 0, 20, 1, "px", 0, pill), pill]], "c-1-1"),
        row(t("c.padding"), slider(p + ".pad", 0, 2, 0.05, "em"), p + ".pad")] : null,
      row(t("c.color"), tok(p + ".color"), null),
      row(t("c.background"), color(p + ".bg", !fr || st.frame === "border"), p + ".bg", { dis: !fr || st.frame === "border" }),
      sepH(),
      cells([[capR(t("c.typeface"), p + ".font", s.font.family), fontBtn(p + ".font")], [t("c.upper"), sw(p + ".upper", t("c.upper"))]], "c-1-a"),
      cells([[capR(t("c.size"), p + ".size", s.font.size), scrub(p + ".size", 1, 24, 0.1, "%")], [capR(t("c.weight"), p + ".weight", s.font.weight), sel(p + ".weight", weightOpts(), false, st.weight == null ? s.font.weight : st.weight)]], "c-1-1"),
      sepH(), placeCtl(p, s)];
  }
  function stateCard(s: Model, st: State) {
    const p = "states.list.#" + st.id, key = "st:" + st.id, open = ui.open.has(key), smp = stateSample(s, st);
    const body = h("div", "sc-b", open ? stateCtl(s, st, p) : null); body.hidden = !open;
    return h("div", { cls: "sc", attr: { "data-sid": st.id } }, h("div", "sc-h",
      h("button", { cls: "sc-main", attr: { type: "button", "data-toggle": key, "aria-expanded": String(open) } },
        h("span", "sc-name", h("span", "chev"), h("span", "prop", st.prop ? pname(st.prop) : "—"), h("span", "tchip", t("stf." + st.fmt))),
        h("span", { cls: "sc-sum", attr: { "data-sum": key } }, smp ? quote(smp) : "—")),
      h("button", { cls: "ib del", attr: { type: "button", "data-act": "delst", "data-id": st.id, "aria-label": t("i.removeState", { what: pname(st.prop) }) } }, "✕")),
    body);
  }
  function addState() {
    const s = S(); snapshot(); lastPath = "";
    const used = new Set(s.states.list.map(x => x.prop)), bp = boolProps();
    const prop = bp.find(x => !used.has(x)) || bp[0] || "";
    const st = mkState(prop, prop ? { yes: prop.replace(/^(note|formula)\./, "").toUpperCase() } : {});
    s.states.list.push(st); s.states.on = true; syncStruct(s);
    ui.open.add("estados"); ui.open.add("st:" + st.id);
    renderPanel(); preview();
    const b = pb.querySelector<HTMLElement>('[data-toggle="st:' + st.id + '"]'); if (b) { b.focus(); b.scrollIntoView({ block: "nearest" }); }
  }
  function decoNode(s: Model) {
    const f = s.foot, r = s.rate, L = s.lines, hv = s.hover;
    const rpv = rateProp(s, facts), rp = rateProps().concat(rpv && !rateProps().includes(rpv) ? [rpv] : []);
    const states: HTMLElement[] = []; s.states.list.forEach((st, i) => { if (i) states.push(h("div", "jn gap")); states.push(stateCard(s, st)); });
    return h("section", "grp", h("div", "grp-h", h("h3", null, t("g.decorations"))), h("div", "stack",
      block("pie", t("b.footer"), [
        cells([[t("c.background"), color("foot.bg")], [t("c.topLine"), [slider("foot.lw", 0, 6, 1, "px", 0), swatch("foot.lc", f.lw === 0)]]], "c-1-115"),
        h("div", "sub-h", t("c.links")),
        h("div", { cls: "lbox", attr: { "data-listbox": "fitems" } }, h("div", { cls: "dlist", attr: { id: "flist" } }, listNodes(s, s.fitems, "fitems")),
          h("div", "addwrap", h("button", { cls: "add", attr: { type: "button", id: "addFBtn", "aria-expanded": String(!!ui.addF), disabled: D(!freeUrl(s).length) } }, t("p.addLinkBtn")), addFootNode(s)))],
        { sw: "foot.on", off: !f.on }),
      block("valoracion", t("b.rating"), [
        row(t("c.property"), sel("rate.prop", rp.length ? rp.map((p): Opt => [p, pname(p)]) : [["auto", "—"]], !rp.length, rpv || "auto"), "rate.prop"),
        row(t("c.type"), seg("rate.type", [["stars", t("rate.stars")], ["score", t("rate.score")], ["faces", t("rate.faces")]], t("c.type"))),
        row(t("c.size"), slider("rate.size", 2, 12, 0.1, "%"), "rate.size"),
        row(t("c.color"), tok("rate.color", r.type !== "stars" && r.byVal), null, { dis: r.type !== "stars" && r.byVal }),
        r.type === "stars" ? row(t("c.showEmpty"), sw("rate.empty", t("c.showEmpty")), "rate.empty") : null,
        r.type === "score" ? [row(t("c.outOf"), h("input", { cls: "cbp-int", attr: { type: "text", id: fid("rate.over"), "data-p": "rate.over", "data-k": "int", value: r.over, inputmode: "numeric" } }), "rate.over"),
          row(t("c.shape"), seg("rate.shape", [["bubble", t("rate.bubble")], ["square", t("rate.square")]], t("c.shape"))),
          row(t("c.byValue"), sw("rate.byVal", t("c.byValue")), "rate.byVal")] : null,
        r.type === "faces" ? [row(t("rate.faces"), seg("rate.fill", [["filled", t("rate.filled")], ["outline", t("rate.outline")]], t("rate.faces"))),
          row(t("c.byValue"), sw("rate.byVal", t("c.byValue")), "rate.byVal")] : null,
        sepH(), placeCtl("rate", s)],
        { sw: "rate.on", off: !r.on }),
      block("estados", t("b.states"), [
        h("div", "dlist", states),
        h("div", "addwrap", h("button", { cls: "add", attr: { type: "button", id: "addSBtn", disabled: D(!boolProps().length && !s.states.list.length) } }, t("p.addStateBtn")))],
        { sw: "states.on", off: !s.states.on }),
      block("lineas", t("b.lines"), [
        row(t("c.howMany"), seg("lines.n", [[1, "1"], [2, "2"], [3, "3"], [4, "4"]], t("c.howMany"))),
        row(t("c.color"), tok("lines.color"), null),
        row(t("c.thickness"), slider("lines.w", 1, 12, 1, "px", 0), "lines.w"),
        cells([[t("c.spaceT"), slider("lines.mt", 0, 8, 0.1, "%")], [t("c.spaceB"), slider("lines.mb", 0, 8, 0.1, "%")]], "c-1-1"),
        row(t("c.width"), seg("lines.width", [["full", t("lw.full")], ["content", t("lw.content")], ["pct", "%"]], t("c.width")), null),
        row("", slider("lines.pct", 5, 100, 1, "%", 0, L.width !== "pct"), "lines.pct", { dis: L.width !== "pct" })],
        { sw: "lines.on", off: !L.on }),
      block("hover", t("b.hover"), [
        row(t("c.color"), tok("hover.color"), null),
        row(t("c.background"), [swatch("hover.bg"), slider("hover.bgOp", 0, 100, 1, "%", 0)], "hover.bgOp"),
        row(t("d.underline"), sw("hover.under", t("d.underline")), "hover.under")],
        { sw: "hover.on", off: !hv.on })));
  }
  function cssNode(s: Model) {
    return h("section", "grp", h("div", "stack",
      block("css", t("b.css"), h("textarea", { attr: { id: "cbp-css", "data-p": "css", "data-k": "txt", spellcheck: "false", "aria-label": t("b.css") } }, s.css))));
  }

  /* ---------- todo el panel ---------- */
  function renderPanel() {
    const st = pb.scrollTop, s = S(), act = document.activeElement, aid = act && root.contains(act) && act.id;
    pb.empty();
    pb.append(tarjetaNode(s), datosNode(s), decoNode(s), cssNode(s));
    fitToggles();
    if (animTgl) {
      const b = byId(animTgl); animTgl = null;
      if (b) window.requestAnimationFrame(() => window.requestAnimationFrame(() => b.setAttribute("aria-checked", b.dataset.v!)));
    }
    pb.scrollTop = st;
    if (aid) { const el = byId(aid); if (el && el !== document.activeElement) el.focus({ preventScroll: true }); }
    updateSums();
  }
  const FMT_L = Object.fromEntries(FMTS);
  function setSum(key: string, kids: Kid) { const el = pb.querySelector('[data-sum="' + key + '"]'); if (el) { el.empty(); append(el, [kids]); } }
  function updateSums() {
    const s = S(), c = s.card, im = s.img, sp = imgSrc(s, facts);
    setSum("tamano", c.w + " px · " + (FMT_L[c.fmt] || t("fmt.free")).toUpperCase());
    setSum("colores", (["bg", "text", "det"] as const).map(k => h("span", { cls: "dot", css: { "--cbp-dot": s.col[k] } })));
    setSum("fuente", fontLabel(fontName(s.font.family)) + " · " + s.font.weight);
    setSum("imagen", !sp ? t("sum.noImage") : pname(sp) + " · " + t("fit." + im.fit).toLowerCase() + (im.fit === "fondo" ? "" : " · " + t("pos." + im.pos).toLowerCase()));
    setSum("pie", t(s.fitems.length === 1 ? "sum.link1" : "sum.links", { n: s.fitems.length }));
    setSum("valoracion", t("rate." + s.rate.type).toLowerCase());
    setSum("estados", s.states.list.length ? t(s.states.list.length === 1 ? "sum.state1" : "sum.states", { n: s.states.list.length }) : "");
    s.states.list.forEach(st => { const x = stateSample(s, st); setSum("st:" + st.id, x ? quote(x) : "—"); });
    setSum("lineas", String(s.lines.n));
    setSum("css", s.css.trim() ? t("sum.cssLines", { n: s.css.trim().split("\n").length }) : "");
    pb.querySelectorAll<HTMLElement>("[data-fill]").forEach(f => { setVars(f, { "--cbp-fill": tokCol(getP(f.dataset.fill!), s) }); });
    pb.querySelectorAll<HTMLInputElement>("input.hex").forEach(hx => { if (document.activeElement !== hx) hx.value = getP(hx.dataset.p!) as string; });
    syncTiles(); syncMini();
    s.items.concat(s.fitems).forEach(it => { if (textish(it)) setSum("it:" + it.id, sumText(sample(s, it))); });
    undoBtn.disabled = !hist.length;
  }
  /* tamaños que solo cambian variables de la rejilla (arrastrar): sin repintar las tarjetas, que va lento con muchas */
  const LIVE = new Set(["card.w", "card.h", "card.gap", "card.pad", "card.radius", "col.bw"]);
  let liveRaf = 0;
  function commitLive(path: string, val: unknown) {
    if (!LIVE.has(path)) { commit(path, val); return; }
    pushFor(path); setP(path, val);
    window.cancelAnimationFrame(liveRaf); liveRaf = window.requestAnimationFrame(() => { view.restyle(model); liveSums(); });
  }
  function liveSums() {
    const c = S().card;
    setSum("tamano", c.w + " px · " + (FMT_L[c.fmt] || t("fmt.free")).toUpperCase());
    syncTiles(); syncMini(); undoBtn.disabled = !hist.length;
  }
  function commit(path: string, val: unknown, re?: boolean) { pushFor(path); const old = getP(path); setP(path, val); afterChange(path, old); preview(); re ? renderPanel() : updateSums(); }
  function afterChange(path: string, old?: unknown) {
    const s = S();
    /* portada: el texto de abajo empieza con el autor, el director o el año, si la vista los tiene */
    if (path === "img.empty" && s.img.empty === "portada" && s.img.cvText == null)
      s.img.cvText = ["author", "autor", "director", "creator", "artist", "year", "año"].map(n => "note." + n).find(p => coverTextProps().includes(p)) || "";
    /* estado: si el texto era el nombre de la propiedad (el que pone «+ Añadir estado»), sigue a la nueva */
    const ms = /^states\.list\.#([^.]+)\.prop$/.exec(path);
    if (ms) { const st = stateOf(s, ms[1]), up = (x: string | null | undefined) =>
 String(x || "").replace(/^(note|formula)\./, "").toUpperCase(); if (st && old != null && st.yes === up(old as string)) st.yes = up(st.prop); }
    if (path === "lines.n") syncStruct(s);
    if (path === "lines.on" && s.lines.on) ui.open.add("lineas");
    const m = /^items\.#([^.]+)\.(sup|t\.src|type)$/.exec(path);
    if (m) {
      const it = s.items.find(x => x.id === m[1]); if (!it) return;
      if (m[2] === "sup" && it.sup) it.join = true;
      if (m[2] === "t.src") { const n = netProp(it.t.src); if (n) it.link = "prop:" + n; }
      if (m[2] === "type") {
        if (it.type === "notas") it.link = "note"; else if (it.type === "enlace") it.link = "self"; else if (it.link === "self") it.link = "none";
        if (it.type === "smart" && it.t.src === "manual") { it.t.src = /follow|seguid/i.test(it.prop) ? "instagram" : "spotify"; afterChange("items.#" + it.id + ".t.src"); }
      }
    }
  }

  /* ---------- eventos ---------- */
  pb.addEventListener("input", ev => {
    const el = (ev.target as HTMLInputElement), p = el.dataset.p; if (!p) return;
    switch (el.dataset.k) {
      case "num": { const v = parseFloat(el.value); const o = pb.querySelector('[data-out="' + CSS.escape(p) + '"]'); if (o) { o.empty(); append(o, outTxt(v, el.dataset.unit, el.dataset.d === "" ? null : +el.dataset.d!)); } commit(p, v); break; }
      case "txt": commit(p, el.value); break;
      case "hex": { const v = el.value.trim(); if (/^#([0-9a-f]{6}|[0-9a-f]{8})$/i.test(v)) commit(p, v.toLowerCase()); break; }
      case "int": { const v = parseInt(el.value, 10); if (v > 0) commit(p, v); break; }
      case "scrub": el.dataset.dirty = "1"; break;       // se está escribiendo un número
    }
  });
  pb.addEventListener("change", ev => {
    const el = (ev.target as HTMLInputElement);
    if (el.id === "popProp") { ui.add!.prop = el.value; ui.add!.type = okType(el.value, facts.guessType(el.value)); refreshPop(); return; }
    if (el.id === "footProp") { ui.addF!.prop = el.value; refreshPopF(); return; }
    const p = el.dataset.p; if (!p) return;
    const k = el.dataset.k;
    if (k === "sel") { const v = el.value === "" ? null : el.dataset.num && /^\d+$/.test(el.value) ? +el.value : el.value; commit(p, v, true); }
    if (k === "num" || k === "int") renderPanel();
    if (k === "hex") el.value = getP(p) as string;
    if (k === "scrub") {
      delete el.dataset.dirty;
      const raw = el.value.replace(",", ".").trim(), n = parseFloat(raw);
      commit(p, raw === "" || !isFinite(n) ? null : clamp(n, +el.dataset.min!, +el.dataset.max!), true);
    }
  });
  pb.addEventListener("keydown", ev => {
    const el = (ev.target as HTMLElement);
    if (el.dataset && el.dataset.k === "scrub" && (ev.key === "ArrowUp" || ev.key === "ArrowDown")) {
      ev.preventDefault(); const s = S(), st = +el.dataset.step! * (ev.shiftKey ? 10 : 1);
      const v = (getP(el.dataset.p!) as number | null) ?? s.font.size; const n = clamp(+(v + (ev.key === "ArrowUp" ? st : -st)).toFixed(2), +el.dataset.min!, +el.dataset.max!);
      commit(el.dataset.p!, n); (el as HTMLInputElement).value = numTxt(el as HTMLInputElement, n);
    }
    if (el.dataset && el.dataset.gap) {
      const by = ev.key === "ArrowRight" || ev.key === "ArrowUp" ? 1 : ev.key === "ArrowLeft" || ev.key === "ArrowDown" ? -1 : 0;
      if (by) { ev.preventDefault(); commit("card.gap", clamp(S().card.gap + by * (ev.shiftKey ? 10 : 1), 0, GAP_MAX)); syncGap(); }
    }
    if (el.dataset && el.dataset.k === "scrub" && ev.key === "Enter") el.blur();
    if (el.matches && el.matches("[data-grip]") && (ev.key === "ArrowUp" || ev.key === "ArrowDown")) { ev.preventDefault(); moveItem((el.closest(".sc") as HTMLElement).dataset.list as ListKey, el.dataset.id!, ev.key === "ArrowUp" ? -1 : 1); }
  });
  pb.addEventListener("toggle", ev => { const d = (ev.target as HTMLDetailsElement); if (!d.dataset || !d.dataset.adv) return; const k = "adv:" + d.dataset.adv; d.open ? ui.open.add(k) : ui.open.delete(k); }, true);
  pb.addEventListener("click", ev => {
    const b = ((ev.target as HTMLElement).closest("button") as HTMLButtonElement); if (!b || b.disabled) return;
    if (b.dataset.toggle) {
      const k = b.dataset.toggle, open = !ui.open.has(k);
      open ? ui.open.add(k) : ui.open.delete(k);
      if (k.startsWith("it:") || k.startsWith("st:")) { renderPanel(); return; }     // los ajustes de un dato o un estado se pintan al abrirlo
      b.setAttribute("aria-expanded", String(open));
      const body = (b.closest(".blk,.sc")!.querySelector(":scope > .blk-b, :scope > .sc-b") as HTMLElement); body.hidden = !open;
      if (open) fitToggles();                          // en un bloque cerrado no se puede medir: al abrirlo
      return;
    }
    const p = b.dataset.p;
    if (p) {
      const k = b.dataset.k;
      if (k === "seg") { const v = b.dataset.vt === "number" ? +b.dataset.v! : b.dataset.v; commit(p, v, true); }
      else if (k === "bool") {
        const v = !getP(p);
        if (b.classList.contains("tgl")) animTgl = b.id;
        if (p === "foot.on" && v && !S().foot.filled) { const s = S(); snapshot(); lastPath = ""; fillFoot(s); s.foot.on = true; ui.open.add("pie"); preview(); renderPanel(); return; }
        if (/^(foot|rate|states|lines|hover)\.on$/.test(p) && v) ui.open.add(({ foot: "pie", rate: "valoracion", states: "estados", lines: "lineas", hover: "hover" } as Record<string, string>)[p.split(".")[0]]);
        if (/\.sup$/.test(p) && !v) setP(p.replace(/sup$/, "join"), false);
        commit(p, v, true);
      }
      else if (k === "tok") {
        if (b.dataset.v === "own") {
          const v0 = getP(p); if (v0 === "tx" || v0 === "det") commit(p, hex6(tokCol(v0, S())), true);
          const swb = byId(fid(p) + "-sw"); if (swb) openPicker(p, swb);
        } else commit(p, b.dataset.v, true);
      }
      else if (k === "pick") { if (ui.fp && ui.fp.anchorId === b.id) closeFp(); else openPicker(p, b); }
      else if (k === "font") { if (ui.fp && ui.fp.anchorId === b.id) closeFp(); else openFonts(p, b); }
      else if (k === "reset") commit(p, null, true);
      return;
    }
    if (b.dataset.act === "join") { joinToggle(b.dataset.id!); return; }
    if (b.dataset.act === "delst") { const s = S(); snapshot(); lastPath = ""; s.states.list = s.states.list.filter(x => x.id !== b.dataset.id); syncStruct(s); renderPanel(); preview(); return; }
    if (b.id === "addSBtn") { addState(); return; }
    if (b.dataset.act === "del") { delItem(b.dataset.list as ListKey, b.dataset.id!); return; }
    if (b.dataset.act === "delline") { const s = S(); snapshot(); lastPath = ""; s.items = s.items.filter(x => x.id !== b.dataset.id); s.lines.n = Math.max(0, s.lines.n - 1); if (!s.lines.n) { s.lines.n = 1; s.lines.on = false; syncStruct(s); } renderPanel(); preview(); return; }
    if (b.id === "addBtn") { ui.add ? closeAdd() : openAdd(); return; }
    if (b.dataset.ptype) { ui.add!.type = b.dataset.ptype; refreshPop(); return; }
    if (b.dataset.pop === "cancel") { closeAdd(); $("#addBtn").focus(); return; }
    if (b.dataset.pop === "ok") { addItem(); return; }
    if (b.id === "addFBtn") { if (ui.addF) closeAddF(); else { ui.addF = { prop: freeUrl(S())[0] }; renderPanel(); const pf = $("#popF"); if (pf) { pf.scrollIntoView({ block: "nearest" }); $("#footProp").focus(); } } return; }
    if (b.dataset.popf === "cancel") { closeAddF(); $("#addFBtn").focus(); return; }
    if (b.dataset.popf === "ok") { const s = S(); snapshot(); lastPath = ""; const it = footItem(ui.addF!.prop); if (s.fitems[0]) it.color = s.fitems[0].color; s.fitems.push(it); s.foot.filled = true; ui.addF = null; renderPanel(); preview(); return; }
  });
  /* arrastrar en horizontal sobre un número para cambiarlo */
  let scrubMoved = false;
  /* (también los tiles de SIZE, enteros: en horizontal o en vertical, con su ritmo; y el GAP) */
  const numTxt = (el: HTMLInputElement, n: number) => fmt(n) + (el.dataset.tight ? "" : " ") + el.dataset.unit;
  pb.addEventListener("pointerdown", ev => {
    const tg = ev.target as HTMLElement;
    if (tg.closest(".gapc")) { gapDrag(ev); return; }
    const el = (tg.closest("input.num") || tg.closest(".tile")?.querySelector("input.num")) as HTMLInputElement | null;
    if (!el || el.disabled || document.activeElement === el) return;
    const sx = ev.clientX, sy = ev.clientY, p = el.dataset.p!, s = S(), y = el.dataset.axis === "y";
    const start = (getP(p) as number | null) ?? s.font.size, step = +el.dataset.step!, rate = +(el.dataset.rate || 0) || step / 3;
    let moved = false; scrubMoved = false;
    const mv = (e: PointerEvent) => {
      const d = y ? e.clientY - sy : e.clientX - sx;
      if (!moved && Math.abs(d) < 4) return;
      if (!moved) { moved = true; scrubMoved = true; document.body.addClass(y ? "cb-scrubbing-y" : "cb-scrubbing"); }
      e.preventDefault();
      const n = clamp(+(start + Math.round(d * rate / step) * step).toFixed(2), +el.dataset.min!, +el.dataset.max!);
      commitLive(p, n); el.value = numTxt(el, n);
    };
    const up = () => { document.removeEventListener("pointermove", mv); document.removeEventListener("pointerup", up); document.body.removeClass("cb-scrubbing", "cb-scrubbing-y"); if (moved) { preview(); renderPanel(); } };
    document.addEventListener("pointermove", mv); document.addEventListener("pointerup", up);
    ev.preventDefault();
  });
  function gapDrag(ev: PointerEvent) {
    const el = ev.target instanceof HTMLElement ? ev.target.closest<HTMLElement>(".gapc") : null; if (!el) return;
    const sx = ev.clientX, start = S().card.gap;
    let moved = false;
    el.focus(); el.addClass("is-drag");
    const mv = (e: PointerEvent) => {
      const d = e.clientX - sx;
      if (!moved && Math.abs(d) < 3) return;
      if (!moved) { moved = true; document.body.addClass("cb-scrubbing"); }
      e.preventDefault();
      commitLive("card.gap", clamp(Math.round(start + d), 0, GAP_MAX)); syncGap();
    };
    const up = () => { document.removeEventListener("pointermove", mv); document.removeEventListener("pointerup", up); document.body.removeClass("cb-scrubbing"); el.removeClass("is-drag"); if (moved) preview(); };
    document.addEventListener("pointermove", mv); document.addEventListener("pointerup", up);
    ev.preventDefault();
  }
  pb.addEventListener("click", ev => {
    const tg = ev.target as HTMLElement;
    const el = (tg.closest("input.num") || tg.closest(".tile")?.querySelector("input.num")) as HTMLInputElement | null;
    if (!el || el.disabled) return; if (scrubMoved) { scrubMoved = false; return; } el.focus(); el.select();
  });

  function joinToggle(id: string) {
    const s = S(), it = s.items.find(x => x.id === id); if (!it) return;
    snapshot(); lastPath = "";
    if (it.join || it.sup) { it.join = false; it.sup = false; } else { it.join = true; if (it.sep == null) it.sep = "·"; if (it.gap == null) it.gap = 1; }
    renderPanel(); preview();
    const b = (pb.querySelector('[data-act="join"][data-id="' + id + '"]') as HTMLElement); if (b) b.focus();
  }
  function delItem(list: ListKey, id: string) {
    const s = S(), arr = s[list], i = arr.findIndex(x => x.id === id); if (i < 0) return;
    snapshot(); lastPath = "";
    const [m] = arr.splice(i, 1);
    renderPanel(); preview(); toast(t("toast.removed", { what: pname(m.prop) }), true);
  }
  function moveItem(list: ListKey, id: string, dir: number) {
    const s = S(), arr = s[list];
    const vis = list === "items" ? visibleItems(s) : arr;
    const vi = vis.findIndex(x => x.id === id), ti = vi + dir;
    if (vi < 0 || ti < 0 || ti >= vis.length) return;
    snapshot(); lastPath = "";
    const target = vis[ti]; const from = arr.findIndex(x => x.id === id); const [m] = arr.splice(from, 1);
    let to = arr.findIndex(x => x.id === target.id); if (dir > 0) to++;
    arr.splice(to, 0, m);
    renderPanel(); preview();
    const g = (pb.querySelector('[data-grip][data-id="' + id + '"]') as HTMLElement); if (g) g.focus();
  }
  function openAdd() {
    const s = S(), used = new Set(s.items.map(x => x.prop));
    const all = propsOf();
    const free = all.find(p => !used.has(p) && !facts.isImage(p) && facts.values(p).length) || all[0];
    if (!free) return;
    ui.add = { prop: free, type: okType(free, facts.guessType(free)) };
    renderPanel(); const pop = $("#pop"); pop.scrollIntoView({ block: "nearest" }); $("#popProp").focus();
  }
  function closeAdd() { ui.add = null; const pop = $("#pop"); if (pop) pop.remove(); const a = $("#addBtn"); if (a) a.setAttribute("aria-expanded", "false"); }
  function closeAddF() { ui.addF = null; const pf = $("#popF"); if (pf) pf.remove(); const a = $("#addFBtn"); if (a) a.setAttribute("aria-expanded", "false"); }
  function refreshPopF() { const pf = $("#popF"); if (pf) pf.replaceWith(addFootNode(S())!); }
  function refreshPop() { const pop = $("#pop"); if (pop) pop.replaceWith(addPopNode(S())!); }
  function addItem() {
    const pp = ui.add!, s = S(); snapshot(); lastPath = "";
    const it = newItem(pp.prop, pp.type);
    const lastText = s.items.map(x => textish(x)).lastIndexOf(true);
    s.items.splice(lastText + 1, 0, it);
    ui.open.add("it:" + it.id); ui.add = null;
    renderPanel(); preview();
    const el = pb.querySelector('.sc[data-id="' + it.id + '"]'); if (el) { el.scrollIntoView({ block: "nearest" }); (el.querySelector(".sc-main") as HTMLElement).focus(); }
  }

  /* arrastrar para ordenar (y pasar un dato con URL entre Datos y Pie) */
  let drag: { id: string; list: ListKey } | null = null;
  pb.addEventListener("pointerdown", ev => { const g = (ev.target as HTMLElement).closest("[data-grip]"); if (g) (g.closest(".sc") as HTMLElement).draggable = true; });
  pb.addEventListener("dragstart", ev => { const c = ((ev.target as HTMLElement).closest(".sc[data-id]") as HTMLElement); if (!c || c.dataset.fixed !== undefined) return; drag = { id: c.dataset.id!, list: c.dataset.list as ListKey }; c.addClass("dragging"); ev.dataTransfer!.effectAllowed = "move"; try { ev.dataTransfer!.setData("text/plain", drag.id); } catch { /* algunos sistemas no dejan */ } });
  function canMove(id: string, from: ListKey, to: ListKey) { if (from === to) return true; const it = S()[from].find(x => x.id === id); return !!it && it.kind === "dato" && isUrlProp(it.prop); }
  function clearDrop() { pb.querySelectorAll(".drop-before,.drop-after,.drop-into").forEach(x => x.classList.remove("drop-before", "drop-after", "drop-into")); }
  pb.addEventListener("dragover", ev => {
    if (!drag) return; clearDrop();
    const lb = ((ev.target as HTMLElement).closest("[data-listbox]") as HTMLElement); if (!lb) return;
    const to = lb.dataset.listbox as ListKey; if (!canMove(drag.id, drag.list, to)) return;
    ev.preventDefault();
    const c = ((ev.target as HTMLElement).closest(".sc[data-id]") as HTMLElement);
    if (c && c.dataset.id !== drag.id) {
      const r = c.getBoundingClientRect(), before = ev.clientY < r.top + r.height / 2;
      c.addClass(before ? "drop-before" : "drop-after");
    } else if (!c && to !== drag.list) lb.addClass("drop-into");
  });
  pb.addEventListener("drop", ev => {
    if (!drag) return;
    const dg = drag;
    const lb = ((ev.target as HTMLElement).closest("[data-listbox]") as HTMLElement); if (!lb) { drag = null; clearDrop(); return; }
    const to = lb.dataset.listbox as ListKey; if (!canMove(dg.id, dg.list, to)) return;
    ev.preventDefault();
    const c = (pb.querySelector(".drop-before,.drop-after") as HTMLElement), into = lb.classList.contains("drop-into");
    if (!c && !into) { drag = null; clearDrop(); return; }
    const s = S(), srcList = s[dg.list], dst = s[to]; snapshot(); lastPath = "";
    const [m] = srcList.splice(srcList.findIndex(x => x.id === dg.id), 1);
    const idx = c ? dst.findIndex(x => x.id === c.dataset.id) + (c.classList.contains("drop-before") ? 0 : 1) : (to === "items" ? dst.map(textish).lastIndexOf(true) + 1 : dst.length);
    if (to !== dg.list) {
      m.join = false; m.sup = false;
      if (to === "fitems") { m.type = "enlace"; m.link = "self"; s.foot.on = true; s.foot.filled = true; ui.open.add("pie"); }
    }
    dst.splice(idx, 0, m); drag = null; clearDrop(); renderPanel(); preview();
  });
  pb.addEventListener("dragend", () => { drag = null; clearDrop(); pb.querySelectorAll(".sc").forEach(x => { (x as HTMLElement).draggable = false; x.classList.remove("dragging"); }); });

  /* ---------- ventanitas flotantes (menús, fuentes, color) ---------- */
  function placeFp(anchor: HTMLElement | null) {
    if (!anchor || !anchor.isConnected) return;
    const r = anchor.getBoundingClientRect(), w = fp.offsetWidth, hh = fp.offsetHeight;
    const left = clamp(r.left, 8, innerWidth - w - 8); let top = r.bottom + 6;
    if (top + hh > innerHeight - 8) top = Math.max(8, r.top - hh - 6);
    setVars(fp, { "--cbp-fp-x": left + "px", "--cbp-fp-y": top + "px" });
  }
  function openFp(kind: string, anchor: HTMLElement, node: Node, data?: Partial<Fp>) {
    closeFp();
    ui.fp = Object.assign({ kind, anchorId: anchor.id }, data || {});
    fp.append(node); fp.hidden = false; anchor.setAttribute("aria-expanded", "true");
    placeFp(anchor);
  }
  function closeFp() {
    if (!ui.fp) return;
    const a = byId(ui.fp.anchorId); if (a) a.setAttribute("aria-expanded", "false");
    ui.fp = null; fp.hidden = true; fp.empty();
  }
  pb.addEventListener("scroll", () => { if (ui.fp) { const a = byId(ui.fp.anchorId); a ? placeFp(a) : closeFp(); } });
  const onResize = () => { if (ui.fp) { const a = byId(ui.fp.anchorId); if (a) placeFp(a); } };
  const onMouseDown = (ev: MouseEvent) => {
    const tg = (ev.target as HTMLElement);
    if (ui.fp && !fp.contains(tg) && !(tg.closest && tg.closest("#" + CSS.escape(ui.fp.anchorId)))) closeFp();
    if (ui.add && !(tg.closest && tg.closest(".cb-panel .addwrap")) && !fp.contains(tg)) closeAdd();
    if (ui.addF && !(tg.closest && tg.closest(".cb-panel .addwrap")) && !fp.contains(tg)) closeAddF();
  };
  const onKey = (ev: KeyboardEvent) => {
    const inPanel = root.contains(document.activeElement) || fp.contains(document.activeElement);
    if (ev.key === "Escape" && inPanel) {
      if (ui.fp) { const a = byId(ui.fp.anchorId); closeFp(); if (a) a.focus(); ev.preventDefault(); return; }
      if (ui.add) { closeAdd(); const a = $("#addBtn"); if (a) a.focus(); ev.preventDefault(); return; }
      if (ui.addF) { closeAddF(); const a = $("#addFBtn"); if (a) a.focus(); ev.preventDefault(); return; }
      ev.preventDefault(); ev.stopPropagation(); askCancel(); return;   // Escape = Cancelar
    }
    const ae = document.activeElement;
    /* en un número (tile) que no se está escribiendo, Ctrl+Z también es nuestro */
    const typing = ae && ((ae.tagName === "INPUT" && !/^(range|checkbox|radio|color|button)$/.test((ae as HTMLInputElement).type) && !(ae.matches("input.num") && !(ae as HTMLElement).dataset.dirty)) ||
      /TEXTAREA|SELECT/.test(ae.tagName) || (ae as HTMLElement).isContentEditable);   // en un deslizador, Ctrl+Z es nuestro
    const ours = inPanel || view.containsFocus() || ae === document.body;
    if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === "z" && !ev.shiftKey && !typing && ours) { ev.preventDefault(); ev.stopPropagation(); undo(); }
  };
  window.addEventListener("resize", onResize);
  document.addEventListener("mousedown", onMouseDown, true);
  document.addEventListener("keydown", onKey, true);

  /* selector de color: espectro + tono + transparencia + código opcional */
  function openPicker(path: string, anchor: HTMLElement) {
    const F = () => ui.fp as Required<Fp>;            // la ventanita del color abierta (con su ruta y su color)
    const s = S(), cur0 = tokCol(getP(path), s), st = hexToHsva(hex6(cur0) + (cur0 && cur0.length === 9 ? cur0.slice(7) : ""));
    const quick = [s.col.bg, s.col.text, s.col.det, "#ffffff", "#000000", "#8b8b8b", "#00000000"];
    const knob = () => h("span", "knob");
    const kSV = knob(), kH = knob(), kA = knob();
    const sv = h("div", "cp-sv", kSV), hb = h("div", "cp-bar cp-hue", kH), ab = h("div", "cp-bar cp-alpha", kA);
    const prev = h("span", "fill");
    const hex = h("input", { cls: "hex", attr: { type: "text", spellcheck: "false", maxlength: 9, "aria-label": t("p.colorCode") } });
    const sws = h("div", "cp-sws", quick.map(c => h("button", { attr: { type: "button", "aria-label": c }, on: { click: () => { F().st = hexToHsva(c); apply(); } } }, h("i", { css: { "--cbp-q": c } }))));
    /* el segundo color del degradado lleva también el ángulo */
    let angle: Kid = null;
    if (path === "col.bg2") {
      const out = h("output", null, s.col.angle + "°");
      const rng = h("input", { attr: { type: "range", id: "cbp-angle", min: 0, max: 360, step: 5, value: s.col.angle, "aria-label": t("c.angle") } });
      rng.addEventListener("input", () => { const v = +rng.value; out.textContent = v + "°"; commit("col.angle", v); });
      angle = h("div", "cp-angle", h("label", { attr: { for: "cbp-angle" } }, t("c.angle")), rng, out);
    }
    openFp("color", anchor, h("div", { cls: "cp", attr: { role: "dialog", "aria-label": t("c.color") } }, sv, hb, ab, h("div", "cp-row", h("span", "swc cbp-static", prev), hex), sws, angle), { path, st });
    const paint = () => {
      const o = F().st, hx = hsvaToHex(o);
      setVars(sv, { "--h": o.h });
      setVars(kSV, { "--cbp-kx": (o.s * 100) + "%", "--cbp-ky": ((1 - o.v) * 100) + "%" });
      setVars(kH, { "--cbp-kx": (o.h / 360 * 100) + "%" }); setVars(kA, { "--cbp-kx": (o.a * 100) + "%" });
      setVars(ab, { "--c": hex6(hx) });
      setVars(prev, { "--cbp-fill": hx });
      if (document.activeElement !== hex) hex.value = hx;
    };
    const apply = () => { paint(); commit(F().path, hsvaToHex(F().st)); };
    const dragOn = (el: HTMLElement, fn: (x: number, y: number) => void) => el.addEventListener("pointerdown", e => {
      e.preventDefault(); el.setPointerCapture(e.pointerId);
      const go = (evt: PointerEvent) => { const r = el.getBoundingClientRect(); fn(clamp((evt.clientX - r.left) / r.width, 0, 1), clamp((evt.clientY - r.top) / r.height, 0, 1)); apply(); };
      go(e); el.onpointermove = go; el.onpointerup = () => { el.onpointermove = null; };
    });
    dragOn(sv, (x, y) => { F().st.s = x; F().st.v = 1 - y; if (F().st.a === 0) F().st.a = 1; });
    dragOn(hb, (x: number) => { F().st.h = x * 360; });
    dragOn(ab, (x: number) => { F().st.a = x; });
    hex.addEventListener("input", () => { const v = hex.value.trim(); if (/^#([0-9a-f]{6}|[0-9a-f]{8})$/i.test(v)) { F().st = hexToHsva(v.toLowerCase()); paint(); commit(F().path, v.toLowerCase()); } });
    paint();
  }
  /* fuentes: las instaladas (si el sistema deja), si no una lista; se puede escribir cualquier nombre */
  async function loadLocalFonts() {
    if (localFonts) return localFonts;
    try {
      const q = (window as unknown as { queryLocalFonts?: () => Promise<{ family: string }[]> }).queryLocalFonts;
      if (typeof q === "function") {
        const list = await q.call(window);
        const fams = [...new Set(list.map(f => f.family))].sort((a, b) => a.localeCompare(b));
        if (fams.length) localFonts = fams;
      }
    } catch { /* sin permiso: lista de reserva */ }
    return localFonts;
  }
  function openFonts(path: string, anchor: HTMLElement) {
    const v = getP(path) as string | null, stack = v == null ? S().font.family : v, eff = fontName(stack);
    const q = h("input", { attr: { type: "text", id: "fpSearch", placeholder: t("p.search"), spellcheck: "false", "aria-label": t("p.searchFont") } });
    const list = h("div", { cls: "fl", attr: { id: "fpList", role: "listbox" } });
    openFp("font", anchor, h("div", { cls: "fontp", attr: { role: "dialog", "aria-label": t("c.typeface") } }, q, list), { path });
    let act = 0, names = FONTS.map(f => f[0]);
    const draw = () => {
      const term = q.value.trim(), lt = term.toLowerCase();
      const opts = names.filter(n => n.toLowerCase().includes(lt) || fontLabel(n).toLowerCase().includes(lt));
      if (term && !names.some(n => n.toLowerCase() === lt || fontLabel(n).toLowerCase() === lt)) opts.unshift(term);      // escribir un nombre a mano
      act = clamp(act, 0, Math.max(0, opts.length - 1));
      list.empty();
      list.append(...opts.map((n, i) => h("button", { cls: "cbp-ff" + (i === act ? " act" : ""), attr: { type: "button", role: "option", "data-font": n, "aria-selected": String(n === eff) }, css: { "--cbp-ff": fontStack(n) } }, fontLabel(n))));
      const a = list.querySelector(".act"); if (a) a.scrollIntoView({ block: "nearest" });
    };
    /* elegir la misma que ya estaba conserva su pila entera */
    const pick = (b: HTMLElement) => { const val = b.dataset.font === eff ? stack : b.dataset.font; const p = ui.fp!.path!; closeFp(); commit(p, val, true); const fb = byId(fid(p)); if (fb) fb.focus(); };
    q.addEventListener("input", () => { act = 0; draw(); });
    q.addEventListener("keydown", e => {
      const n = list.children.length;
      if (e.key === "ArrowDown") { e.preventDefault(); act = (act + 1) % n; draw(); }
      if (e.key === "ArrowUp") { e.preventDefault(); act = (act - 1 + n) % n; draw(); }
      if (e.key === "Enter") { e.preventDefault(); const b = list.children[act] as HTMLElement; if (b) pick(b); }
    });
    list.addEventListener("click", e => { const b = (e.target as HTMLElement).closest<HTMLElement>("[data-font]"); if (b) pick(b); });
    act = Math.max(0, names.indexOf(eff));
    draw(); q.focus();
    void loadLocalFonts().then(fams => {
      if (!fams || !ui.fp || ui.fp.kind !== "font") return;
      names = ["Interfaz", "Texto de Obsidian", ...fams];
      act = Math.max(0, names.indexOf(eff)); draw();
    });
  }

  /* ---------- Estilos ---------- */
  function applyStyle(st: Style, name: string) {
    const s = S(); snapshot(); lastPath = "";
    const st2 = clone(st), filled = s.foot.filled, sk = s as unknown as Record<string, unknown>;
    STYLE_KEYS.forEach(k => sk[k] = merge(clone(BASE_STYLE[k]), st2[k] || {}));
    s.css = st2.css || "";
    const title = s.items.find(x => x.kind === "title") as unknown as Record<string, unknown>;
    const tt = merge(clone(BASE_STYLE.title), splitSpace(clone(st2.title || {}))) as Record<string, unknown>, def = ITEM_DEF as Record<string, unknown>;
    TITLE_KEYS.forEach(k => { title[k] = k in tt && tt[k] !== undefined ? tt[k] : def[k]; });
    s.items.concat(s.fitems).forEach(it => { if (textish(it) && it.kind !== "title" && it.color !== "tx" && it.color !== "det") it.color = "tx"; });
    s.foot.filled = filled;
    if (s.foot.on && !filled) fillFoot(s);
    syncStruct(s);
    closeFp(); renderPanel(); preview(); toast(t("toast.applied", { name }), true);
  }
  function thumb(st: Style) {
    const bg = st.col.bg, tx = st.col.text, dt = st.col.det, f = st.img.src === "none" ? "none" : st.img.fit, pos = st.img.pos;
    const R = (x: number, y: number, w: number, hh: number, fill: string, op?: string) => svg("rect", { x, y, width: w, height: hh, fill, opacity: op });
    let img: Kid = null;
    if (f === "fondo") img = [R(0, 0, 30, 22, "#6b6b6b"), R(0, 11, 30, 11, bg, ".75")];
    else if (f !== "none") img = pos === "left" ? R(0, 0, 10, 22, "#6b6b6b") : R(0, 0, 30, 11, "#6b6b6b");
    const x = f !== "none" && f !== "fondo" && pos === "left" ? 13 : 3, y = f === "fondo" ? 14 : (f !== "none" && pos !== "left" ? 14 : 4);
    return svg("svg", { viewBox: "0 0 30 22" }, R(0, 0, 30, 22, bg), img, R(x, y, f === "fondo" ? 16 : 12, 3, tx), R(x, y + 4.5, 8, 2, dt));
  }
  const menuItem = (st: Style, label: string, attr: Record<string, AttrVal>, onClick: () => void) => h("button", { attr: Object.assign({ type: "button", role: "menuitem" }, attr), on: { click: onClick } }, h("span", "thumb", thumb(st)), label);
  presetsBtn.addEventListener("click", () => {
    if (ui.fp && ui.fp.kind === "presets") { closeFp(); return; }
    const myStyles = plugin.getStyles();
    openFp("presets", presetsBtn, h("div", { cls: "cbmenu", attr: { role: "menu" } }, h("h5", null, t("p.presets")),
      Object.entries(PRESETS).map(([k, p]) => menuItem(p.s, t("preset." + k), { "data-preset": k }, () => applyStyle(p.s, t("preset." + k)))),
      myStyles.length ? [h("h5", null, t("p.myStyles")), myStyles.map((m, i) => menuItem(m.s, m.name, { "data-mine": i }, () => applyStyle(m.s, m.name)))] : null));
    const first = (fp.querySelector("button") as HTMLElement); if (first) first.focus();
  });
  saveBtn.addEventListener("click", () => {
    if (ui.fp && ui.fp.kind === "save") { closeFp(); return; }
    const inp = h("input", { attr: { type: "text", id: "saveName", "aria-label": t("p.styleName"), placeholder: t("p.name"), spellcheck: "false", value: view.config.name || "" } });
    const form = h("form", { cls: "savef", attr: { id: "saveForm" } }, inp, h("button", { cls: "btn primary", attr: { type: "submit" } }, t("p.save")));
    openFp("save", saveBtn, form);
    inp.focus(); inp.select();
    form.addEventListener("submit", ev => {
      ev.preventDefault(); const name = inp.value.trim(); if (!name) { inp.focus(); return; }
      plugin.saveStyle(name, getStyle(S()));
      closeFp(); toast(t("toast.saved", { name })); saveBtn.focus();
    });
  });
  async function copyMenu() {
    if (ui.fp && ui.fp.kind === "copy") { closeFp(); return; }
    openFp("copy", copyBtn, h("div", { cls: "cbmenu", attr: { role: "menu" } }, h("h5", null, t("p.searching"))));
    const list = await view.otherViews();
    if (!ui.fp || ui.fp.kind !== "copy") return;
    fp.empty();
    fp.append(h("div", { cls: "cbmenu", attr: { role: "menu" } }, list.length ? list.map((v, i) => menuItem(v.style, v.label, { "data-copy": i }, () => applyStyle(v.style, v.label))) : h("h5", null, t("p.noViews"))));
    placeFp(copyBtn);
    const first = (fp.querySelector("button") as HTMLElement); if (first) first.focus();
  }
  copyBtn.addEventListener("click", () => { void copyMenu(); });

  /* ---------- cabecera ---------- */
  function toast(msg: string, withUndo?: boolean) {
    const frag = createFragment();
    frag.append(msg);
    let n: Notice | null = null;
    if (withUndo) {
      const b = h("button", { cls: "cb-toast-undo", on: { click: () => { undo(); n && n.hide(); } } }, t("p.undo"));
      frag.append(" ", b);
    }
    n = new Notice(frag, 3200);
  }
  undoBtn.addEventListener("click", undo);
  /* Cancelar: cierra y vuelve la vista a como estaba al abrir el panel, sin escribir nada (con cambios, pregunta antes) */
  function askCancel() {
    closeAdd(); closeAddF();
    if (JSON.stringify(model) === atOpen) { view.closePanel(); view.focusBarButton(); return; }
    const keep = h("button", { cls: "btn", attr: { type: "button", "data-cf": "keep" }, on: { click: () => { closeFp(); cancelBtn.focus(); } } }, t("p.keepEditing"));
    const discard = h("button", { cls: "btn primary", attr: { type: "button", "data-cf": "discard" }, on: { click: () => { closeFp(); view.closePanel(); view.focusBarButton(); } } }, t("p.discard"));
    openFp("cancel", cancelBtn, h("div", { cls: "cbconfirm", attr: { role: "alertdialog", "aria-label": t("p.discardQ") } }, h("p", null, t("p.discardQ")), h("div", "pop-act", keep, discard)));
    discard.focus();
  }
  cancelBtn.addEventListener("click", () => ui.fp && ui.fp.kind === "cancel" ? closeFp() : askCancel());
  doneBtn.addEventListener("click", () => { closeFp(); closeAdd(); view.savePanel(model); });

  function destroy() {
    window.removeEventListener("resize", onResize);
    document.removeEventListener("mousedown", onMouseDown, true);
    document.removeEventListener("keydown", onKey, true);
    window.cancelAnimationFrame(raf);
    fp.remove(); root.remove();
  }
  /* cuando cambian las notas de la vista, el panel vuelve a mirar los datos */
  function onData() { src = view.source(); facts = view.factsFor(src); renderPanel(); }

  renderPanel();
  if (document.fonts) void document.fonts.ready.then(() => fitToggles());   // Inter Tight cargada: se mide de nuevo
  view.renderCool(model);
  return { get model() { return model; }, destroy, onData, root, undo };
}
