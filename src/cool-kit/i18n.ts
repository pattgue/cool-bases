/* Textos del Cool Kit en inglés y español (el kit va copiado en cada plugin, así que lleva los suyos). */
import { getLanguage, moment } from "obsidian";

const en: Record<string, string> = {
  "bar": "Cool Bar", "collapse": "Collapse Cool Bar", "expand": "Expand Cool Bar",
  "cmd.toggle": "Show or hide the Cool Bar",
  "s.desktop": "Desktop", "s.phone": "Phone", "s.device": "Settings for",
  "s.location": "Location", "s.top": "Top of the tab", "s.bottom": "Bottom of the tab", "s.float": "Floating",
  "s.align": "Alignment", "s.left": "Left", "s.center": "Center", "s.right": "Right",
  "s.mode": "Mode", "s.fixed": "Always visible", "s.context": "Only where a Cool plugin applies", "s.hidden": "Hidden (show it with the command)",
  "s.modeDesc": "Hidden: use the «Show or hide the Cool Bar» command, from the command palette or with a hotkey.",
  "s.collapsed": "Collapsed", "s.collapsedDesc": "Only the ⌃ button is shown.",
  "s.buttons": "Buttons", "s.always": "Always", "s.applies": "Only when it applies", "s.never": "Never",
  "s.up": "Move up", "s.down": "Move down",
};
const es: Record<string, string> = {
  "bar": "Cool Bar", "collapse": "Plegar la Cool Bar", "expand": "Desplegar la Cool Bar",
  "cmd.toggle": "Mostrar u ocultar la Cool Bar",
  "s.desktop": "Ordenador", "s.phone": "Móvil", "s.device": "Ajustes para",
  "s.location": "Ubicación", "s.top": "Arriba de la pestaña", "s.bottom": "Abajo de la pestaña", "s.float": "Flotante",
  "s.align": "Alineación", "s.left": "Izquierda", "s.center": "Centro", "s.right": "Derecha",
  "s.mode": "Modo", "s.fixed": "Fija (siempre visible)", "s.context": "Contextual (solo donde aplica algún plugin Cool)", "s.hidden": "Escondida (se enseña con el comando)",
  "s.modeDesc": "Escondida: usa el comando «Mostrar u ocultar la Cool Bar», desde la paleta de comandos o con un atajo.",
  "s.collapsed": "Plegada", "s.collapsedDesc": "Solo se ve el botón ⌃.",
  "s.buttons": "Botones", "s.always": "Siempre", "s.applies": "Solo cuando aplica", "s.never": "Nunca",
  "s.up": "Subir", "s.down": "Bajar",
};

let lang: "en" | "es" | null = null;
function locale(): "en" | "es" {
  if (lang) return lang;
  let l = "";
  try { l = getLanguage(); } catch { /* Obsidian anterior a 1.8.7 */ }
  if (!l) try { l = moment.locale(); } catch { /* sin moment */ }
  return lang = /^es/i.test(String(l || "")) ? "es" : "en";
}
export function kt(key: string): string { return (locale() === "es" ? es : en)[key] ?? en[key] ?? key; }
