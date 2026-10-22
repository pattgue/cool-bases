// Genera test/out/harness.html: una página autónoma con la API simulada, el plugin compilado (../main.js, ../styles.css)
// y las bases y notas de ../demo-vault. Uso: npm run build (en la raíz) y luego node test/build.mjs
// node test/build.mjs --data datos.json --extra extra.js --main otro/main.js --css otro/styles.css --out nombre.html  (para otras bases)
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { join, dirname, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const read = p => readFileSync(p, "utf8");
const arg = k => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };

function walk(dir) { return readdirSync(dir).flatMap(f => { const p = join(dir, f); return statSync(p).isDirectory() ? walk(p) : [p]; }); }
function vault(dir) {
  const files = walk(dir);
  const bases = files.filter(f => f.endsWith(".base")).sort().map(f => { const text = read(f); return { path: relative(dir, f).split(sep).join("/"), text, yaml: yaml.load(text) }; });
  const notes = files.filter(f => f.endsWith(".md") && !/CAPTURAS|README/.test(f)).sort().map(f => {
    const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(read(f));   // \r: en Windows git puede dejar saltos CRLF
    return { path: relative(dir, f).split(sep).join("/"), fm: m ? yaml.load(m[1], { schema: yaml.JSON_SCHEMA }) || {} : {} };
  });
  return { bases, notes };
}
const datos = arg("--data") ? JSON.parse(read(arg("--data"))) : vault(join(root, "demo-vault"));

const theme = `
body { margin: 0; font-family: var(--font-interface); background: var(--background-primary); color: var(--text-normal); }
.theme-dark { --background-primary: #1e1e1e; --background-secondary: #262626; --background-modifier-hover: rgba(255,255,255,.075); --background-modifier-border: #363636;
  --background-modifier-border-hover: #474747; --text-normal: #dadada; --text-muted: #a3a3a3; --text-faint: #6d6d6d; --text-accent: #a68af9;
  --text-on-accent: #fff; --interactive-accent: #7f6df2; --interactive-accent-hover: #8875ff; --interactive-normal: #363636; --text-error: #fb464c; color-scheme: dark; }
.theme-light { --background-primary: #ffffff; --background-secondary: #f6f6f6; --background-modifier-hover: rgba(0,0,0,.067); --background-modifier-border: #e0e0e0;
  --background-modifier-border-hover: #d4d4d4; --text-normal: #222; --text-muted: #5c5c5c; --text-faint: #ababab; --text-accent: #8a5cf5;
  --text-on-accent: #fff; --interactive-accent: #8a5cf5; --interactive-accent-hover: #7a4ced; --interactive-normal: #fff; --text-error: #e93147; color-scheme: light; }
body { --font-interface: Inter, -apple-system, "Segoe UI", system-ui, sans-serif; --font-text: var(--font-interface); --font-monospace: Menlo, monospace;
  --size-2-2: 4px; --size-4-1: 4px; --size-4-2: 8px; --size-4-3: 12px; --size-4-4: 16px; --font-ui-small: 13px; --color-red: #e93147; }
/* lo que Obsidian pone a todos los botones y campos (para ver que el panel no se contamina) */
button { background: var(--interactive-normal); color: var(--text-normal); border: 0; border-radius: 4px; padding: 4px 12px; height: 30px;
  box-shadow: 0 1px 2px rgba(0,0,0,.3); font-size: 13px; cursor: pointer; }
input[type=text], select { background: var(--background-primary); border: 1px solid var(--background-modifier-border); color: var(--text-normal);
  padding: 4px 8px; height: 30px; border-radius: 4px; }
/* lo que un tema hace con enlaces y superíndices (peso, tamaño, fuente, color, subrayado, icono externo):
   las tarjetas tienen que ignorarlo */
body .cb-view a.internal-link, body .cb-view a.external-link { font-weight: 400; font-size: 14px; font-family: Georgia, serif; font-style: normal;
  letter-spacing: 0; text-transform: none; line-height: 1.6; color: #a68af9; text-decoration: underline;
  background-image: linear-gradient(red, red); background-size: 10px 10px; background-repeat: no-repeat; background-position: right center; padding-right: 14px; }
body .cb-view sup { font-size: 70%; font-weight: 300; vertical-align: super; font-family: Georgia, serif; color: #a68af9; }
#out { padding: 0 16px 60px; }
.par h2 { font-size: 16px; margin: 28px 0 8px; } .par h3 { font-size: 12px; color: var(--text-muted); margin: 0 0 6px; font-weight: 500; }
.cols { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; align-items: start; }
.workspace-leaf-content { position: relative; border: 1px solid var(--background-modifier-border); min-height: 200px; }
.bases-toolbar { padding: 8px 12px; border-bottom: 1px solid var(--background-modifier-border); font-size: 13px; color: var(--text-muted); }
.panel-page .workspace-leaf-content { height: 100vh; overflow: hidden; display: flex; flex-direction: column; }
.panel-page .bases-view-scroll { flex: 1; overflow: auto; }
#notices { position: fixed; right: 16px; top: 16px; display: flex; flex-direction: column; gap: 6px; z-index: 99; }
.notice { background: var(--background-secondary); border: 1px solid var(--background-modifier-border); padding: 8px 12px; border-radius: 6px; font-size: 13px; }
`;
const script = s => "<script>\n" + s.replace(/<\/script/gi, "<\\/script") + "\n</script>\n";
const main = read(arg("--main") || join(root, "main.js")), css = read(arg("--css") || join(root, "styles.css"));
const html = "<!doctype html><meta charset=\"utf-8\"><title>Cool Bases harness</title>\n" +
  "<style>\n" + theme + "</style>\n<style>\n" + css + "</style>\n" +
  "<body><div id=\"out\"></div>\n" +
  script("window.__lang = /(^|[|#])es(\\||$)/.test(decodeURIComponent(location.hash)) ? 'es' : 'en';\nif (location.hash.indexOf('#panel=') === 0) document.documentElement.classList.add('panel-page');") +
  script(read(join(here, "node_modules", "js-yaml", "dist", "js-yaml.min.js"))) +
  script(read(join(here, "obsidian-mock.js"))) +
  script("window.DATOS = " + JSON.stringify(datos) + ";") +
  (arg("--extra") ? script(read(arg("--extra"))) : "") +
  script("(function(){ var module = { exports: {} }, exports = module.exports;\n" + main + "\nwindow.__pluginModule = module.exports; })();") +
  script(read(join(here, "harness.js")));
mkdirSync(join(here, "out"), { recursive: true });
const name = arg("--out") || "harness.html";
writeFileSync(join(here, "out", name), html);
console.log("test/out/" + name + " ·", datos.bases.length, "bases ·", datos.bases.reduce((n, b) => n + b.yaml.views.length, 0), "views ·", datos.notes.length, "notes");
