/* El modelo «coolbases»: lo que guarda el panel en la clave `coolbases` de la vista.
   { v, card, col, font, img, foot, rate, states, lines, hover, css, items, fitems } */
import { clone, merge, firstFamily, hex6, hexA } from "./util";
import { t } from "./i18n";
import type { Item, ItemT, Model, State, Style, TitleStyle } from "./types";

export const MODEL_VERSION = 1;

/* tipos de dato (los nombres, en i18n.js: «type.<id>») */
export const TYPES = [
  { id: "texto", ic: "Aa" },
  { id: "numero", ic: "123" },
  { id: "smart", ic: "↻" },
  { id: "etiquetas", ic: "#" },
  { id: "enlace", ic: "↗" },
  { id: "notas", ic: "[[ ]]" },
];

/* Estados (decoración): una propiedad sí/no que se ve como texto, pastilla, etiqueta, casilla (se marca desde la tarjeta), icono o punto,
   entre los datos o en uno de los 9 puntos de la tarjeta, como la valoración */
export const ST_FMTS = ["text", "pill", "tag", "check", "icon", "dot"];
export const ST_ICONS = ["✓", "✕", "●", "★", "♥"];
export const ST_DEF: Omit<State, "id"> = { prop: "", show: "yes", yes: "Sí", no: "No", fmt: "tag", icon: "✓", frame: "border", bw: 1, radius: 3, pad: 0.6, rot: -8,
  color: "det", bg: "#00000000", font: null, upper: true, size: null, weight: 700, place: "br", onImg: false, mx: 5, my: 5 };
export const framed = (st: State): boolean => st.fmt === "pill" || st.fmt === "tag";
export function mkState(prop: string, o?: Partial<State>): State { return Object.assign({ id: newId("s") }, clone(ST_DEF), { prop: prop || "", yes: t("st.yesDef"), no: t("st.noDef") }, o || {}); }

/* fuentes de reserva (si el sistema no deja listar las instaladas). «Interfaz» y «Texto de Obsidian» son
   identificadores (se guardan así en el modelo); el panel los enseña traducidos */
export const FONTS: [string, string][] = [
  ["Interfaz", "var(--font-interface)"],
  ["Texto de Obsidian", "var(--font-text)"],
  ["Inter", "'Inter', var(--font-interface)"],
  ["Helvetica Neue", "'Helvetica Neue', Helvetica, Arial, sans-serif"],
  ["Arial", "Arial, 'Helvetica Neue', sans-serif"],
  ["Arial Narrow", "'Arial Narrow', 'Roboto Condensed', sans-serif"],
  ["Roboto Condensed", "'Roboto Condensed', 'Arial Narrow', sans-serif"],
  ["Archivo", "'Archivo', 'Helvetica Neue', sans-serif"],
  ["Oswald", "'Oswald', 'Arial Narrow', sans-serif"],
  ["Futura", "Futura, 'Century Gothic', sans-serif"],
  ["Gill Sans", "'Gill Sans', 'Gill Sans MT', Calibri, sans-serif"],
  ["Avenir Next", "'Avenir Next', Avenir, sans-serif"],
  ["SF Pro", "-apple-system, 'SF Pro Text', system-ui, sans-serif"],
  ["Times New Roman", "'Times New Roman', Times, serif"],
  ["Georgia", "Georgia, 'Times New Roman', serif"],
  ["Baskerville", "Baskerville, 'Libre Baskerville', Georgia, serif"],
  ["Garamond", "Garamond, 'EB Garamond', Georgia, serif"],
  ["Courier New", "'Courier New', Courier, monospace"],
  ["Menlo", "Menlo, Consolas, monospace"],
  ["Space Mono", "'Space Mono', 'Courier New', monospace"],
];
const FONT_STACK = Object.fromEntries(FONTS);
/* pila CSS de una familia: una pila guardada tal cual (con sus alternativas y variables); las conocidas con su reserva;
   cualquier otro nombre, entre comillas y con la de la interfaz detrás */
