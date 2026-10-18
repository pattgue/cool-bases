/* Construcción del DOM sin cadenas HTML (createEl / createSvg de Obsidian).
   h("div", { cls, text, attr, css, on }, ...hijos): los hijos pueden ser nodos, textos, listas o nada (null, false, ""). */

export type Kid = Node | string | number | null | undefined | false | Kid[];
export type AttrVal = string | number | boolean | null | undefined;
export type CssVal = string | number | null | undefined;
export interface HOpts { cls?: string; text?: string; attr?: Record<string, AttrVal>; css?: Record<string, CssVal>; on?: Record<string, (ev: Event) => void> }

export function append<T extends Node>(el: T, kids: Kid[]): T {
  for (const k of kids) {
    if (k == null || k === false || k === "") continue;
    if (Array.isArray(k)) append(el, k);
    else el.appendChild(typeof k === "string" || typeof k === "number" ? document.createTextNode(String(k)) : k);
  }
  return el;
}
function setup(el: HTMLElement, o: HOpts | string | null | undefined) {
  if (!o) return;
  if (typeof o === "string") { if (o) el.setAttribute("class", o); return; }
  if (o.cls) el.setAttribute("class", o.cls);
  if (o.text != null) el.textContent = o.text;
  if (o.attr) for (const [k, v] of Object.entries(o.attr)) if (v != null && v !== false) el.setAttribute(k, v === true ? "" : String(v));
  if (o.css) setVars(el, o.css);
  if (o.on) for (const [k, f] of Object.entries(o.on)) el.addEventListener(k, f);
}
export function h<K extends keyof HTMLElementTagNameMap>(tag: K, o?: HOpts | string | null, ...kids: Kid[]): HTMLElementTagNameMap[K] {
  const el = createEl(tag);
  setup(el, o);
  return append(el, kids);
}
export function svg(tag: string, attr?: Record<string, AttrVal> | null, ...kids: Kid[]): SVGElement {
  const el: SVGElement = createSvg(tag as keyof SVGElementTagNameMap);
  if (attr) for (const [k, v] of Object.entries(attr)) if (v != null && v !== false) el.setAttribute(k, String(v));
  return append(el, kids);
}
export function frag(...kids: Kid[]): DocumentFragment { return append(createFragment(), kids); }

/* variables CSS de un elemento (lo que elige el usuario); "" o null las quita */
export function setVars(el: HTMLElement | SVGElement, vars: Record<string, CssVal>) {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(vars)) out[k] = v == null ? "" : String(v);
  el.setCssProps(out);
}

/* intercala un separador (texto o función que crea un nodo) entre los nodos de una lista */
export function joinNodes(list: Kid[], sep: string | (() => Node)): Kid[] {
  const out: Kid[] = [];
  list.forEach((n, i) => { if (i) out.push(typeof sep === "function" ? sep() : sep); out.push(n); });
  return out;
}
