/* Pintado del modelo «coolbases» (el del panel). Construye cada tarjeta con el DOM y luego ajusta lo que depende
   de medidas reales (títulos que encogen, superíndices, fracciones, texto cortado junto a una portada).
   Lo fijo está en styles.css; lo que elige el usuario llega por variables CSS.
   `src` da acceso a los datos: { recs, displayName(p), imageUrl(rec,p), linkTarget(path, from), backlinks(prop, path) }.
   Cada `rec` es { path, name, get(prop) } con los valores ya limpios: null, texto o lista de textos. */
import { clamp, fmt, toArr, isEmpty, isEmail, isPhone, isURL, isImageURL, clean, parseLink, display, camelSplit,
  parseCount, starCount, isStarText, fmtNum, siteParts, bareURL, hexA, hex6 } from "./util";
import type { Value } from "obsidian";
import { fontStack, textish, framed } from "./model";
import type { ModelFacts } from "./model";
import { coverSrc, COVER_PALETTE, SHAPE_COUNT, hashStr } from "./cover";
import type { CoverData } from "./cover";
import { h, svg, frag, setVars, joinNodes } from "./dom";
import type { Kid, CssVal, AttrVal } from "./dom";
import type { ColStyle, Item, ItemT, LinkedNote, Model, Rec, RecValue, Source, State } from "./types";

export const NOISE = 'url("data:image/svg+xml;charset=utf-8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/></filter><rect width="100%" height="100%" filter="url(#n)"/></svg>') + '")';
const IMG_FILE = /\.(png|jpe?g|gif|webp|avif|svg|bmp)$/i;
const IMG_NAMES = /^(note\.)?(cover|image|imagen|img|visual_ref|poster|portada|logo|thumbnail|thumb|banner|foto|photo|picture)$/i;

