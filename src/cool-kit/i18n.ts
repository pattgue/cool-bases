/* Textos del Cool Kit en inglés y español (el kit va copiado en cada plugin, así que lleva los suyos). */
import { getLanguage, moment } from "obsidian";

const en: Record<string, string> = {
  "bar": "Cool Bar", "collapse": "Collapse Cool Bar", "expand": "Expand Cool Bar",
};
const es: Record<string, string> = {
  "bar": "Cool Bar", "collapse": "Plegar la Cool Bar", "expand": "Desplegar la Cool Bar",
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