const isStack = (v: unknown) => /[,'"]|var\(/.test(String(v));
export const fontStack = (name: string | null | undefined): string => !name ? "var(--font-interface)" : FONT_STACK[name] || (isStack(name) ? String(name)
  : '"' + String(name).replace(/"/g, "") + '", var(--font-interface)');
/* lo que se enseña en el panel: el primer nombre de la pila */
export const fontName = (v: string | null | undefined): string => !v ? "" : isStack(v) ? firstFamily(v) || String(v) : String(v);

export const WEIGHTS = [300, 400, 500, 600, 700, 800, 900];
export const SEPS = ["·", "/", "—", " "];
export const FMTS: [string, string | null][] = [["1/1", "1:1"], ["4/5", "4:5"], ["3/4", "3:4"], ["2/3", "2:3"], ["16/9", "16:9"], ["libre", null]];

export const T_DEF: ItemT = { multi: "inline", nfmt: "full", dec: 0, src: "manual", short: true, tagStyle: "text", max: 3, tsep: " · ",
  yes: "Sí", no: "", stStyle: "pill", show: "value", fixed: "", arrow: true, sort: "orig", dir: "desc", nlay: "lines", head: "", headColor: "#8a8a8a", more: "" };
export const ITEM_DEF: Omit<Item, "id" | "kind" | "prop" | "type" | "t"> = { font: null, upper: false, color: "tx", size: null, weight: null, fit: false, spaceT: 0.6, spaceB: 0.6, ital: false, under: false,
  hl: false, hlc: "#e5332f59", strike: false, sup: false, link: "none", hover: false, before: "", after: "", hide: "", join: false, sep: "·", gap: 1,
  place: "entre", onImg: false, mx: 5, my: 5 };
export const TITLE_KEYS: (keyof Item)[] = ["font", "upper", "color", "size", "weight", "fit", "spaceT", "spaceB", "ital", "under", "hl", "hlc", "strike", "link", "hover", "place", "onImg", "mx", "my"];

/* separación de un dato: arriba y abajo por separado; lo guardado con una sola «space» vale para las dos */
export function splitSpace<T>(o: T): T {
  const x = o as Record<string, unknown>;
  if (x && typeof x === "object" && "space" in x) {
    if (x.spaceT == null) x.spaceT = x.space;
    if (x.spaceB == null) x.spaceB = x.space;
    delete x.space;
  }
  return o;
}

export const newId = (p?: string): string => (p || "d") + Math.random().toString(36).slice(2, 9);
export function mkItem(prop: string, type?: string, o?: Partial<Item> | TitleStyle | null, t?: Partial<ItemT>): Item {
  const it = Object.assign({ id: newId(), kind: prop === "file.name" ? "title" : "dato", prop, type: type || "texto" }, clone(ITEM_DEF), splitSpace(clone(o || {}))) as Item;

  it.t = Object.assign({}, T_DEF, t || {});
  if (it.type === "notas" && !(o && "link" in o)) it.link = "note";
  if (it.type === "enlace") it.link = "self";
  return it;
}

export const BASE_STYLE: Style & { states: Model["states"] } = {
  card: { w: 260, fill: true, fmt: "3/4", h: 320, pad: 6, radius: 4, gap: 12 },
  col: { bg: "#141414", grad: false, bg2: "#2b2b2b", angle: 180, text: "#f2f2f2", det: "#e5332f", bw: 0, bc: "#ffffff29" },
  font: { family: "Interfaz", weight: 400, size: 3.6, align: "left" },
  img: { src: "auto", pos: "top", fit: "encajar", frame: 5, fx: "color", amt: { bn: 100, duo: 100, blur: 35, inv: 100 }, duo1: "#141414", duo2: "#e5332f",
    grain: false, bright: 100, shade: false, shadeC: "#000000", empty: "nada",
    /* «Sin imagen: Portada»: texto de abajo (propiedad; null = aún sin elegir), colores, forma y letra del título */
    cvText: null, cvColors: "auto", cvShape: "auto", cvFont: "Georgia" },
  title: { font: null, upper: false, color: "tx", size: 7, weight: 700, fit: false, spaceT: 0.4, spaceB: 0.4 },
  foot: { on: false, bg: "#00000000", lw: 1, lc: "#ffffff1f" },
  rate: { on: false, prop: "auto", type: "stars", place: "entre", onImg: false, mx: 5, my: 5, color: "det", size: 4.4, empty: true, over: 5, shape: "bubble", byVal: true, fill: "filled" },
  states: { on: false, list: [] },
  lines: { on: false, n: 1, color: "det", w: 2, width: "full", pct: 30, mt: 1.6, mb: 1.6 },
  hover: { on: true, color: "tx", bg: "#ffffff", bgOp: 10, under: true },
  css: "",
};
export const STYLE_KEYS: ("card" | "col" | "font" | "img" | "foot" | "rate" | "lines" | "hover")[] = ["card", "col", "font", "img", "foot", "rate", "lines", "hover"];
type StyleIn = { [K in keyof Style]?: Partial<Style[K]> };
export const mkStyle = (o?: StyleIn | null): typeof BASE_STYLE => merge(clone(BASE_STYLE), o || {});

/* estilos predeterminados (los nombres, en i18n.js: «preset.<clave>») */
export const PRESETS: Record<string, { s: Style }> = {
  poster: { s: mkStyle({ card: { w: 240, fmt: "3/4", pad: 6, radius: 4 }, col: { bg: "#111111", text: "#ffffff", det: "#ffffff" }, font: { family: "Interfaz", weight: 500, size: 3.4 }, img: { fit: "fondo", shade: true, bright: 94 }, title: { size: 12, weight: 800, fit: true, spaceT: 0.2, spaceB: 0.2 } }) },
  ficha: { s: mkStyle({ card: { w: 240, fmt: "4/5", pad: 6, radius: 6, gap: 14 }, col: { bg: "#f3f2ee", text: "#1a1a1a", det: "#2b59c3", bw: 1, bc: "#00000017" }, font: { family: "Helvetica Neue", weight: 400, size: 3.8 }, img: { pos: "top", fit: "encajar" }, title: { size: 7.5, weight: 700 }, foot: { on: true, bg: "#00000000", lw: 1, lc: "#0000001a" }, hover: { bg: "#2b59c3" } }) },
  portada: { s: mkStyle({ card: { w: 300, fmt: "libre", h: 120, pad: 5, radius: 4, gap: 14 }, col: { bg: "#181818", text: "#f0f0f0", det: "#f2c94c" }, font: { family: "Georgia", weight: 400, size: 3.8 }, img: { pos: "left", fit: "original" }, title: { size: 6.5, weight: 700 }, rate: { on: true, type: "stars", place: "entre" } }) },
  lista: { s: mkStyle({ card: { w: 320, fmt: "libre", h: 40, pad: 4.5, radius: 6, gap: 8 }, col: { bg: "#1f1f1f", text: "#e8e8e8", det: "#9aa4ff", bw: 1, bc: "#ffffff1a" }, font: { family: "Interfaz", weight: 400, size: 3.4 }, img: { src: "none" }, title: { size: 5.2, weight: 600, spaceT: 0.2, spaceB: 0.2 } }) },
};

export const textish = (it: Item | null | undefined): boolean => !!it && (it.kind === "title" || it.kind === "dato");

/* la valoración y cada estado siempre tienen su tarjetita; tantas líneas como diga «Cuántas»; siempre hay título
   (fijo, pero puede tener datos encima, p. ej. las etiquetas de Books) */
/* la valoración, una línea o un estado en la lista de datos: solo id y kind (y sid) */
const marker = (o: { id: string; kind: string; sid?: string }) => o as Item;
export function syncStruct(s: Model): Model {
  if (!s.items.some(x => x.kind === "title")) s.items.unshift(mkItem("file.name", "texto", clone(BASE_STYLE.title)));
  if (!s.items.some(x => x.kind === "rating")) s.items.push(marker({ id: "rating", kind: "rating" }));
  const sids = new Set<string | undefined>(s.states.list.map(x => x.id));
  s.items = s.items.filter(x => x.kind !== "state" || sids.has(x.sid));
  for (const st of s.states.list) if (!s.items.some(x => x.kind === "state" && x.sid === st.id)) s.items.push(marker({ id: "i" + st.id, kind: "state", sid: st.id }));
  const lines = s.items.filter(x => x.kind === "line");
  while (lines.length < s.lines.n) { const l = marker({ id: newId("L"), kind: "line" }); s.items.push(l); lines.push(l); }
  while (lines.length > s.lines.n) { const l = lines.pop()!; s.items.splice(s.items.indexOf(l), 1); }
  return s;
}

/* completa un modelo guardado con los valores por defecto (para modelos de versiones anteriores o a medias) */
/* un modelo guardado, tal como venga (de versiones anteriores, a medias o tocado a mano) */
type Loose = Record<string, unknown>;
export function normalizeModel(m: unknown): Model {
  const M = (m && typeof m === "object" ? m : null) as Loose | null;
  const s = mkStyle({}) as Partial<typeof BASE_STYLE> & Model;
  delete s.title;
  for (const k of STYLE_KEYS) if (M && M[k] && typeof M[k] === "object") merge(s[k], M[k]);
  s.css = M && typeof M.css === "string" ? M.css : "";
  s.v = MODEL_VERSION;
  const ms = (M && M.states && typeof M.states === "object" ? M.states : {}) as Loose;
  s.states = { on: !!ms.on, list: (Array.isArray(ms.list) ? ms.list as unknown[] : []).filter((x): x is State => !!x && typeof x === "object").map(x => Object.assign(mkState(x.prop), clone(x))) };
  s.states.list.forEach(st => { if (st.fmt === "stamp") st.fmt = "tag"; });   // el sello ya no existe: pasa a etiqueta
  const fixItem = (it: Item, foot: boolean): Item | null => {
    if (!it || typeof it !== "object") return null;
    if (it.kind === "rating" || it.kind === "line") return marker({ id: it.id || newId(it.kind === "line" ? "L" : "r"), kind: it.kind });
    if (it.kind === "state") return marker({ id: it.id || newId("i"), kind: "state", sid: it.sid });
    if (it.type === "estado" && !foot) return estadoToState(s, it);   // modelos de antes de la 1.0: el dato «Estado» pasa a Estados
    const base = mkItem(it.prop || "file.name", it.type || (foot ? "enlace" : "texto"));
    const out = Object.assign(base, splitSpace(clone(it)));
    out.t = Object.assign({}, T_DEF, it.t || {});
    out.id = it.id || newId();
    out.kind = out.prop === "file.name" && !foot ? "title" : "dato";
    return out;
  };
  s.items = (M && Array.isArray(M.items) ? M.items as Item[] : []).map(x => fixItem(x, false)).filter((x): x is Item => !!x);
  s.fitems = (M && Array.isArray(M.fitems) ? M.fitems as Item[] : []).map(x => fixItem(x, true)).filter((x): x is Item => !!x);
  s.foot.filled = !!(M && M.foot && (M.foot as Loose).filled) || s.fitems.length > 0;
  return syncStruct(s);
}

/* Un dato de tipo «Estado» (modelos guardados antes de la 1.0) -> un estado de Decoraciones con el mismo aspecto,
   en el mismo sitio de la lista. Si llevaba reglas de sello en el CSS libre, esas reglas pasan al estado. */
function estadoToState(s: Model, it: Item): Item {
  const t = Object.assign({}, T_DEF, it.t || {}), prop = it.prop;
  const col = it.color || "tx", hexCol = col === "tx" ? s.col.text : col === "det" ? s.col.det : col;
  const st = mkState(prop, { yes: t.yes || "", no: t.no || "", show: t.yes && t.no ? "always" : t.no && !t.yes ? "no" : "yes",
    fmt: t.stStyle === "pill" ? "pill" : "text", frame: "fill", bg: hexA(hex6(hexCol), 0.2), bw: 1, radius: 3, pad: 0.6,
    color: col, font: it.font || null, upper: !!it.upper, size: it.size == null ? null : it.size, weight: it.weight == null ? null : it.weight, place: "entre" });
  /* reglas del sello que traían esos modelos en el CSS libre */
  const X = '.cb-i[data-prop="' + prop + '"]', out: string[] = [];
  for (const line of String(s.css || "").split("\n")) {
    if (!line.includes(X)) { out.push(line); continue; }
    let m;
    if ((m = /display: inline-block; background: ([^;]+); border: ([^;]+); padding/.exec(line))) {
      const bg = m[1].trim(), br = /^([\d.]+)px\s+\w+\s+(.+)$/.exec(m[2].trim()), hasBg = !/^(transparent|none)$/i.test(bg);
      st.fmt = "tag"; st.radius = 4; st.pad = 0.6;
      if (hasBg) st.bg = bg.startsWith("#") ? bg : st.bg;
      if (br) { st.bw = +br[1]; if (/^#/.test(br[2])) st.color = br[2]; }
      st.frame = br && hasBg ? "both" : br ? "border" : "fill";
    }
    else if (/text-align: right; padding-top/.test(line)) { st.place = "br"; st.mx = 5; st.my = 5; }
    else if (/position: absolute/.test(line)) {
      const v = /bottom:/.test(line) ? "b" : "t", h = /right:/.test(line) ? "r" : "l";
      st.place = v + h; st.mx = 3; st.my = 3;
    }
    else if (/^\.cb-body:has/.test(line.trim())) { /* las dos reglas que sacaban el sello del texto: ya no hacen falta */ }
    else out.push(line.split(X).join('.cb-st[data-prop="' + prop + '"]'));
  }
  s.css = out.join("\n");
  s.states.list.push(st); s.states.on = true;
  return marker({ id: it.id || newId("i"), kind: "state", sid: st.id });
}

/* lo que se guarda: sin campos de trabajo */
export function storable(s: Model): Model {
  const o = clone(s);
  const strip = (it: Item) => { const r = it as unknown as Record<string, unknown>; for (const k of Object.keys(r)) if (k[0] === "_") delete r[k]; };
  o.items.forEach(strip); o.fitems.forEach(strip);
  o.v = MODEL_VERSION;
  return o;
}

/* estilo = todo menos los datos */
export function getStyle(s: Model): Style {
  const o: Style = { card: s.card, col: s.col, font: s.font, img: s.img, foot: s.foot, rate: s.rate, lines: s.lines, hover: s.hover, css: s.css, title: {} };
  const t = s.items.find(x => x.kind === "title") || {} as Partial<Item>, title = o.title as Record<string, unknown>;
  TITLE_KEYS.forEach(k => title[k] = t[k]);
  const c = clone(o); delete c.foot.filled; return c;
}

/* el modelo de una vista sin `coolbases`: el título y las propiedades marcadas en «Propiedades» de Bases (getOrder) */
/* lo que el modelo de fábrica necesita saber de los datos (Facts, en render.ts) */
export interface ModelFacts { boolProps(): string[]; isImage(p: string): boolean; guessType(p: string): string; isUrlProp(p: string): boolean }
export function defaultModel(order: string[], facts: ModelFacts | null): Model {
  const s = mkStyle({}) as Partial<typeof BASE_STYLE> & Model;
  const title = s.title; delete s.title;
  s.img.src = "auto";
  const bools = facts ? facts.boolProps() : [];
  const props = order.filter(p => !(facts && facts.isImage(p)) && !bools.includes(p));
  /* las casillas sí/no de «Propiedades» -> Estados (etiqueta arriba a la derecha, con su nombre) */
  order.filter(p => bools.includes(p)).forEach(p => s.states.list.push(mkState(p, { yes: p.replace(/^note\./, "").toUpperCase(), place: "tr" })));
  s.states.on = s.states.list.length > 0;
  s.items = [mkItem("file.name", "texto", title), ...props.filter(p => p !== "file.name").map(p => {
    const ty = facts ? facts.guessType(p) : "texto";
    const it = mkItem(p, ty, {}, ty === "smart" ? { src: /follow/.test(p) ? "instagram" : "spotify" } : {});
    if (ty === "smart" && facts) { const net = it.t.src === "spotify" ? "note.spotify" : "note.instagram"; if (facts.isUrlProp(net)) it.link = "prop:" + net; }
    return it;
  })];
  s.fitems = [];
  return normalizeModel(s);
}