/* ---------- lo que se sabe de los datos de la vista (a partir de unas cuantas notas) ---------- */
export class Facts implements ModelFacts {
  src: Source;
  props: string[];
  sample: Rec[];
  cache: Record<string, unknown>;
  constructor(src: Source, props: string[]) {
    this.src = src;
    this.props = props;
    this.sample = src.recs.slice(0, 300);
    this.cache = {};
  }
  values(p: string): (string | string[])[] { return (this.cache["v:" + p] ??= this.sample.map(r => r.get(p)).filter(v => !isEmpty(v))) as (string | string[])[]; }
  flat(p: string): string[] { return (this.cache["f:" + p] ??= this.values(p).flatMap(v => toArr(v))) as string[]; }
  sampleOf(p: string): string | string[] | null { return this.values(p)[0] ?? null; }
  isImage(p: string): boolean {
    if (p.startsWith("rel:") || p.startsWith("file.")) return false;
    const f = this.flat(p);
    if (!f.length) return IMG_NAMES.test(p);
    /* una URL de imagen, o una imagen del vault: [[x.jpg]], ![[x.jpg|200]] o la ruta tal cual (covers/x.jpg) */
    const looksImg = (v: string) => { const s = clean(v).replace(/^!?\[\[|\]\]$/g, "").replace(/\|.*$/, "").trim(); return isImageURL(s) || IMG_FILE.test(s.split(/[?#]/)[0]); };
    return IMG_NAMES.test(p) || f.some(looksImg);   // con un nombre de imagen (cover, poster…) basta
  }
  imgProps(): string[] { return (this.cache.img ??= this.props.filter(p => this.isImage(p))) as string[]; }
  urlProps(): string[] { return (this.cache.url ??= this.props.filter(p => !this.isImage(p) && !p.startsWith("rel:") && this.flat(p).some(v => isURL(v)))) as string[]; }
  isUrlProp(p: string): boolean { return this.urlProps().includes(p); }
  rateProps(): string[] {
    return (this.cache.rate ??= this.props.slice().sort((a, b) => (/rating|valoraci/i.test(b) ? 1 : 0) - (/rating|valoraci/i.test(a) ? 1 : 0))
      .filter(p => !p.startsWith("rel:") && !p.startsWith("file.") && this.flat(p).length && this.flat(p).every(v => isStarText(v) || /^\d+([.,]\d+)?$/.test(v)))) as string[];
  }
  /* casillas sí/no (para Estados) */
  boolProps(): string[] {
    return (this.cache.bool ??= this.props.filter(p => !p.startsWith("rel:") && !p.startsWith("file.") && !p.startsWith("formula.") &&
      this.flat(p).length && this.flat(p).every(v => /^(true|false)$/i.test(v)))) as string[];
  }
  allPlain(p: string): boolean { const f = this.flat(p); return f.length > 0 && f.every(v => isEmail(v) || isPhone(v)); }
  /* propiedades numéricas de las notas enlazadas por p (para «Ordenar por») */
  linkedNumeric(p: string): string[] {
    return (this.cache["n:" + p] ??= (() => {
      const keys = new Map<string, number>();
      for (const r of this.sample.slice(0, 80)) for (const n of linkedNotes(this.src, r, p)) {
        const fm = n.fm || {};
        for (const k of Object.keys(fm)) if (isFinite(parseCount(fm[k])) && !/^(year|date|created|modified)$/i.test(k)) keys.set(k, (keys.get(k) || 0) + 1);
      }
      return [...keys.keys()].sort((a, b) => Number(b === "listeners") - Number(a === "listeners") || keys.get(b)! - keys.get(a)!);
    })()) as string[];
  }
  guessType(p: string): string {
    if (p.startsWith("rel:")) return "notas";
    const f = this.flat(p), name = p.replace(/^note\./, "");
    if (!f.length) return ({ listeners: "smart", followers: "smart" } as Record<string, string>)[name] || "texto";
    if (/^(listeners|followers|oyentes|seguidores)$/i.test(name)) return "smart";
    if (f.every(v => /^(true|false)$/i.test(v))) return "texto";   // las casillas sí/no van a Decoraciones → Estados
    if (this.isUrlProp(p) && f.every(v => isURL(v))) return "enlace";
    if (f.every(v => parseLink(v))) return "notas";
    if (this.values(p).some(v => Array.isArray(v) && v.length > 1)) return "etiquetas";
    if (f.every(v => /^-?\d+([.,]\d+)?$/.test(v)) && !/year|año/i.test(name)) return "numero";
    return "texto";
  }
}

/* notas enlazadas por p desde rec (o que enlazan a rec, si p es «rel:prop») -> [{n, path, fm}] */
export function linkedNotes(src: Source, rec: Rec, p: string): LinkedNote[] {
  if (p.startsWith("rel:")) return src.backlinks(p.slice(4), rec.path);
  return toArr(rec.get(p)).map(v => {
    const l = parseLink(v);
    if (!l) return { n: display(v), path: null, fm: null };
    const t = src.linkTarget(l.path, rec.path);
    return { n: l.text, path: t ? t.path : l.path, fm: t ? t.fm : null };
  });
}

const tokCol = (v: unknown, s: { col: ColStyle }): string => v === "tx" ? s.col.text : v === "det" ? s.col.det : v as string;
export { tokCol };

/* ---------- enlaces ---------- */
const hvc = (it: Item) => it.hover ? " hv" : "";
/* una ruta de nota nunca se usa como dirección con esquema (javascript:, file:…) */
const noteHref = (path: string) => /^[a-z][\w+.-]*:/i.test(path) ? null : path;
const aNote = (it: Item, path: string, from: string, kids: Kid) => h("a", { cls: "cb-a internal-link" + hvc(it), attr: { "data-link": path, "data-from": from, href: noteHref(path) } }, kids);
const aUrl = (it: Item, url: string, kids: Kid, under?: boolean) => h("a", { cls: "cb-a external-link" + hvc(it) + (under ? " cb-u" : ""), attr: { href: clean(url), target: "_blank", rel: "noopener" } }, kids);
/* un enlace con «texto antes» subraya solo el enlace, no la etiqueta («Web: ») */
const underOwn = (it: Item) => it.type === "enlace" && it.under && !!it.before && !it.sup;
function wrapLink(s: Model, it: Item, kids: Kid, rec: Rec): Kid {
  if (it.link === "none" || !it.link) return kids;
  if (it.link === "note") return aNote(it, rec.path, rec.path, kids);
  if (it.link.startsWith("prop:")) {
    const u = toArr(rec.get(it.link.slice(5))).find(v => isURL(v));
    return u ? aUrl(it, u, kids) : kids;
  }
  return kids;
}

/* «& co.»: texto tras el máximo, solo si se ha cortado la lista */
const moreNode = (t: ItemT, cut: boolean) => cut && t.more ? h("span", "cb-more", t.more) : null;
/* contenido de un dato en una nota (con «texto antes/después»), o null si no hay nada que enseñar */
/* el título: el nombre de la nota, el primer alias, otra propiedad o nada; si la nota no tiene ese dato, su nombre */
function titleValue(it: Item, rec: Rec): RecValue {
  const from = it.t?.tsrc || "name";
  if (from === "none") return null;
  if (from === "name") return rec.name;
  const first = toArr(rec.get(from === "alias" ? "note.aliases" : from)).map(v => clean(v)).find(Boolean);
  return first || rec.name;
}
export function itemContent(s: Model, it: Item, rec: Rec, src: Source): DocumentFragment | null {
  const raw: RecValue = it.kind === "title" ? titleValue(it, rec) : it.prop.startsWith("rel:") ? null : rec.get(it.prop);
  const t = it.t || {} as ItemT, hide = String(it.hide || "").split(",").map(x => x.trim().toLowerCase()).filter(Boolean);
  const hidden = (v: unknown) => hide.includes(String(v).toLowerCase());
  const B = () => it.before ? h("span", "cb-bef", it.before) : null, A = () => it.after ? h("span", "cb-aft", it.after) : null;
  const type = it.kind === "title" ? "texto" : it.type;
  if (type !== "notas" && isEmpty(raw)) return null;
  switch (type) {
    case "texto": {
      const vals = toArr(raw).map(clean).filter(v => v && !hidden(display(v)));
      if (!vals.length) return null;
      const plain = vals.every(v => isEmail(v) || isPhone(v));
      const hasLinks = vals.some(v => parseLink(v));
      const parts = vals.map((v): Kid => {
        const l = parseLink(v);
        if (l) { const tg = src.linkTarget(l.path, rec.path); return aNote(it, tg ? tg.path : l.path, rec.path, l.text); }
        if (plain) return h("span", "cb-copy", v.replace(/^(mailto|tel):/i, ""));
        return v;
      });
      const body = t.multi === "lines" && parts.length > 1 ? joinNodes(parts, () => h("br")) : joinNodes(parts, ", ");
      return frag(B(), plain || hasLinks ? body : wrapLink(s, it, body, rec), A());
    }
    case "numero": case "smart": {
      const n = parseCount(raw); if (!isFinite(n)) return null;
      const txt = type === "smart" ? fmtNum(n, t.short ? "short" : "full", t.short ? 1 : 0) : fmtNum(n, t.nfmt, t.dec);
      return frag(B(), wrapLink(s, it, txt, rec), A());
    }
    case "etiquetas": {
      const all = toArr(raw).map(v => camelSplit(display(v))).filter(v => v && !hidden(v)), arr = all.slice(0, Math.max(1, t.max || 1));
      if (!arr.length) return null;
      const inner = t.tagStyle === "text" ? joinNodes(arr.map(v => h("span", "cb-tg", v)), t.tsep)
        : arr.map(v => h("span", "cb-pill " + (t.tagStyle === "fill" ? "fill" : "outline"), v));
      return frag(B(), wrapLink(s, it, inner, rec), moreNode(t, all.length > arr.length), A());
    }
    case "enlace": {
      const v = clean(toArr(raw).find(x => isURL(x)) ?? toArr(raw)[0]);
      if (!v || hidden(v)) return null;
      const site = (): Kid[] => { const [net, rest] = siteParts(v); return net ? [h("span", "cb-net", net), rest] : [rest]; };
      const label: Kid[] = !isURL(v) ? [display(v)] : t.show === "site" ? site() : t.show === "fixed" ? (t.fixed ? [t.fixed] : site()) : [bareURL(v)];
      const inner = [...label, t.arrow || it._foot ? " ↗" : ""];
      return frag(B(), isURL(v) ? aUrl(it, v, inner, underOwn(it)) : inner, A());
    }
    case "notas": {
      let arr = linkedNotes(src, rec, it.prop).filter(i => i.n && !hidden(i.n));
      if (t.sort && t.sort !== "orig") {
        const num = (i: LinkedNote) => { const x = parseCount(i.fm ? i.fm[t.sort] : null); return isFinite(x) ? x : -Infinity; };
        arr = arr.slice().sort((p, q) => t.dir === "asc" ? num(p) - num(q) : num(q) - num(p) || p.n.localeCompare(q.n));
      }
      const cut = arr.length > Math.max(1, t.max || 1);
      arr = arr.slice(0, Math.max(1, t.max || 1));
      if (!arr.length) return null;
      const one = (i: LinkedNote): Kid => it.link === "none" || !i.path ? i.n : aNote(it, i.path, rec.path, i.n);
      const head = t.head ? h("span", { cls: "cb-head" + (t.headColor ? " has-c" : ""), css: { "--cb-head-c": t.headColor || null } }, t.head) : null;
      return frag(head, B(), t.nlay === "lines" ? joinNodes(arr.map(one), () => h("br")) : joinNodes(arr.map(one), " · "), moreNode(t, cut), A());
    }
  }
  return null;
}

/* el aspecto de un dato (también de su superíndice y de su separador): clases para lo que se enciende o apaga,
   variables para los valores */
export function styleItem<E extends HTMLElement>(el: E, s: Model, it: Item, sup?: boolean): E {
  const v: Record<string, CssVal> = { "--cb-x-c": tokCol(it.color, s) };
  el.addClass("cb-x");
  if (sup) { el.addClass("is-sup"); v["--cb-x-fs"] = it.size == null ? ".5em" : "calc(" + it.size + "*1cqi)"; }
  else v["--cb-x-fs"] = "calc(var(--k,1)*" + (it.size == null ? "var(--cb-fs)" : it.size) + "*1cqi)";
  if (it.font) { el.addClass("has-font"); v["--cb-x-ff"] = fontStack(it.font); }
  if (it.weight != null) { el.addClass("has-w"); v["--cb-x-w"] = it.weight; }
  if (it.upper) el.addClass("is-upper");
  if (it.ital) el.addClass("is-ital");
  if (it.under && !underOwn(it)) el.addClass("is-under");
  if (it.strike) el.addClass("is-strike");
  if (it.hl) { el.addClass("is-hl"); v["--cb-x-hl"] = it.hlc; }
  if (it.kind === "title") el.addClass("is-title");
  setVars(el, v);
  return el;
}
/* separador de una decoración (valoración, estado) juntada a la línea anterior */
function decoSep(it: Item): Node[] {
  const g = it.gap == null ? 1 : it.gap, sep = it.sep == null ? "·" : it.sep;
  if (sep === " ") return [h("span", { cls: "cb-sep is-space", css: { "--cb-sep-g": g } }), h("wbr")];
  return [h("span", { cls: "cb-sep", css: { "--cb-sep-g": g } }, sep), h("wbr")];
}
function sepNode(s: Model, it: Item): Node[] {
  if (it.sep === " ") return [h("span", { cls: "cb-sep is-space", css: { "--cb-sep-g": it.gap } }), h("wbr")];
  const sp = styleItem(h("span", { cls: "cb-sep", css: { "--cb-sep-g": it.gap } }, it.sep), s, it);
  sp.removeClass("is-under", "is-strike", "is-hl");                   // el separador no lleva subrayado, tachado ni resaltado
  return [sp, h("wbr")];
}
const ruleNode = (s: Model) => h("div", "cb-rule" + (s.lines.width === "content" ? " cw" : ""));

/* ---------- valoración ---------- */
const HUE_STOPS: [number, number][] = [[0, 0], [0.2, 0], [0.4, 28], [0.52, 52], [1, 125]];
export function valColor(r: number): { bg: string; fg: string } {
  r = clamp(r, 0, 1);
  for (let i = 1; i < HUE_STOPS.length; i++) {
    const [a, ha] = HUE_STOPS[i - 1], [b, hb] = HUE_STOPS[i];
    if (r <= b) { const hu = ha + (hb - ha) * ((r - a) / ((b - a) || 1)); return { bg: "hsl(" + hu.toFixed(0) + " 72% 48%)", fg: hu > 40 && hu < 100 ? "#161616" : "#ffffff" }; }
  }
  return { bg: "hsl(125 60% 40%)", fg: "#fff" };
}
function slashSVG(shape: string) {
  const w = shape === "square" ? 21.8 : 15.5;
  return svg("svg", { class: "sl", viewBox: "0 0 100 100", preserveAspectRatio: "none", "aria-hidden": "true", "data-w": w },
    svg("polygon", { points: "0,100 " + w + ",100 100,0 " + (100 - w) + ",0" }));
}
function faceSVG(kind: string, col: string, filled: boolean) {
  const mouth = ({ sad: "M7.6 17.2c1.2-1.7 2.7-2.5 4.4-2.5s3.2.8 4.4 2.5", mid: "M8 15.6h8", happy: "M7.6 14.2c1.2 1.9 2.7 2.9 4.4 2.9s3.2-1 4.4-2.9" } as Record<string, string>)[kind];
  const ink = filled ? "rgba(0,0,0,.72)" : col;
  return svg("svg", { class: "cb-face", viewBox: "0 0 24 24", "aria-hidden": "true" },
    svg("circle", { cx: 12, cy: 12, r: filled ? 11 : 10.2, fill: filled ? col : "none", stroke: filled ? "none" : col, "stroke-width": 1.6 }),
    svg("circle", { cx: 8.6, cy: 9.6, r: 1.3, fill: ink }), svg("circle", { cx: 15.4, cy: 9.6, r: 1.3, fill: ink }),
    svg("path", { d: mouth, fill: "none", stroke: ink, "stroke-width": 1.6, "stroke-linecap": "round" }));
}
/* la propiedad elegida manda aunque en estas notas esté vacía (si no, un año saldría como 5 estrellas) */
export function rateProp(s: Model, facts: Facts): string | null { const p = s.rate.prop; return p && p !== "auto" ? p : facts.rateProps()[0] || null; }
export function rateNode(s: Model, rec: Rec, facts: Facts): HTMLSpanElement | null {
  const r = s.rate, p = rateProp(s, facts); if (!p) return null;
  const raw = toArr(rec.get(p))[0];
  const v = starCount(raw); if (v == null) return null;
  const over = Math.max(1, +r.over || 5), isStar = isStarText(raw);
  const ratio = isStar ? v / 5 : v / over;
  const col = tokCol(r.color, s), fs = r.size + "cqi";
  if (r.type === "stars") {
    const n = clamp(Math.round(ratio * 5), 0, 5);
    return h("span", { cls: "cb-stars", css: { "--cb-rt-fs": fs, "--cb-rt-c": col } }, "★".repeat(n), r.empty ? h("span", "cb-empty", "★".repeat(5 - n)) : null);
  }
  if (r.type === "score") {
    const c = r.byVal ? valColor(ratio) : { bg: col, fg: s.col.bg };
    const shown = isStar ? Math.round(ratio * over * 10) / 10 : v;
    return h("span", { cls: "cb-score " + (r.shape === "square" ? "square" : "bubble"), css: { "--cb-rt-fs": fs, "--cb-sc-bg": c.bg, "--cb-sc-fg": c.fg } },
      h("span", "cb-frac", h("span", "n", fmt(shown)), slashSVG(r.shape), h("span", "cb-vh", "⁄"), h("span", "d", String(over))));
  }
  const kind = ratio < 1 / 3 ? "sad" : ratio < 2 / 3 ? "mid" : "happy";
  return h("span", { cls: "cb-faces", css: { "--cb-rt-fs": fs } }, faceSVG(kind, r.byVal ? valColor(ratio).bg : col, r.fill === "filled"));
}
/* ---------- estados ---------- */
export const isYes = (raw: RecValue): boolean => { const v = clean(String(toArr(raw)[0] ?? "")).toLowerCase(); return ["true", "sí", "si", "yes", "1", "x", "✓"].includes(v); };
export const stateOf = (s: Model, id: string | undefined): State | undefined => s.states.list.find(x => x.id === id);
export function stateNode(s: Model, st: State | null | undefined, rec: Rec): HTMLSpanElement | null {
  if (!st || !st.prop) return null;
  const on = isYes(rec.get(st.prop)), check = st.fmt === "check";
  if (!check && ((st.show === "yes" && !on) || (st.show === "no" && on))) return null;   // la casilla se ve siempre: es para marcarla
  const col = tokCol(st.color, s), dim = st.show === "always" && !on;   // icono y punto no tienen texto: el «no» se ve apagado
  const v: Record<string, CssVal> = { "--cb-st-fs": (st.size == null ? s.font.size : st.size) + "cqi", "--cb-st-c": col };
  let cls = "";
  if (st.font) { cls += " has-font"; v["--cb-st-ff"] = fontStack(st.font); }
  if (st.weight != null) { cls += " has-w"; v["--cb-st-w"] = st.weight; }
  if (st.upper) cls += " is-upper";
  if (dim && (st.fmt === "dot" || st.fmt === "icon")) cls += " is-dim";
  const tag = (f: string, kids: Kid, attr?: Record<string, AttrVal>) => h("span", { cls: "cb-st f-" + f + cls, attr: Object.assign({ "data-prop": st.prop }, attr || {}), css: v }, kids);
  if (check) {
    const t = on ? st.yes : st.no;
    v["--cb-ck-bw"] = Math.max(1, +st.bw || 1) + "px"; v["--cb-ck-r"] = st.radius + "px";
    if (on) cls += " is-on";
    const box = h("span", "cb-ck", on ? svg("svg", { viewBox: "0 0 16 16", "aria-hidden": "true" },
      svg("path", { d: "M3.5 8.5l3 3 6-7", fill: "none", stroke: "currentColor", "stroke-width": 2.2, "stroke-linecap": "round", "stroke-linejoin": "round" })) : null);
    return tag("check", [box, t ? h("span", "cb-ck-t", t) : null], { role: "checkbox", tabindex: 0, "aria-checked": String(on), "data-toggle": st.prop });
  }
  if (st.fmt === "dot") return tag("dot", null);
  if (st.fmt === "icon") return tag("icon", st.icon || "✓");
  const txt = on ? st.yes : st.no; if (!txt) return null;
  if (!framed(st)) return tag("text", txt);
  const fill = st.frame !== "border", border = st.frame !== "fill", pad = +st.pad || 0;
  Object.assign(v, { "--cb-st-py": (pad * 0.4).toFixed(3) + "em", "--cb-st-px": pad + "em", "--cb-st-bg": fill ? st.bg : "transparent",
    "--cb-st-bw": border ? st.bw + "px" : "0px", "--cb-st-r": st.fmt === "pill" ? "99em" : st.radius + "px" });
  return tag(st.fmt, txt);
}
/* uno de los 9 puntos, con su margen */
function floatBox(r: { place: string; mx: number; my: number }, extraCls?: string) {
  const p = r.place;
  return h("div", { cls: "cb-float v-" + p[0] + " h-" + p[1] + (extraCls || ""), css: { "--cb-mx": r.mx, "--cb-my": r.my } });
}

/* ---------- tarjeta ---------- */
export function imgSrc(s: Model, facts: Facts): string | null {
  const v = s.img.src;
  if (v === "none") return null;
  const ip = facts.imgProps();
  if (v === "auto" || !v) return ip[0] || null;
  return v;                 // aunque esta muestra no tenga imagen, la propiedad elegida manda
}
/* separación del dato: arriba y abajo por separado; la línea con el tamaño de su primer dato
   (si no, el interlineado de la letra de la tarjeta la estira con texto pequeño) */
const lineNode = (it: Item) => h("div", { cls: "cb-l cb-lp" + (it.fit ? " fit" : ""),
  css: { "--cb-l-pt": +it.spaceT || 0, "--cb-l-pb": +it.spaceB || 0, "--cb-l-fs": "calc(var(--k,1)*" + (it.size == null ? "var(--cb-fs)" : it.size) + "*1cqi)" } });
function itemSpan(s: Model, it: Item, content: Kid) { return styleItem(h("span", { cls: "cb-i", attr: { "data-prop": it.prop } }, content), s, it); }
interface Line { it: Item; parts: Node[]; rate?: boolean; st?: boolean }
/* un dato (o el título) colocado en uno de los 9 puntos de la tarjeta, como la valoración y los estados */
export const placed = (it: Item): boolean => textish(it) && !!it.place && it.place !== "entre";
interface Float { it: Item; img: boolean; lines: Line[] }
interface PlacedData { it: Item; img: boolean; nodes: Node[] }
/* Las líneas de datos. Cada dato va a su sitio: entre los datos («entre») o a uno de los 9 puntos (con los demás
   de ese punto, apilados). Un dato unido se pega a la línea del anterior solo si los dos están en el mismo sitio;
   si el dato que empezaba la línea no sale en esta nota (vacío, o colocado en otro sitio), el siguiente no se pega
   a la línea de antes: empieza la suya. Una regla también corta. */
function bodyNodes(s: Model, rec: Rec, src: Source, facts: Facts, onImg: boolean): { flow: Node[]; floats: PlacedData[] } {
  const flow: (Node | Line)[] = [], floats = new Map<string, Float>();
  const open = new Map<string, Line>();            // la línea abierta de cada sitio
  let chain: string | null = null;                 // el sitio de la línea a la que se pegaría el siguiente dato unido
  const node = (l: Line) => l.rate ? h("div", "cb-rl", l.parts) : l.st ? h("div", "cb-stl", l.parts) : append(lineNode(l.it), l.parts);
  const startLine = (g: string, l: Line) => {
    open.set(g, l); chain = g;
    if (g === "entre") { flow.push(l); return; }
    if (!floats.has(g)) floats.set(g, { it: l.it, img: g.endsWith("+img"), lines: [] });
    floats.get(g)!.lines.push(l);
  };
  for (const it of s.items) {
    if (it.kind === "line") { if (s.lines.on) { open.delete("entre"); chain = null; flow.push(ruleNode(s)); } continue; }
    const joined = !!(it.join || it.sup);
    if (it.kind === "state" || it.kind === "rating") {       // estado o valoración «entre los datos»: su propia línea
      const st = it.kind === "state" ? stateOf(s, it.sid) : null;
      const on = it.kind === "state" ? s.states.on && st && st.place === "entre" : s.rate.on && s.rate.place === "entre";
      if (!on) continue;
      const n = it.kind === "state" ? stateNode(s, st, rec) : rateNode(s, rec, facts);
      if (!n) { if (!joined) chain = null; continue; }
      const to = chain === "entre" ? open.get("entre") : undefined;
      if (it.join && to) to.parts.push(...decoSep(it), n);
      else startLine("entre", it.kind === "state" ? { it, st: true, parts: [n] } : { it, rate: true, parts: [n] });
      continue;
    }
    const g = placed(it) ? it.place + (it.onImg && onImg ? "+img" : "") : "entre";
    const c = itemContent(s, it, rec, src);
    if (c == null) { if (!joined) chain = null; continue; }
    const to = chain === g ? open.get(g) : undefined;
    if (it.sup && to && !to.rate && !to.st) {
      const sup = styleItem(h("sup", { cls: "cb-sup", css: { "--cb-sep-g": it.gap } }, c), s, it, true);
      to.parts[to.parts.length - 1].appendChild(sup);
    }
    else if (it.join && to) to.parts.push(...sepNode(s, it), itemSpan(s, it, c));
    else startLine(g, { it, parts: [itemSpan(s, it, c)] });
  }
  return { flow: flow.map(x => x instanceof Node ? x : node(x)), floats: [...floats.values()].map(f => ({ it: f.it, img: f.img, nodes: f.lines.map(node) })) };
}
const append = <E extends HTMLElement>(el: E, kids: Node[]): E => { el.append(...kids); return el; };
const initials = (name: string) => String(name).split(/[\s\-_]+/).filter(w => /[\p{L}\d]/u.test(w)).slice(0, 2).map(w => w[0]).join("").toUpperCase();
/* ---------- sin imagen: portada, iniciales u hueco, en una <img> que ocupa lo mismo que una imagen ---------- */
let curRatio = 1.5;                                       // alto / ancho de las imágenes de la vista (media); 2:3 si no hay
const blend = (a: string, b: string, t: number) => { const A = hex6(a), B = hex6(b), c = (i: number) => Math.round(parseInt(A.slice(i, i + 2), 16) * (1 - t) + parseInt(B.slice(i, i + 2), 16) * t).toString(16).padStart(2, "0"); return "#" + c(1) + c(3) + c(5); };
/* lo que se dibuja en lugar de la imagen (también para la muestra del panel, con un título y un subtítulo de ejemplo) */
export function coverData(s: Model, title: string, sub: string): CoverData {
  const im = s.img;
  if (im.empty === "portada") {
    const hs = hashStr(title);
    const [bg, fg] = im.cvColors === "card" ? [hex6(tokCol("det", s)), hex6(s.col.bg)] : COVER_PALETTE[hs % COVER_PALETTE.length];
    return { kind: "portada", title, sub, bg, fg, shape: im.cvShape === "none" ? -1 : (hs >>> 5) % SHAPE_COUNT, font: fontStack(im.cvFont || "Georgia") };
  }
  return { kind: im.empty, title, bg: blend(s.col.bg, s.col.text, 0.06), fg: hex6(tokCol("det", s)), shape: -1, ini: initials(title) };
}
function placeholderImg(s: Model, rec: Rec) {
  const im = s.img;
  const sub = im.empty === "portada" && im.cvText ? toArr(rec.get(im.cvText)).map(v => display(clean(v))).filter(Boolean).join(" · ") : "";
  const d = coverData(s, rec.name, sub);
  return h("img", { cls: "cb-ph", attr: { alt: rec.name, src: coverSrc(d, curRatio), "data-r": curRatio, "data-cv": JSON.stringify(d), draggable: "false" } });
}
export function cardNode(s: Model, rec: Rec, src: Source, facts: Facts): HTMLDivElement {
  const im = s.img, sp = imgSrc(s, facts), url = sp ? src.imageUrl(rec, sp) : null;
  /* la nota no tiene imagen: en su sitio, una generada que ocupa lo mismo (el mismo ajuste y la misma posición) */
  const ph = !url && !!sp && (im.empty === "iniciales" || im.empty === "hueco" || im.empty === "portada");
  const fit = url || ph ? im.fit : "none", pos = im.fit === "fondo" ? "top" : im.pos;
  let media: HTMLDivElement | null = null;
  if (url || ph) {
    const img = url ? h("img", { attr: { alt: rec.name, loading: "lazy", draggable: "false", src: url } }) : placeholderImg(s, rec);
    media = h("div", "cb-media", fit === "enmarcada" ? h("div", "cb-fr", img) : img,
      im.grain ? h("div", "cb-grain") : null, fit === "fondo" && im.shade ? h("div", "cb-shade") : null);
  }
  let rateFloat: HTMLDivElement | null = null, floatOnImg = false;
  if (s.rate.on && s.rate.place !== "entre") {
    const n = rateNode(s, rec, facts);
    if (n) { floatOnImg = !!(s.rate.onImg && media && fit !== "fondo"); rateFloat = floatBox(s.rate); rateFloat.appendChild(n); }
  }
  const body = bodyNodes(s, rec, src, facts, !!media && fit !== "fondo");
  /* estados y datos colocados en uno de los 9 puntos: los de un mismo punto, apilados (primero los estados) */
  const stCard: HTMLDivElement[] = [], stImg: HTMLDivElement[] = [];
  const groups = new Map<string, { at: { place: string; mx: number; my: number }; img: boolean; ns: Node[] }>();
  const add = (k: string, at: { place: string; mx: number; my: number }, img: boolean, ns: Node[]) => {
    if (!groups.has(k)) groups.set(k, { at, img, ns: [] });
    groups.get(k)!.ns.push(...ns);
  };
  if (s.states.on) {
    for (const st of s.states.list) {
      if (st.place === "entre") continue;
      const n = stateNode(s, st, rec); if (!n) continue;
      const img = !!(st.onImg && media && fit !== "fondo");
      add(st.place + (img ? "+img" : ""), st, img, [n]);
    }
  }
  for (const f of body.floats) add(f.it.place + (f.img ? "+img" : ""), f.it, f.img, f.nodes);
  for (const g of groups.values()) {
    const box = append(floatBox(g.at, " cb-stg al-" + g.at.place[1]), g.ns);
    (g.img ? stImg : stCard).push(box);
  }
  if (media) { if (floatOnImg) media.appendChild(rateFloat!); media.append(...stImg); }
  let foot: HTMLDivElement | null = null;
  if (s.foot.on && s.fitems.length) {
    const lines = s.fitems.map(it => { it._foot = true; const c = itemContent(s, it, rec, src); delete it._foot;
      return c == null ? null : append(lineNode(it), [itemSpan(s, it, c)]); }).filter((x): x is HTMLDivElement => !!x);
    if (lines.length) foot = h("div", "cb-foot", lines);
  }
  return h("div", "cb-cell", h("article", { cls: "cb-card f-" + fit + " p-" + pos, attr: { tabindex: 0, "data-path": rec.path } },
    h("div", "cb-in", h("div", "cb-main", media, h("div", "cb-body", body.flow)), foot),
    floatOnImg ? null : rateFloat, stCard));
}

/* variables y clases de la rejilla */
export function gridSetup(grid: HTMLElement, s: Model, uid: string) {
  const c = s.card, im = s.img, col = s.col, hv = s.hover, L = s.lines, f = s.foot;
  const a = ((im.amt && im.amt[im.fx]) || 0) / 100;
  let filt = "";
  if (im.fx === "bn") filt = "grayscale(" + a + ") ";
  if (im.fx === "inv") filt = "invert(" + a + ") ";
  if (im.fx === "duo") filt = "url(#cbduo-" + uid + ") ";
  if (im.fx === "blur") filt = "blur(" + (a * 10).toFixed(1) + "px) ";
  filt += "brightness(" + im.bright / 100 + ")";
  const r = c.fmt === "libre" ? null : String(c.fmt).split("/").map(Number);
  const al = s.font.align;
  grid.className = "cb-grid" + (c.fill ? " is-fill" : "") + (hv.on ? " hv-on" : "") + (hv.under ? " hv-u" : "") + (al === "center" || al === "right" ? " ln-" + al : "");
  setVars(grid, {
    "--cb-gap": c.gap + "px", "--cb-cw": c.w + "px",
    "--cb-bg": col.grad ? "linear-gradient(" + col.angle + "deg," + col.bg + "," + col.bg2 + ")" : col.bg, "--cb-bgc": col.bg, "--cb-text": col.text, "--cb-det": col.det,
    "--cb-bw": col.bw + "px", "--cb-bc": col.bc, "--cb-rad": c.radius + "px", "--cb-irad": Math.max(0, c.radius - col.bw) + "px", "--cb-pad": c.pad,
    "--cb-minp": r && r[0] ? (r[1] / r[0] * 100).toFixed(3) + "%" : null, "--cb-minh": r && r[0] ? null : c.h + "px",
    "--cb-font": fontStack(s.font.family), "--cb-w": s.font.weight, "--cb-fs": s.font.size, "--cb-align": al,
    "--cb-frame": im.frame, "--cb-filter": filt, "--cb-imgtf": im.fx === "blur" ? "scale(1.08)" : "none", "--cb-noise": NOISE,
    "--cb-shc": im.shadeC, "--cb-hc": tokCol(hv.color, s), "--cb-hb": hexA(hv.bg, hv.bgOp / 100),
    "--cb-ln-h": L.w + "px", "--cb-ln-c": tokCol(L.color, s), "--cb-ln-w": L.width === "full" ? "100%" : L.width === "pct" ? L.pct + "%" : "0",
    "--cb-ln-mt": L.mt == null ? 1.6 : L.mt, "--cb-ln-mb": L.mb == null ? 1.6 : L.mb,
    "--cb-ft-bg": f.bg, "--cb-ft-bt": f.lw > 0 ? f.lw + "px solid " + f.lc : "none",
  });
}
export function duoSVG(s: Model, uid: string) {
  const im = s.img, a = ((im.amt && im.amt.duo) || 0) / 100;
  const p = (c: string) => [1, 3, 5].map(i => parseInt(hex6(c).slice(i, i + 2), 16) / 255);
  const A = p(im.duo1), B = p(im.duo2);
  return svg("svg", { class: "cb-duo", width: 0, height: 0, "aria-hidden": "true" }, svg("defs", null,
    svg("filter", { id: "cbduo-" + uid, "color-interpolation-filters": "sRGB" },
      svg("feColorMatrix", { type: "matrix", values: ".3 .59 .11 0 0 .3 .59 .11 0 0 .3 .59 .11 0 0 0 0 0 1 0", result: "g" }),
      svg("feComponentTransfer", { in: "g", result: "d" }, ["R", "G", "B"].map((k, i) => svg("feFunc" + k, { type: "table", tableValues: A[i].toFixed(3) + " " + B[i].toFixed(3) }))),
      svg("feComposite", { in: "d", in2: "SourceGraphic", operator: "arithmetic", k1: 0, k2: a, k3: 1 - a, k4: 0 }))));
}

/* pinta los grupos en `root`; renderKey(el, group) pinta la cabecera de un grupo. El CSS libre lo aplica la vista. */
export interface Group { hasKey: boolean; key?: Value; recs: Rec[] }
export function renderModel(root: HTMLElement, s: Model, groups: Group[], src: Source, facts: Facts, uid: string, renderKey?: (el: HTMLElement, g: Group) => void) {
  curRatio = +root.dataset.cbRatio! || 1.5;
  root.empty();
  if (s.img.fx === "duo") root.appendChild(duoSVG(s, uid));
  for (const g of groups) {
    if (g.hasKey) { const hd = root.createDiv({ cls: "cb-group" }); renderKey && renderKey(hd, g); }
    const grid = root.createDiv();
    gridSetup(grid, s, uid);
    grid.append(...g.recs.map(rec => cardNode(s, rec, src, facts)));
  }
  postRender(root);
}

/* ---------- ajustes que necesitan medidas reales ---------- */
export function postRender(root: HTMLElement) {
  /* «Ajustar»: el texto va siempre en una sola línea y encoge (nunca agranda) hasta que cabe a lo ancho,
     con su superíndice pegado. */
  root.querySelectorAll<HTMLElement>(".cb-l.fit").forEach(el => {
    let k = 1;
    for (let n = 0; n < 4; n++) {                     // el superíndice no encoge con el título: se repite hasta que cabe
      setVars(el, { "--k": k.toFixed(4) });
      const avail = el.clientWidth, need = el.scrollWidth;
      if (!(avail > 0 && need > avail + 0.5)) break;
      k *= avail / need * 0.99;
    }
  });
  /* título en varias líneas: nunca parte una palabra; si la más larga no cabe a lo ancho, encoge lo justo */
  root.querySelectorAll<HTMLElement>(".cb-l:not(.fit)").forEach(el => {
    if (!el.querySelector('.cb-i[data-prop="file.name"]')) return;
    setVars(el, { "--k": 1 }); el.addClass("cb-whole");
    const avail = el.clientWidth;
    el.addClass("cb-measure"); const need = el.scrollWidth; el.removeClass("cb-measure");
    if (avail > 0 && need > avail + 0.5) setVars(el, { "--k": (avail / need * 0.985).toFixed(4) });
  });
  fixCovers(root);
  root.querySelectorAll<HTMLElement>("sup.cb-sup").forEach(alignSup);
  root.querySelectorAll<HTMLElement>(".cb-frac").forEach(fracGaps);
  root.querySelectorAll<HTMLElement>(".f-original.p-left .cb-body, .f-original.p-right .cb-body").forEach(cutBody);
  root.querySelectorAll<HTMLElement>(".cb-rule.cw").forEach(r => {
    const prev = r.previousElementSibling;
    if (!prev || !prev.classList.contains("cb-l")) { setVars(r, { "--cb-rule-cw": "30%" }); return; }
    const rg = document.createRange(); rg.selectNodeContents(prev);
    setVars(r, { "--cb-rule-cw": Math.min(rg.getBoundingClientRect().width, prev.clientWidth) + "px" });
  });
}
/* las imágenes generadas, con la proporción que toca: en «Original», la media de las imágenes ya cargadas
   de la vista (para que la tarjeta mida igual que las demás); en los demás ajustes, la del propio hueco */
function fixCovers(root: HTMLElement) {
  const phs = root.querySelectorAll<HTMLImageElement>("img.cb-ph"); if (!phs.length) return;
  const real = [...root.querySelectorAll<HTMLImageElement>(".cb-media img:not(.cb-ph)")].filter(i => i.complete && i.naturalWidth > 0);
  const avg = real.length ? real.reduce((a, i) => a + i.naturalHeight / i.naturalWidth, 0) / real.length : (+root.dataset.cbRatio! || 1.5);
  root.dataset.cbRatio = String(+avg.toFixed(4));
  phs.forEach(im => {
    const card = im.closest(".cb-card");
    const r = card && card.classList.contains("f-original") ? avg : im.clientWidth > 0 && im.clientHeight > 0 ? im.clientHeight / im.clientWidth : avg;
    if (Math.abs(r - +im.dataset.r!) / r > 0.01) { im.src = coverSrc(JSON.parse(im.dataset.cv!) as CoverData, r); im.dataset.r = String(r); }
  });
}
let MC: CanvasRenderingContext2D | null = null;
function measureCtx() { return (MC ??= createEl("canvas").getContext("2d"))!; }
/* superíndice: su borde superior a la altura del borde superior de las letras a las que acompaña */
function inkTop(el: Element, text: string) {
  const cs = getComputedStyle(el), mc = measureCtx();
  mc.font = cs.fontStyle + " " + cs.fontWeight + " " + cs.fontSize + " " + cs.fontFamily;
  if (cs.textTransform === "uppercase") text = text.toUpperCase();
  return mc.measureText(text || "H").actualBoundingBoxAscent;
}
function alignSup(sp: HTMLElement) {
  const base = sp.parentElement!; let t = "";
  base.childNodes.forEach(n => { if (n !== sp) t += n.textContent; });
  setVars(sp, { "--cb-sup-va": (inkTop(base, t.trim()) - inkTop(sp, sp.textContent!.trim())).toFixed(2) + "px" });
}
/* fracción: el mismo hueco visible entre cada número y la raya, medido fila a fila */
let PC: HTMLCanvasElement | null = null, PX: CanvasRenderingContext2D | null = null;
function glyphRows(el: HTMLElement) {
  const pc = PC ??= createEl("canvas"), ctx = (PX ??= pc.getContext("2d", { willReadFrequently: true }))!;
  const cs = getComputedStyle(el), S = 4, txt = el.textContent!;
  const font = cs.fontStyle + " " + cs.fontWeight + " " + (parseFloat(cs.fontSize) * S) + "px " + cs.fontFamily;
  ctx.font = font; const m = ctx.measureText(txt);
  const ox = Math.ceil(m.actualBoundingBoxLeft) + 2, oy = Math.ceil(m.actualBoundingBoxAscent) + 2;
  pc.width = Math.max(1, Math.ceil(m.actualBoundingBoxLeft + m.actualBoundingBoxRight) + 4); pc.height = Math.max(1, Math.ceil(m.actualBoundingBoxAscent + m.actualBoundingBoxDescent) + 4);
  ctx.font = font; ctx.fillStyle = "#000"; ctx.fillText(txt, ox, oy);
  const w = pc.width, hh = pc.height, px = ctx.getImageData(0, 0, w, hh).data, rows: { y: number; l: number; r: number }[] = [];
  for (let y = 0; y < hh; y++) { let l = -1, r = -1; for (let x = 0; x < w; x++) if (px[(y * w + x) * 4 + 3] > 90) { if (l < 0) l = x; r = x; } if (l >= 0) rows.push({ y: (y + 0.5 - oy) / S, l: (l - ox) / S, r: (r + 1 - ox) / S }); }
  const rg = document.createRange(); rg.selectNodeContents(el); const box = rg.getBoundingClientRect();
  const probe = el.createEl("i", { cls: "cb-probe" }); const base = probe.getBoundingClientRect().top; probe.remove();
  return rows.map(q => ({ y: base + q.y, l: box.left + q.l, r: box.left + q.r }));
}
function fracGaps(fr: HTMLElement) {
  const n = fr.querySelector<HTMLElement>(".n"), sl = fr.querySelector<SVGElement>(".sl"), d = fr.querySelector<HTMLElement>(".d");
  if (!n || !sl || !d || !fr.isConnected || !fr.getClientRects().length) return;
  sl.addClass("has-gap"); fr.addClass("has-top");
  setVars(sl, { "--cb-sl-ml": "0px", "--cb-sl-mr": "0px" }); setVars(fr, { "--cb-fr-top": "0px" });
  const bar = () => { const r = sl.getBoundingClientRect(), w = r.width * (+sl.dataset.w!) / 100;
    return { t: r.top, b: r.bottom, left: (y: number) => r.left + (r.bottom - y) / r.height * (r.width - w), right: (y: number) => r.left + w + (r.bottom - y) / r.height * (r.width - w) }; };
  const g = 0.1 * parseFloat(getComputedStyle(fr.parentElement!).fontSize);
  let B = bar(), N = glyphRows(n), Z = glyphRows(d);
  if (!N.length || !Z.length) return;
  const gapN = Math.min(...N.map(q => B.left(q.y) - q.r));
  const gapD = Math.min(...Z.map(q => q.l - B.right(q.y)));
  setVars(sl, { "--cb-sl-ml": (g - gapN).toFixed(2) + "px", "--cb-sl-mr": (g - gapD).toFixed(2) + "px" });
  B = bar(); N = glyphRows(n); Z = glyphRows(d);
  const ys = N.concat(Z).map(q => q.y), box = fr.parentElement!.getBoundingClientRect();
  const top = Math.min(B.t, ...ys), bot = Math.max(B.b, ...ys);
  setVars(fr, { "--cb-fr-top": ((box.top + box.bottom) / 2 - (top + bot) / 2).toFixed(2) + "px" });
}
/* texto que no cabe junto a una imagen «Original» lateral: se corta con «…» */
function cutBody(body: HTMLElement) {
  const kids = [...body.children] as HTMLElement[];
  kids.forEach(k => { k.classList.remove("cb-hid", "cb-clamp", "cb-ell"); setVars(k, { "--cb-clamp": null }); });
  if (body.scrollHeight <= body.clientHeight + 1) return;
  const limit = body.getBoundingClientRect().bottom - parseFloat(getComputedStyle(body).paddingBottom) + 0.5;
  let cut = false, lastShown: HTMLElement | null = null;
  for (const k of kids) {
    if (cut) { k.classList.add("cb-hid"); continue; }
    if (k.getBoundingClientRect().bottom <= limit) { lastShown = k; continue; }
    cut = true;
    let n = 0;
    if (k.classList.contains("cb-l")) {
      const rg = document.createRange(); rg.selectNodeContents(k);
      const lines = new Map<number, number>();
      [...rg.getClientRects()].forEach(r => { if (!r.height) return; const t = Math.round(r.top); lines.set(t, Math.max(lines.get(t) || 0, r.bottom)); });
      const bottoms = [...lines.entries()].sort((a, b) => a[0] - b[0]).map(x => x[1]);
      const merged: number[] = []; bottoms.forEach(b => { if (!merged.length || b > merged[merged.length - 1] + 2) merged.push(b); else merged[merged.length - 1] = Math.max(merged[merged.length - 1], b); });
      n = merged.filter(b => b <= limit).length;
    }
    if (n > 0) { k.classList.add("cb-clamp"); setVars(k, { "--cb-clamp": n }); lastShown = k; }
    else { k.classList.add("cb-hid"); if (lastShown && lastShown.classList.contains("cb-l")) lastShown.classList.add("cb-ell"); }
  }
}

/* texto plano de lo que pinta un nodo (para las tarjetitas del panel): saltos de línea y píldoras con « · »,
   el encabezado con «: » */
export function nodeText(n: Node | null): string {
  if (!n) return "";
  let out = "";
  const walk = (node: Node) => node.childNodes.forEach(c => {
    if (c.nodeType === 3) { out += c.textContent; return; }
    if (c.nodeName === "BR") { out += " · "; return; }
    const cl = (c as Element).classList;
    if (cl && cl.contains("cb-head")) { out += c.textContent + ": "; return; }
    if (cl && cl.contains("cb-pill") && c.previousSibling && c.previousSibling.nodeName === "SPAN") out += " · ";
    walk(c);
  });
  if (n.nodeType === 1 && n.nodeName !== "#document-fragment") { const w = createFragment(); w.appendChild(n.cloneNode(true)); walk(w); }
  else walk(n);
  return out.replace(/\s+/g, " ").trim();
}
/* texto plano de lo que pinta un dato en la primera nota que lo tenga */
export function plainSample(s: Model, it: Item, src: Source): string | null {
  for (const rec of src.recs.slice(0, 200)) {
    const c = itemContent(s, it, rec, src);
    if (c != null) return nodeText(c);
  }
  return null;
}
export { textish };
