// Compila src/ en main.js y junta css/ en styles.css (los dos archivos que carga Obsidian, junto con manifest.json).
// «node esbuild.config.mjs» vigila los cambios; «node esbuild.config.mjs production» compila una vez.
import esbuild from "esbuild";
import { readFileSync, writeFileSync } from "node:fs";

const prod = process.argv[2] === "production";
const CSS = ["css/font.css", "css/cool-kit.css", "css/boceto.css", "css/cool-bases.css", "css/panel.css", "css/variables.css"];
/* Inter Tight (la fuente de la interfaz), incrustada: Obsidian solo descarga main.js, manifest.json y styles.css.
   fonts/InterTight-latin.woff2 es la variable de Google Fonts (licencia OFL, fonts/OFL.txt), con el peso de 400 a 900 y solo
   latín básico + Latin-1 + algo de puntuación. Se hizo así (fontTools):
     fonttools varLib.instancer "InterTight[wght].ttf" wght=400:900 -o lim.ttf
     pyftsubset lim.ttf --unicodes="U+0020-007E,U+00A0-00FF,U+2010-2014,U+2018-201E,U+2022,U+2026,U+2039,U+203A,U+2044,U+20AC,U+2122,U+2212"
       --layout-features="kern,liga,calt,tnum,case,ss01,cv11" --flavor=woff2 --no-hinting --desubroutinize --output-file=InterTight-latin.woff2
   La familia se llama «Cool Inter Tight» para no chocar con una Inter Tight instalada en el sistema. */
const buildFont = () => writeFileSync("css/font.css", "/* generado por esbuild.config.mjs desde fonts/InterTight-latin.woff2: no editar */\n" +
  "@font-face { font-family: \"Cool Inter Tight\"; font-style: normal; font-weight: 400 900; font-display: block;\n" +
  "  src: url(data:font/woff2;base64," + readFileSync("fonts/InterTight-latin.woff2").toString("base64") + ") format(\"woff2\"); }\n");
const buildCss = () => {
  buildFont();
  writeFileSync("styles.css", "/* Cool Bases — generado desde css/ con «npm run build». */\n\n" +
    CSS.map(p => `/* ---------- ${p} ---------- */\n` + readFileSync(p, "utf8").trim()).join("\n\n") + "\n");
};

const ctx = await esbuild.context({
  entryPoints: ["src/main.ts"],
  bundle: true,
  format: "cjs",
  platform: "browser",
  target: "es2022",
  external: ["obsidian", "electron", "@codemirror/*", "@lezer/*"],
  outfile: "main.js",
  legalComments: "none",
  sourcemap: prod ? false : "inline",
  logLevel: "info",
  plugins: [{ name: "css", setup: b => b.onEnd(() => buildCss()) }],
});
if (prod) { await ctx.rebuild(); await ctx.dispose(); }
else await ctx.watch();
