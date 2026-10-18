/* Lo que ocupa el sitio de la imagen cuando la nota no tiene: una <img> con un SVG generado, para que le valga
   el mismo CSS que a una imagen y la tarjeta mida lo mismo.
   - portada: fondo de color, el título arriba en serif, una forma sencilla en el centro y un texto abajo
     en mayúsculas espaciadas (como las portadas de boceto/editor-v3.html)
   - iniciales: hueco suave con las iniciales grandes
   - hueco: solo el hueco suave
   Se dibuja para una proporción (alto / ancho): la media de las imágenes de la vista o la del hueco. */

/* parejas fondo / tinta, elegidas para que se lean bien y combinen entre sí */
export const COVER_PALETTE: [string, string][] = [
  ["#d9d2c3", "#1f3a5f"], ["#8c3b2b", "#f1e3c8"], ["#1d2b2a", "#9fd3c7"], ["#ece6da", "#222222"], ["#e8c547", "#1c1c1c"],
  ["#2f3e46", "#f2e9e4"], ["#f4a259", "#2b2d42"], ["#3d405b", "#f2cc8f"], ["#e07a5f", "#fdf0d5"], ["#6b705c", "#ffe8d6"],
];
const SHAPES = 5;

/* un número fijo por título (así cada nota saca siempre los mismos colores y la misma forma) */
export function hashStr(t: unknown): number { let h = 2166136261; for (const c of String(t)) { h ^= c.codePointAt(0)!;
 h = Math.imul(h, 16777619) >>> 0; } return h; }

const XML_ESC: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" };
const xmlEsc = (s: unknown) => String(s).replace(/[&<>"']/g, c => XML_ESC[c]);
/* en una imagen SVG no hay variables CSS ni fuentes de la página: solo las del sistema, con una genérica detrás */
function svgFont(stack: string | undefined, generic: string) {
  const fams = String(stack || "").split(",").map(x => x.trim()).filter(x => x && !/^var\(/.test(x));
  return (fams.length ? fams.join(", ") + ", " : "") + generic;
}
/* reparte el título en líneas (sin partir palabras) y busca el tamaño mayor con el que cabe en el ancho y en 4 líneas */
function wrap(text: string, width: number, maxFs: number, minFs: number, em: number) {
  const words = String(text).trim().split(/\s+/).filter(Boolean);
  for (let fs = maxFs; fs >= minFs; fs -= 1) {
    const max = width / (fs * em), lines: string[] = [];
    let cur = "", ok = true;
    for (const w of words) {
      if (w.length > max) { ok = false; break; }
      if (!cur) cur = w; else if ((cur + " " + w).length <= max) cur += " " + w; else { lines.push(cur); cur = w; }
    }
    if (cur) lines.push(cur);
    if (ok && lines.length <= 4) return { fs, lines };
  }
  return { fs: minFs, lines: [String(text).slice(0, 40)] };
}

function shapeSVG(k: number, W: number, H: number, cy: number, fg: string) {
  const s = Math.min(W * 0.62, H * 0.36), x = W / 2, sw = Math.max(4, W * 0.025);
  switch (k) {
    case 0: return '<circle cx="' + x + '" cy="' + cy + '" r="' + s / 2 + '" fill="none" stroke="' + fg + '" stroke-width="' + sw + '"/>';
    case 1: return '<rect x="' + (x - s * 0.62) + '" y="' + (cy - s * 0.45) + '" width="' + s * 1.24 + '" height="' + s * 0.9 + '" fill="' + fg + '" opacity=".9"/>';
    case 2: return '<path d="M' + (x - s * 0.62) + " " + (cy + s * 0.5) + " L" + x + " " + (cy - s * 0.55) + " L" + (x + s * 0.62) + " " + (cy + s * 0.5) + ' Z" fill="none" stroke="' + fg + '" stroke-width="' + sw + '"/>';
    case 3: { const w = s * 1.2, h = Math.max(6, s * 0.07), x0 = x - w / 2, y0 = cy - s * 0.42, step = s * 0.26;
      return '<g fill="' + fg + '">' + [1, 0.75, 1, 0.5].map((f, i) => '<rect x="' + x0 + '" y="' + (y0 + i * step) + '" width="' + w * f + '" height="' + h + '"/>').join("") + "</g>"; }
    default: return '<path d="M' + (x - s / 2) + " " + (cy + s * 0.25) + " A" + s / 2 + " " + s / 2 + " 0 0 1 " + (x + s / 2) + " " + (cy + s * 0.25) + ' Z" fill="' + fg + '"/>';
  }
}

export interface CoverData { kind: string; title: string; sub?: string; bg: string; fg: string; shape: number; font?: string; ini?: string }
/* ratio: alto / ancho */
export function coverSrc(d: CoverData, ratio: number): string {
  const W = 400, H = Math.round(W * Math.max(0.2, Math.min(5, ratio || 1.5)));
  let body = '<rect width="' + W + '" height="' + H + '" fill="' + d.bg + '"/>';
  if (d.kind === "iniciales") {
    const fs = Math.min(W, H) * 0.5;
    body += '<text x="' + W / 2 + '" y="' + H / 2 + '" dy=".35em" text-anchor="middle" font-family="\'Roboto Condensed\', \'Arial Narrow\', Arial, sans-serif" font-weight="800" font-size="' + fs.toFixed(1) +
      '" letter-spacing="-.02em" fill="' + d.fg + '" fill-opacity=".9">' + xmlEsc(d.ini || "") + "</text>";
  } else if (d.kind === "portada") {
    const m = W * 0.08, short = H < W * 0.9;               // apaisada: todo más junto
    const t = wrap(d.title, W - 2 * m, Math.round(W * (short ? 0.09 : 0.11)), 14, 0.5), lh = t.fs * 1.12;
    const ty = H * (short ? 0.08 : 0.1) + t.fs;
    body += '<text text-anchor="middle" font-family="' + xmlEsc(svgFont(d.font, "serif")) + '" font-size="' + t.fs + '" fill="' + d.fg + '">' +
      t.lines.map((l, i) => '<tspan x="' + W / 2 + '" y="' + (ty + i * lh).toFixed(1) + '">' + xmlEsc(l) + "</tspan>").join("") + "</text>";
    const sub = String(d.sub || "").toUpperCase();
    const sfs = Math.min(W * 0.045, (W - 2 * m) / Math.max(1, sub.length * 0.75));
    if (d.shape >= 0) {
      const top = ty + (t.lines.length - 1) * lh + t.fs * 0.5, bot = H - (sub ? H * 0.12 + sfs : H * 0.08);
      if (bot - top > H * 0.12) body += shapeSVG(d.shape % SHAPES, W, H, (top + bot) / 2, d.fg);
    }
    if (sub) body += '<text x="' + W / 2 + '" y="' + (H - H * (short ? 0.08 : 0.07)).toFixed(1) + '" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="' + sfs.toFixed(1) +
      '" letter-spacing="' + (sfs * 0.15).toFixed(1) + '" fill="' + d.fg + '">' + xmlEsc(sub) + "</text>";
  }
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + " " + H + '">' + body + "</svg>";
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
}
export const SHAPE_COUNT = SHAPES;
