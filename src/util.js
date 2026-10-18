/* Utilidades compartidas: texto, valores de las notas, números, colores. */
import { decSep, numLocale } from "./i18n.js";

export const clone = o => JSON.parse(JSON.stringify(o));
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
/* número para el panel, con la coma o el punto del idioma */
export const fmt = (v, d) => { const n = Number(v); const t = (d != null && d !== "" ? n.toFixed(d) : String(+n.toFixed(3))); return t.replace(".", decSep()); };
export const toArr = v => Array.isArray(v) ? v : (v == null ? [] : [v]);
export const isEmpty = v => v == null || v === "" || (Array.isArray(v) && !v.length);
export function merge(a, b) {
  for (const k in b) {
    if (b[k] && typeof b[k] === "object" && !Array.isArray(b[k]) && a[k] && typeof a[k] === "object" && !Array.isArray(a[k])) merge(a[k], b[k]);
    else a[k] = b[k] === undefined ? a[k] : clone(b[k]);
  }
  return a;
}

/* valores: quita los «\r» colgando (los hay en algunas notas) y los espacios de los lados */
export const clean = s => String(s == null ? "" : s).replace(/\r/g, "").trim();
export const isEmail = v => /^(mailto:)?[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(clean(v));
export const isPhone = v => /^(tel:)?\+?[\d\s().-]{7,}$/.test(clean(v));
export const isURL = v => typeof v === "string" && /^https?:\/\//i.test(clean(v));
export const isImageURL = v => isURL(v) && /\.(png|jpe?g|gif|webp|avif|svg|bmp)(\?|#|$)/i.test(clean(v));

/* [[ruta|alias]] -> {path, text} */
export function parseLink(s) {
  const m = /^!?\[\[([^\]|#^]+)(?:[#^][^\]|]*)?(?:\|([^\]]+))?\]\]$/.exec(clean(s));
  if (!m) return null;
  const path = m[1].trim();
  return { path, text: (m[2] || path.split("/").pop().replace(/\.md$/i, "")).trim() };
}
export const display = s => { const l = parseLink(s); return l ? l.text : clean(s).replace(/^#/, ""); };
export const camelSplit = t => /^[a-z]+[A-Z]/.test(t) ? t.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase() : t;

/* «35.400 monthly listeners» -> 35400 · «43 mil seguidores» -> 43000 · «4,1 M» -> 4100000 */
export function parseCount(v) {
  if (typeof v === "number") return v;
  if (v == null) return NaN;
  const t = clean(Array.isArray(v) ? v[0] : v).toLowerCase();
  const m = /(-?\d[\d.,\s]*\d|-?\d)\s*(mil|millones|mill|m\b|k\b)?/.exec(t);
  if (!m) return NaN;
  let s = m[1].replace(/\s/g, "");
  if (/,\d+$/.test(s) && !/,\d{3}$/.test(s)) s = s.replace(/\./g, "").replace(",", ".");   // 4,1 · 12,35
  else if (/\.\d{3}(\.|$)/.test(s) && !/\./.test(s.replace(/\.\d{3}/g, ""))) s = s.replace(/\./g, "");   // 35.400 · 1.180.000
  else s = s.replace(/,/g, "");                                                       // 35,400 · 4.1
  let n = parseFloat(s);
  if (!isFinite(n)) return NaN;
  const suf = m[2];
  if (suf === "mil" || suf === "k") n *= 1e3;
  else if (suf) n *= 1e6;
  return n;
}
/* valoraciones: «⭐⭐⭐⭐» -> 4; también números */
export function starCount(v) {
  if (v == null) return null;
  if (typeof v === "number") return v;
  const s = clean(Array.isArray(v) ? v[0] : v);
  const n = (s.match(/⭐|★/g) || []).length;
  if (n) return n;
  const f = parseFloat(s.replace(",", "."));
  return isFinite(f) && /^-?\d/.test(s) ? f : null;
}
export const isStarText = v => typeof v === "string" && /^[⭐★\s]+$/.test(clean(v)) && /⭐|★/.test(v);

export function fmtNum(n, mode, dec) {
  if (mode === "short") {
    const a = Math.abs(n), sp = numLocale() === "es-ES" ? " " : ""; let d = n, suf = "";
    if (a >= 1e6) { d = n / 1e6; suf = sp + "M"; } else if (a >= 1e3) { d = n / 1e3; suf = sp + "K"; }
    return d.toLocaleString(numLocale(), { maximumFractionDigits: dec }) + suf;
  }
  return n.toLocaleString(numLocale(), { minimumFractionDigits: dec, maximumFractionDigits: dec, useGrouping: "always" });
}
const REDES = { "instagram.com": "Instagram", "tiktok.com": "TikTok", "twitter.com": "X", "x.com": "X", "facebook.com": "Facebook",
  "youtube.com": "YouTube", "soundcloud.com": "SoundCloud", "spotify.com": "Spotify", "bandcamp.com": "Bandcamp",
  "threads.net": "Threads", "bsky.app": "Bluesky", "linkedin.com": "LinkedIn", "wikipedia.org": "Wikipedia" };
/* nombre del sitio: «Instagram @usuario», «Bandcamp», o el dominio */
export function siteName(u) {
  let url; try { url = new URL(clean(u)); } catch { return clean(u); }
  const host = url.hostname.replace(/^www\./, "");
  const red = Object.keys(REDES).find(h => host === h || host.endsWith("." + h));
  if (!red) return host;
  const seg = url.pathname.split("/").filter(Boolean)[0];
  if (red === "instagram.com" || red === "tiktok.com" || red === "twitter.com" || red === "x.com" || red === "threads.net")
    return REDES[red] + (seg ? " @" + seg.replace(/^@/, "") : "");
  if (red === "bandcamp.com" && host !== red) return REDES[red] + " " + host.split(".")[0];   // «Bandcamp theflenser»
  return REDES[red];
}
/* el nombre de la red aparte, para poder destacarlo («Instagram» @usuario) */
export function siteParts(u) {
  const n = siteName(u), net = Object.values(REDES).find(r => n === r || n.startsWith(r + " "));
  return net ? [net, n.slice(net.length)] : ["", n];
}
export const bareURL = u => clean(u).replace(/^https?:\/\/(www\.)?/, "").replace(/[?#].*$/, "").replace(/\/$/, "");

/* ---------- colores ---------- */
export const hex6 = h => (/^#[0-9a-f]{6}/i.test(h || "") ? h.slice(0, 7) : "#000000");
export function hexA(h, a) { return hex6(h) + Math.round(clamp(a, 0, 1) * 255).toString(16).padStart(2, "0"); }
export function hexToHsva(h) {
  h = /^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(h || "") ? h : "#000000";
  const r = parseInt(h.substr(1, 2), 16) / 255, g = parseInt(h.substr(3, 2), 16) / 255, b = parseInt(h.substr(5, 2), 16) / 255;
  const a = h.length === 9 ? parseInt(h.substr(7, 2), 16) / 255 : 1;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let hu = 0;
  if (d) { hu = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; hu *= 60; if (hu < 0) hu += 360; }
  return { h: hu, s: mx ? d / mx : 0, v: mx, a };
}
export function hsvaToHex(o) {
  const f = n => { const k = (n + o.h / 60) % 6; return o.v - o.v * o.s * Math.max(0, Math.min(k, 4 - k, 1)); };
  const to = x => Math.round(x * 255).toString(16).padStart(2, "0");
  return "#" + to(f(5)) + to(f(3)) + to(f(1)) + (o.a < 0.999 ? to(o.a) : "");
}
/* cualquier color CSS -> #rrggbb / #rrggbbaa (los var(--…) se quedan como están) */
let colorCtx = null;
export function normColor(c, fallback) {
  const s = clean(c);
  if (!s) return fallback;
  if (/^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(s)) return s.toLowerCase();
  if (/^#[0-9a-f]{3,4}$/i.test(s)) return ("#" + s.slice(1).split("").map(x => x + x).join("")).toLowerCase();
  if (/var\(|currentcolor|inherit/i.test(s)) return s;
  if (/^transparent$/i.test(s)) return "#00000000";
  try {
    colorCtx ??= createEl("canvas").getContext("2d");
    colorCtx.fillStyle = "#010203"; colorCtx.fillStyle = s;
    const out = String(colorCtx.fillStyle);
    if (out === "#010203" && !/^#010203$/i.test(s)) return fallback ?? s;
    if (out[0] === "#") return out.toLowerCase();
    const m = /rgba?\(([^)]+)\)/.exec(out);
    if (m) { const [r, g, b, a = 1] = m[1].split(",").map(x => parseFloat(x)); return hexA("#" + [r, g, b].map(x => Math.round(x).toString(16).padStart(2, "0")).join(""), a); }
  } catch { /* sin canvas */ }
  return s;
}
/* primera familia de una pila CSS: «'Roboto Condensed', 'Arial Narrow', sans-serif» -> «Roboto Condensed» */
export function firstFamily(stack) {
  const s = clean(stack);
  if (!s) return null;
  if (/^var\(--font-interface\)/.test(s)) return "Interfaz";
  if (/^var\(--font-text\)/.test(s)) return "Texto de Obsidian";
  return s.split(",")[0].trim().replace(/^['"]|['"]$/g, "") || null;
}
