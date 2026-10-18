/* Construcción del DOM sin cadenas HTML (createEl / createSvg de Obsidian).
   h("div", { cls, text, attr, css, on }, ...hijos): los hijos pueden ser nodos, textos, listas o nada (null, false, ""). */

/** @typedef {{ cls?: string, text?: string, attr?: Record<string, any>, css?: Record<string, any>, on?: Record<string, (ev: any) => void> }} HOpts */

/** @param {Node} el @param {any[]} kids */
export function append(el, kids) {
  for (const k of kids) {
    if (k == null || k === false || k === "") continue;
    if (Array.isArray(k)) append(el, k);
    else el.appendChild(typeof k === "string" || typeof k === "number" ? document.createTextNode(String(k)) : k);
  }
  return el;
}
/** @param {Element} el @param {HOpts | string | null | undefined} o */
function setup(el, o) {
  if (!o) return;
  if (typeof o === "string") { if (o) el.setAttribute("class", o); return; }
  if (o.cls) el.setAttribute("class", o.cls);
  if (o.text != null) el.textContent = o.text;
  if (o.attr) for (const [k, v] of Object.entries(o.attr)) if (v != null && v !== false) el.setAttribute(k, v === true ? "" : String(v));
  if (o.css) setVars(/** @type {HTMLElement} */ (el), o.css);
  if (o.on) for (const [k, f] of Object.entries(o.on)) el.addEventListener(k, f);
}
/**
 * @param {string} tag
 * @param {HOpts | string | null} [o]
 * @param {...any} kids
 * @returns {any} el elemento (HTMLElement, o el que toque: botón, campo…)
 */
export function h(tag, o, ...kids) {
  const el = createEl(/** @type {any} */ (tag));
  setup(el, o);
  return /** @type {HTMLElement} */ (append(el, kids));
}
/**
 * @param {string} tag
 * @param {Record<string, any> | null} [attr]
 * @param {...any} kids
 * @returns {SVGElement}
 */
export function svg(tag, attr, ...kids) {
  const el = createSvg(/** @type {any} */ (tag));
  if (attr) for (const [k, v] of Object.entries(attr)) if (v != null && v !== false) el.setAttribute(k, String(v));
  return /** @type {SVGElement} */ (append(el, kids));
}
/** @param {...any} kids */
export function frag(...kids) { return /** @type {DocumentFragment} */ (append(createFragment(), kids)); }

/* variables CSS de un elemento (lo que elige el usuario); "" o null las quita */
/** @param {HTMLElement | SVGElement} el @param {Record<string, any>} vars */
export function setVars(el, vars) {
  const out = {};
  for (const [k, v] of Object.entries(vars)) out[k] = v == null ? "" : String(v);
  /** @type {any} */ (el).setCssProps(out);
}

/* intercala un separador (texto o función que crea un nodo) entre los nodos de una lista */
/** @param {any[]} list @param {string | (() => Node)} sep */
export function joinNodes(list, sep) {
  const out = [];
  list.forEach((n, i) => { if (i) out.push(typeof sep === "function" ? sep() : sep); out.push(n); });
  return out;
}
