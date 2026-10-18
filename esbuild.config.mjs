// Compila src/ en main.js y junta css/ en styles.css (los dos archivos que carga Obsidian, junto con manifest.json).
// «node esbuild.config.mjs» vigila los cambios; «node esbuild.config.mjs production» compila una vez.
import esbuild from "esbuild";
import { readFileSync, writeFileSync } from "node:fs";

const prod = process.argv[2] === "production";
const CSS = ["css/boceto.css", "css/cool-bases.css", "css/variables.css"];
const buildCss = () => writeFileSync("styles.css", "/* Cool Bases — generado desde css/ con «npm run build». */\n\n" +
  CSS.map(p => `/* ---------- ${p} ---------- */\n` + readFileSync(p, "utf8").trim()).join("\n\n") + "\n");

const ctx = await esbuild.context({
  entryPoints: ["src/main.js"],
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
