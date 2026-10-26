// Pruebas de Cool Bases sin Obsidian, en Chromium (Playwright): pinta las vistas del demo-vault, abre el panel
// en inglés y en español y lo usa como una persona (cambios en vivo, deshacer, estilos, datos, estados, Listo, Cancelar…).
// Uso (en la raíz): npm run build && cd test && npm install && npm test   ·   PW=/ruta/a/playwright si no está instalado aquí.
// Capturas e informe en test/out/.
import { createRequire } from "node:module";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW || "playwright");
const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "out");
mkdirSync(out, { recursive: true });
const url = pathToFileURL(join(out, "harness.html")).href;

/* sin red: cada imagen es un marcador con la proporción de una portada (o apaisado si el nombre lo dice) */
function placeholder(u) {
  let hs = 0; for (const c of u) hs = (hs * 31 + c.charCodeAt(0)) >>> 0;
  const wide = /Metropolis|Lobby/.test(decodeURIComponent(u)), [w, hh] = wide ? [600, 444] : [400, 600];
  const name = decodeURIComponent(u.split("/").pop().split("?")[0]).replace(/_/g, " ").replace(/\.\w+$/, "").slice(0, 22).replace(/[<&]/g, "");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${hh}"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="hsl(${hs % 360} 35% 62%)"/><stop offset="1" stop-color="hsl(${hs % 360} 40% 20%)"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/><text x="50%" y="88%" font-family="Arial" font-size="${w / 16}" fill="rgba(255,255,255,.8)" text-anchor="middle">${name}</text></svg>`;
}
const b = await chromium.launch(process.env.PW_EXE ? { executablePath: process.env.PW_EXE } : {});   // PW_EXE=ruta a un Chrome instalado, si el de Playwright no arranca
const results = [];
const ok = (name, cond, extra) => { results.push((cond ? "✓ " : "✗ ") + name + (extra ? " — " + extra : "")); };
async function page(hash, viewport) {
  const p = await b.newPage({ viewport: viewport || { width: 1400, height: 900 }, deviceScaleFactor: 1 });
  const errs = [];
  p.on("pageerror", e => errs.push(e.message));
  p.on("console", m => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errs.push(m.text()); });
  await p.route(/^https?:\/\//, r => r.request().resourceType() === "image" ? r.fulfill({ status: 200, contentType: "image/svg+xml", body: placeholder(r.request().url()) }) : r.fulfill({ status: 404, body: "" }));
  await p.goto(url + "#" + encodeURIComponent(hash));
  await p.waitForTimeout(700);
  const inner = await p.evaluate(() => window.__errors || []);
  return { p, errs: errs.concat(inner) };
}
const errors = [];

/* ---------- 1. las vistas del demo-vault ---------- */
for (const [hash, name] of [["views", "views-dark"], ["views|light", "views-light"], ["views|es", "views-es"]]) {
  const { p, errs } = await page(hash, { width: 1300, height: 900 });
  errors.push(...errs);
  await p.screenshot({ path: join(out, name + ".png"), fullPage: true });
  if (name === "views-dark") {
    const v = await p.evaluate(() => window.__views.map(x => ({ id: x.id, cards: x.view.containerEl.querySelectorAll(".cb-card").length })));
    ok("the 4 demo views render", v.length === 4 && v.every(x => x.cards >= 10), v.map(x => x.id + ": " + x.cards).join(", "));
    /* lo que elige el usuario va en variables: ningún style="" con propiedades normales */
    const bad = await p.evaluate(() => [...document.querySelectorAll(".cb-view [style], .cb-panel [style]")].flatMap(e => [...e.style].filter(k => !k.startsWith("--"))));
    ok("cards only carry CSS variables inline (no fixed styles)", bad.length === 0, bad.slice(0, 3).join(" | "));
    ok("generated cover for the book without one", await p.evaluate(() => !!document.querySelector('.cb-card[data-path="Books/Don Quixote.md"] img.cb-ph')));
    ok("star ratings counted from emoji", await p.evaluate(() => document.querySelector('.cb-card[data-path="Books/Pride and Prejudice.md"] .cb-stars').textContent === "★★★★★"));
    ok("score rating as a fraction", await p.evaluate(() => !!document.querySelector('.cb-card[data-path="Films/Metropolis.md"] .cb-score .cb-frac')));
    ok("footer link with the site name", await p.evaluate(() => [...document.querySelectorAll(".cb-foot a.external-link")].some(a => /Wikipedia/.test(a.textContent))));
    /* casilla: se marca desde la tarjeta sin abrir la nota */
    await p.click('.cb-card[data-path="Books/Moby-Dick.md"] .cb-st.f-check');
    const log = await p.evaluate(() => window.__log || []);
    ok("checkbox toggles the property from the card", log.some(l => l.startsWith("frontmatter Books/Moby-Dick.md") && l.includes('"read":true')) && !log.some(l => l.startsWith("open")), log.slice(-2).join(" | "));
    await p.click('.cb-card[data-path="Books/Dracula.md"] .cb-body', { position: { x: 4, y: 4 } });
    ok("clicking a card opens the note", (await p.evaluate(() => window.__log)).some(l => l.startsWith("open Books/Dracula.md")));
  }
  await p.close();
}

/* ---------- 1b. la Cool Bar ---------- */
{
  const { p, errs } = await page("views|demo", { width: 1300, height: 900 });
  errors.push(...errs);
  const bars = () => p.evaluate(() => window.__leaves.map(l => { const b = l.view.containerEl.querySelector(":scope > .cool-bar");
    return b ? { ck: b.getAttribute("data-ck"), tools: [...b.querySelectorAll(".cool-tool")].map(x => x.getAttribute("data-tool") + ":" + x.getAttribute("data-state")) } : null; }));
  const b0 = await bars();
  ok("Cool Bar: one bar per tab (bases and note)", b0.length === 5 && b0.every(Boolean), JSON.stringify(b0.map(x => x && x.tools.length)));
  ok("Cool Bar: COOL BASES available on a Cool Bases view, locked on a note", b0[0].tools.includes("cool-bases:available") && b0[4].tools.includes("cool-bases:locked"), b0[4] && b0[4].tools.join(" "));
  ok("Cool Bar: demo buttons locked, in order", JSON.stringify(b0[0].tools) === JSON.stringify(["cool-markdown:locked", "cool-trip:locked", "cool-properties:locked", "cool-bases:available"]), b0[0].tools.join(" "));
  ok("Cool Bar: a locked button can't be pressed", await p.evaluate(() => { const b = window.__leaves[4].view.containerEl.querySelector('.cool-tool[data-tool="cool-bases"]'); return b.disabled && b.getAttribute("aria-disabled") === "true"; }));
  await p.locator(".cool-bar").first().screenshot({ path: join(out, "cool-bar.png") });
  /* pulsar COOL BASES: abre el panel y el botón pasa a Activo */
  await p.click('.workspace-leaf-content >> nth=0 >> .cool-tool[data-tool="cool-bases"]');
  await p.waitForTimeout(80);
  const b1 = await bars();
  ok("Cool Bar: pressing COOL BASES opens the panel (Active)", b1[0].tools.includes("cool-bases:active") && await p.evaluate(() => !!document.querySelector(".cb-panel")), b1[0].tools.join(" "));
  ok("Cool Bar: only one Active (the other views stay available)", b1[1].tools.includes("cool-bases:available"));
  await p.click("#cbp-cancel");
  await p.waitForTimeout(80);
  ok("Cool Bar: Cancel closes and focus goes back to the button", (await bars())[0].tools.includes("cool-bases:available") && await p.evaluate(() => document.activeElement && document.activeElement.getAttribute("data-tool") === "cool-bases"));
  /* plegar: queda solo el botón ⌃, en todas las pestañas, y se guarda en los datos del plugin */
  await p.click(".cool-bar >> nth=0 >> .cool-fold");
  await p.waitForTimeout(80);
  ok("Cool Bar: collapse hides the buttons and saves it", await p.evaluate(() => [...document.querySelectorAll(".cool-bar")].every(b => b.classList.contains("is-collapsed") && b.querySelector(".cool-tools").hidden)
    && window.__pluginData.coolBar.desktop.collapsed === true && window.__pluginData.styles !== undefined));
  await p.click(".cool-bar >> nth=0 >> .cool-fold");
  await p.waitForTimeout(80);
  /* comando «Editar tarjeta»: solo en una pestaña de Cool Bases */
  ok("command «Edit card» only where it applies", await p.evaluate(() => { const c = window.__commands["cool-bases:edit-card"]; const r0 = c.checkCallback(true);
    window.__leaves.unshift(window.__leaves.splice(4, 1)[0]); const r1 = c.checkCallback(true); window.__leaves.push(window.__leaves.shift()); return r0 === true && r1 === false; }));
  /* otro plugin Cool con un kit más nuevo: toma el relevo, pinta él, y al irse vuelve el primero */
  await p.evaluate(async () => {
    const module = { exports: {} };
    new Function("module", "exports", "require", window.__mainSrc.replace("var KIT_VERSION = 1;", "var KIT_VERSION = 2;"))(module, module.exports, window.require);
    const Twin = module.exports.default || module.exports;
    window.__twin = new Twin(window.__app, { id: "cool-twin" });
    await window.__twin.onload();
    await new Promise(r => setTimeout(r, 60));
  });
  const t1 = await p.evaluate(() => ({ leader: window.__coolKit.leader, cks: [...new Set([...document.querySelectorAll(".cool-bar")].map(b => b.getAttribute("data-ck")))],
    n: document.querySelectorAll(".cool-bar").length, tools: document.querySelector(".cool-bar").querySelectorAll(".cool-tool").length }));
  ok("Cool Kit: the newest kit becomes the leader and repaints", t1.leader === "cool-twin" && t1.cks.join() === "2" && t1.n === 5 && t1.tools === 5, JSON.stringify(t1));
  await p.click(".cool-bar >> nth=0 >> .cool-fold");
  await p.waitForTimeout(80);
  ok("Cool Kit: settings are written to every Cool plugin", await p.evaluate(() => window.__pluginData.coolBar.desktop.collapsed === true && window["__pluginData_cool-twin"].coolBar.desktop.collapsed === true));
  await p.click(".cool-bar >> nth=0 >> .cool-fold");
  await p.waitForTimeout(80);
  await p.evaluate(async () => { window.__twin.unload(); await new Promise(r => setTimeout(r, 60)); });
  const t2 = await p.evaluate(() => ({ leader: window.__coolKit.leader, cks: [...new Set([...document.querySelectorAll(".cool-bar")].map(b => b.getAttribute("data-ck")))], n: document.querySelectorAll(".cool-bar").length }));
  ok("Cool Kit: when the leader leaves, the other one takes over", t2.leader === "cool-bases" && t2.cks.join() === "1" && t2.n === 5, JSON.stringify(t2));
  /* al descargar Cool Bases no queda nada */
  await p.evaluate(async () => { window.__plugin.unload(); await new Promise(r => setTimeout(r, 60)); });
  ok("Cool Kit: unloading the last plugin removes every bar", await p.evaluate(() => !document.querySelector(".cool-bar") && !document.querySelector(".cool-has-bar") && window.__coolKit.leader === null));
  await p.close();
}

/* ---------- 1c. ajustes de la Cool Bar ---------- */
for (const lang of ["en", "es"]) {
  const { p, errs } = await page("views|demo" + (lang === "es" ? "|es" : ""), { width: 1300, height: 900 });
  errors.push(...errs);
  await p.evaluate(() => { const tab = window.__settingTabs["cool-bases"]; tab.display(); tab.containerEl.id = "settings"; document.body.prepend(tab.containerEl); });
  const names = await p.$$eval("#settings .setting-item-name", els => els.map(e => e.textContent));
  if (lang === "es") {
    ok("settings in Spanish", ["Ubicación", "Alineación", "Modo", "Plegada", "Botones"].every(x => names.includes(x)), names.join(", "));
    await p.close(); continue;
  }
  await p.locator("#settings").screenshot({ path: join(out, "settings.png") });
  ok("settings: Cool Bar section with every option", ["Location", "Alignment", "Mode", "Collapsed", "Buttons", "Cool Bases", "cool markdown"].every(x => names.includes(x)), names.join(", "));
  /* cambia un desplegable por el nombre de su ajuste (n: el n-ésimo con ese nombre) */
  const setSel = (name, v) => p.evaluate(([name, v]) => { const it = [...document.querySelectorAll("#settings .setting-item")].find(x => x.querySelector(".setting-item-name").textContent === name);
    const sel = it.querySelector("select"); sel.value = v; sel.dispatchEvent(new Event("change")); }, [name, v]);
  const wait = () => p.waitForTimeout(80);
  const where = () => p.evaluate(() => window.__leaves.map(l => { const h = l.view.containerEl, b = h.querySelector(":scope > .cool-bar"); return b ? (b === h.firstElementChild ? "first" : b === h.lastElementChild ? "last" : "mid") + ":" + b.getAttribute("data-loc") + ":" + b.getAttribute("data-align") : "none"; }));
  await setSel("Location", "bottom"); await wait();
  const w1 = await where();
  ok("settings: Location bottom puts the bar at the end of each tab (note: after its content)", w1.every(x => x.startsWith("last:bottom")), w1.join(" "));
  await setSel("Alignment", "left"); await wait();
  ok("settings: Alignment left", (await where()).every(x => x.endsWith(":left")));
  await setSel("Location", "float"); await wait();
  ok("settings: Floating", await p.evaluate(() => getComputedStyle(document.querySelector(".cool-bar")).position === "absolute"));
  await setSel("Location", "top"); await setSel("Alignment", "right"); await wait();
  await setSel("Mode", "context"); await wait();
  const w2 = await where();
  ok("settings: Contextual hides the bar where nothing applies (the note)", w2[4] === "none" && w2.slice(0, 4).every(x => x !== "none"), w2.join(" "));
  await setSel("Mode", "hidden"); await wait();
  ok("settings: Hidden mode shows no bar", (await where()).every(x => x === "none"));
  await p.evaluate(() => window.__commands["cool-bases:toggle-cool-bar"].callback()); await wait();
  ok("command «Show or hide the Cool Bar» shows the hidden bar", (await where()).every(x => x !== "none"));
  await p.evaluate(() => window.__commands["cool-bases:toggle-cool-bar"].callback()); await wait();
  ok("…and hides it again", (await where()).every(x => x === "none"));
  await setSel("Mode", "fixed"); await wait();
  /* botones: visibilidad y orden */
  await setSel("cool trip", "never"); await wait();
  const order = () => p.evaluate(() => [...document.querySelector(".cool-bar").querySelectorAll(".cool-tool")].map(b => b.getAttribute("data-tool")).join(" "));
  ok("settings: a button set to Never disappears", !(await order()).includes("cool-trip"), await order());
  await setSel("cool markdown", "applies"); await wait();
  ok("settings: «Only when it applies» hides a locked button", !(await order()).includes("cool-markdown"), await order());
  await p.evaluate(() => { const it = [...document.querySelectorAll("#settings .setting-item")].find(x => x.querySelector(".setting-item-name").textContent === "Cool Bases"); it.querySelector('[data-icon="arrow-up"]').click(); });
  await wait();
  ok("settings: move Cool Bases up", (await order()) === "cool-bases cool-properties", await order());
  /* móvil: sus propios ajustes */
  await p.click('#settings [data-device="phone"]');
  await setSel("Location", "bottom"); await wait();
  ok("settings: the Phone tab edits the phone settings, not the desktop ones", await p.evaluate(() => { const c = window.__pluginData.coolBar; return c.phone.location === "bottom" && c.desktop.location === "top"; }) && (await where()).every(x => x.includes(":top:")));
  await p.click('#settings [data-device="desktop"]');
  await p.evaluate(() => { const it = [...document.querySelectorAll("#settings .setting-item")].find(x => x.querySelector(".setting-item-name").textContent === "Collapsed"); const c = it.querySelector("input"); c.checked = true; c.dispatchEvent(new Event("change")); });
  await wait();
  ok("settings: Collapsed", await p.evaluate(() => document.querySelector(".cool-bar").classList.contains("is-collapsed")));
  await p.close();
}

/* ---------- 2. el panel, en inglés y en español ---------- */
const EN = /\b(Card|Data|Decorations|Size|Colors|Font|Image|Footer|Rating|States|Lines|Hover|Custom CSS|Presets|Save style|Done|Undo|Cancel)\b/;
const ES = /\b(Tarjeta|Datos|Decoraciones|Tamaño|Colores|Fuente|Imagen|Pie|Valoración|Estados|Líneas|CSS libre|Predeterminados|Guardar estilo|Listo|Deshacer|Cancelar)\b/;
for (const [hash, name] of [["panel=Books|Shelf", "panel-en-dark"], ["panel=Books|Shelf|light", "panel-en-light"], ["panel=Books|Shelf|es", "panel-es-dark"], ["panel=Films|Cards|es|light", "panel-es-light"]]) {
  const { p, errs } = await page(hash);
  errors.push(...errs);
  await p.screenshot({ path: join(out, name + ".png") });
  const es = name.includes("-es-");
  if (name === "panel-en-dark") {
    const bad = await p.evaluate(() => [...document.querySelectorAll(".cb-panel [style], .cb-fp [style]")].flatMap(e => [...e.style].filter(k => !k.startsWith("--"))));
    ok("the panel only carries CSS variables inline", bad.length === 0, bad.slice(0, 5).join(", "));
  }
  const all = await p.evaluate(async () => {
    for (const x of [...document.querySelectorAll('.cb-panel .blk-h[aria-expanded="false"]')]) x.click();
    for (let i = 0; i < 30; i++) { const x = document.querySelector('.cb-panel .sc-main[aria-expanded="false"]'); if (!x) break; x.click(); }
    await new Promise(r => setTimeout(r, 200));
    return document.querySelector(".cb-panel").innerText;
  });
  ok(name + ": every label translated", (es ? ES : EN).test(all) && !(es ? EN : ES).test(all.replace(/Cool Bases|Hover/g, "")) && !/\b[a-z]{1,6}\.[a-zA-Z0-9]+\b/.test(all.replace(/e\.g\.|p\. ej\.|\.cb-[a-z-]+|https?:\S+/g, "")),
    (all.match(/\b[a-z]{1,6}\.[a-zA-Z0-9]+\b/g) || []).slice(0, 5).join(", "));
  await p.close();
}

/* ---------- 3. usar el panel ---------- */
const BAR_BTN = '.cool-tool[data-tool="cool-bases"]';
{
  const { p, errs } = await page("panel=Books|Shelf");
  const model = () => p.evaluate(() => JSON.parse(JSON.stringify(window.__view.panel.model)));
  const cols = () => p.evaluate(() => getComputedStyle(document.querySelector(".cb-grid")).gridTemplateColumns);
  const setRange = (path, v) => p.evaluate(([path, v]) => { const i = document.querySelector('.cb-panel input[data-p="' + path + '"]');
    i.value = v; i.dispatchEvent(new Event("input", { bubbles: true })); i.dispatchEvent(new Event("change", { bubbles: true })); }, [path, v]);
  const w0 = (await model()).card.w, c0 = await cols();
  await setRange("card.w", 200);
  ok("live change (width 200)", (await model()).card.w === 200 && (await cols()) !== c0, await cols());
  await p.click("#cbp-undo");
  ok("Undo", (await model()).card.w === w0);
  await setRange("card.w", 260);
  await p.focus('.cb-panel input[data-p="card.w"]');
  await p.keyboard.press("Control+z");
  ok("Ctrl+Z", (await model()).card.w === w0);
  ok("nothing written before Done", await p.evaluate(() => !(window.__log || []).some(l => l.startsWith("config.set"))));

  await p.click("#cbp-presets");
  await p.click('.cb-fp [data-preset="ficha"]');
  ok("preset «Profile»", (await model()).col.bg === "#f3f2ee");
  await p.keyboard.press("Control+z");
  ok("Ctrl+Z undoes the preset", (await model()).col.bg !== "#f3f2ee");

  await p.click("#cbp-save");
  await p.fill(".cb-fp #saveName", "My test");
  await p.press(".cb-fp #saveName", "Enter");
  await p.waitForTimeout(100);
  ok("Save style -> plugin data", await p.evaluate(() => JSON.stringify(window.__pluginData || {}).includes("My test")));
  await p.click("#cbp-presets");
  ok("My styles in the menu", await p.isVisible('.cb-fp [data-mine="0"]'));
  await p.keyboard.press("Escape");

  await p.click("#cbp-copy");
  await p.waitForSelector(".cb-fp [data-copy]");
  const n = await p.$$eval(".cb-fp [data-copy]", bs => bs.map(x => x.textContent));
  ok("Copy from another view lists the other views", n.length === 3 && !n.includes("Books · Shelf"), n.join(", "));
  await p.click('.cb-fp [data-copy="' + n.findIndex(x => /Posters/.test(x)) + '"]');
  ok("copy the Posters style", (await model()).img.fit === "fondo");
  await p.keyboard.press("Control+z");

  await p.evaluate(() => { window.queryLocalFonts = async () => [{ family: "Futura PT" }, { family: "Avenir Next" }]; });
  await p.click('.cb-panel [data-toggle="fuente"]');
  await p.click('.cb-panel .fontb[data-p="font.family"]');
  await p.waitForTimeout(100);
  const fl = await p.$$eval(".cb-fp [data-font]", bs => bs.map(x => x.textContent));
  ok("installed fonts (queryLocalFonts), Obsidian's two translated", fl.includes("Futura PT") && fl[0] === "Interface", fl.slice(0, 4).join(", "));
  await p.fill(".cb-fp #fpSearch", "My Rare Font");
  await p.press(".cb-fp #fpSearch", "Enter");
  ok("type any font name", (await model()).font.family === "My Rare Font");
  /* SIZE se enseña en px (el % del ancho de la tarjeta) y se guarda en % */
  const sz = '.cb-panel input[data-p="font.size"]';
  const m0 = await model(), px0 = Math.round(m0.font.size * m0.card.w / 100);
  ok("SIZE shown in px", (await p.inputValue(sz)) === px0 + "px", await p.inputValue(sz));
  await p.focus(sz); await p.keyboard.press("ArrowUp");
  const m1 = await model();
  ok("…ArrowUp adds 1 px, saved as % of the width", Math.abs(m1.font.size * m1.card.w / 100 - (px0 + 1)) < 0.01, m1.font.size + " %");
  await p.click('.cb-panel button[data-p="font.align"][data-v="justify"]');
  ok("ALIGN justify", (await model()).font.align === "justify");
  /* IMAGE: las flechas de cada muestra pasan por el ajuste y por lo que se pinta sin imagen */
  await p.click('.cb-panel [data-toggle="imagen"]');
  const f0 = (await model()).img.fit;
  await p.click('.cb-panel [data-fitstep="1"]');
  ok("IMAGE: the arrows change the fit", (await model()).img.fit !== f0 && await p.evaluate(() => document.activeElement.dataset.fitstep === "1"));
  /* sin imagen: la portada y, al lado, sus opciones (chips y filas como los efectos) */
  await p.click('.cb-panel #cbp-img-empty-portada');
  ok("IMAGE: cover viewer with its options", await p.isVisible(".cb-panel .cv-row .cv-view") && await p.isVisible('.cb-panel .cv-rows select[data-p="img.cvText"]'));
  await p.click('.cb-panel #cbp-img-cvShape-2');
  await p.click('.cb-panel #cbp-img-cvColors-own');
  await p.waitForTimeout(100);
  const cv = await p.evaluate(() => JSON.parse(document.querySelector('.cb-card[data-path="Books/Don Quixote.md"] img.cb-ph').dataset.cv));
  const mc = await model();
  ok("IMAGE: a fixed shape and own colors reach the cards", cv.shape === 2 && cv.bg === mc.img.cvBg && cv.fg === mc.img.cvFg, JSON.stringify([cv.shape, cv.bg, cv.fg]));
  ok("IMAGE: own colors show their two colors in the segment", await p.isVisible('.cb-panel .seg-own #cbp-img-cvBg-sw'));
  await p.click('.cb-panel #cbp-img-empty-nada');
  ok("IMAGE: without the cover, its viewer and options go away", !(await p.isVisible(".cb-panel .cv-view")) && !(await p.isVisible('.cb-panel select[data-p="img.cvText"]')));
  /* GRAIN es un deslizador: a 0, sin grano */
  await setRange("img.grainAmt", 60);
  const g1 = (await model()).img;
  await setRange("img.grainAmt", 0);
  ok("IMAGE: the grain slider sets the amount (0 = no grain)", g1.grain && g1.grainAmt === 60 && !(await model()).img.grain);
  ok("IMAGE: intensity is off with COLOR", (await model()).img.fx !== "color" || await p.isDisabled('.cb-panel input[data-p^="img.amt."]'));

  await p.click("#addBtn");
  await p.selectOption(".cb-panel #popProp", "note.rating");
  await p.click('.cb-panel [data-ptype="texto"]');
  await p.click('.cb-panel [data-pop="ok"]');
  ok("add data", (await model()).items.some(x => x.prop === "note.rating" && x.kind === "dato"));
  ok("…and it shows on the card", await p.evaluate(() => !!document.querySelector('.cb-card .cb-i[data-prop="note.rating"]')));

  /* Colocación de un dato: en uno de los 9 puntos, fuera del texto (y Ctrl+Z lo devuelve) */
  const rid = (await model()).items.find(x => x.prop === "note.rating" && x.kind === "dato").id;
  await p.click('.cb-panel [data-p="items.#' + rid + '.place"][data-v="tr"]'); await p.waitForTimeout(60);
  ok("data placed in a corner", await p.evaluate(() => !!document.querySelector('.cb-card .cb-float.v-t.h-r .cb-i[data-prop="note.rating"]') &&
    !document.querySelector('.cb-card .cb-body .cb-i[data-prop="note.rating"]')));
  await p.keyboard.press("Control+z"); await p.waitForTimeout(60);
  ok("…and back between the data", await p.evaluate(() => !!document.querySelector('.cb-card .cb-body .cb-i[data-prop="note.rating"]')));

  /* el título: con candado no se mueve ni se coloca; tocando el candado, sí */
  const tid = (await model()).items.find(x => x.kind === "title").id;
  await p.click('.cb-panel [data-toggle="it:' + tid + '"]'); await p.waitForTimeout(60);
  const titleState = () => p.evaluate(tid => ({ grip: !!document.querySelector('.cb-panel [data-grip][data-id="' + tid + '"]'),
    fixed: document.querySelector('.cb-panel .sc[data-id="' + tid + '"]').hasAttribute("data-fixed"),
    placeOff: document.querySelector('.cb-panel [data-p="items.#' + tid + '.place"][data-v="tl"]').disabled }), tid);
  const locked = await titleState();
  ok("the title is locked by default", locked.fixed && !locked.grip && locked.placeOff, JSON.stringify(locked));
  await p.click("#cbp-title-lock"); await p.waitForTimeout(60);
  const unlocked = await titleState();
  ok("tapping the lock frees the title (grip and placement)", (await model()).items.find(x => x.kind === "title").free === true && !unlocked.fixed && unlocked.grip && !unlocked.placeOff, JSON.stringify(unlocked));
  await p.click('.cb-panel [data-p="items.#' + tid + '.place"][data-v="bl"]'); await p.waitForTimeout(60);
  ok("the title can be placed too", await p.evaluate(() => !!document.querySelector('.cb-card .cb-float.v-b.h-l .cb-i[data-prop="file.name"]')));
  await p.click("#cbp-title-lock"); await p.waitForTimeout(60);
  ok("…and locked again", (await titleState()).fixed);
  await p.keyboard.press("Control+z"); await p.keyboard.press("Control+z"); await p.keyboard.press("Control+z"); await p.waitForTimeout(60);
  ok("Ctrl+Z puts the title back", await p.evaluate(tid => { const t = window.__view.panel.model.items.find(x => x.id === tid); return !t.free && t.place === "entre"; }, tid));

  /* un dato unido a otro vacío en la nota no se pega a la línea de antes (#3); si el vacío estaba unido, la cadena sigue */
  const lineOfC = (bJoined) => p.evaluate(bJoined => {
    const v = window.__view, m = JSON.parse(JSON.stringify(v.panel.model));
    const i = m.items.findIndex(x => x.prop === "note.author"), A = m.items[i];
    const B = Object.assign({}, A, { id: "tB", prop: "note.nothing", join: bJoined, sup: false, before: "" });
    const C = Object.assign({}, A, { id: "tC", prop: "note.year", join: true, sup: false, before: "§C " });
    m.items.splice(i + 1, 0, B, C);
    v.renderCool(m);
    const line = [...document.querySelectorAll(".cb-card .cb-l")].find(l => l.textContent.includes("§C "));
    const r = line ? [...line.querySelectorAll(".cb-i")].map(x => x.getAttribute("data-prop")) : null;
    v.renderCool(v.panel.model);
    return r;
  }, bJoined);
  const alone = await lineOfC(false), chained = await lineOfC(true);
  ok("joined to an empty item: starts its own line", JSON.stringify(alone) === '["note.year"]', JSON.stringify(alone));
  ok("joined to an empty joined item: the chain goes on", JSON.stringify(chained) === '["note.author","note.year"]', JSON.stringify(chained));

  /* Estados */
  await p.click('.cb-panel [data-toggle="estados"]').catch(() => {});
  await p.waitForTimeout(60);
  const sid = (await model()).states.list[0].id, sp = "states.list.#" + sid;
  await p.click('.cb-panel [data-toggle="st:' + sid + '"]'); await p.waitForTimeout(60);
  await p.click('.cb-panel [data-p="' + sp + '.fmt"][data-v="pill"]'); await p.waitForTimeout(60);
  ok("state format Pill", await p.evaluate(() => !!document.querySelector(".cb-card .cb-st.f-pill")));
  await p.click('.cb-panel [data-p="' + sp + '.place"][data-v="entre"]'); await p.waitForTimeout(60);
  ok("state «Between data» shows in the data list and in the text", await p.evaluate(() => !!document.querySelector(".cb-panel #dlist .sc.mini") && !!document.querySelector(".cb-card .cb-body .cb-stl .cb-st")));

  await p.click("#cbp-done");
  await p.waitForTimeout(100);
  const st = await p.evaluate(() => ({ cb: window.__store.coolbases, log: window.__log, panel: !!document.querySelector(".cb-panel") }));
  ok("Done saves `coolbases` with config.set", !!st.cb && st.log.includes("config.set coolbases") && st.cb.font.family === "My Rare Font");
  ok("the panel closes", !st.panel);
  const c1 = await cols();

  await p.click(BAR_BTN);
  await p.click("#cbp-cancel");
  ok("Cancel without changes closes", await p.evaluate(() => !document.querySelector(".cb-panel")));
  await p.click(BAR_BTN);
  await setRange("card.w", 150);
  await p.click("#cbp-cancel");
  ok("Cancel with changes asks", await p.isVisible('.cb-fp [data-cf="discard"]'));
  await p.click('.cb-fp [data-cf="discard"]');
  ok("Discard goes back without writing", (await cols()) === c1 && await p.evaluate(() => !document.querySelector(".cb-panel") && window.__log.filter(l => l.startsWith("config.set")).length === 1));
  await p.click(BAR_BTN);
  await setRange("card.w", 150);
  await p.focus('.cb-panel input[data-p="card.w"]');
  await p.keyboard.press("Escape");
  ok("Escape with changes asks", await p.isVisible('.cb-fp [data-cf="discard"]'));
  await p.keyboard.press("Enter");
  ok("…and Enter discards", await p.evaluate(() => !document.querySelector(".cb-panel")) && (await cols()) === c1);
  await p.click(BAR_BTN);
  await setRange("card.w", 180);
  await p.evaluate(() => window.__app.workspace.trigger("cool-bases:close-panels", null));
  await p.waitForTimeout(80);
  ok("closing without Done discards (another panel opens)", await p.evaluate(() => !document.querySelector(".cb-panel") && window.__store.coolbases.card.w !== 180));
  /* la vista se descarga: quita sus escuchas y su hoja de CSS libre; su botón pasa a Bloqueado */
  await p.evaluate(() => { window.__store.coolbases.css = ".cb-card { outline: 1px solid red; }"; window.__view.onDataUpdated(); });
  const sheets = await p.evaluate(() => document.adoptedStyleSheets.length);
  await p.evaluate(() => window.__view.unload());
  ok("custom CSS in its own sheet, removed on unload", sheets === 1 && await p.evaluate(async () => { await new Promise(r => setTimeout(r, 60)); return document.adoptedStyleSheets.length === 0 && document.querySelector(".cool-tool").getAttribute("data-state") === "locked"; }));
  errors.push(...errs);
  await p.close();
}

/* ---------- 4. el código: nada de HTML en cadenas ni console.log ---------- */
const bundle = readFileSync(join(here, "..", "main.js"), "utf8");
ok("main.js has no innerHTML / outerHTML / insertAdjacentHTML / console.log", !/innerHTML|outerHTML|insertAdjacentHTML|console\.log|document\.write/.test(bundle));

ok("no JavaScript errors", errors.length === 0, errors.join(" | "));
const report = results.join("\n");
writeFileSync(join(out, "report.txt"), report + "\n");
console.log(report);
await b.close();
process.exit(results.some(r => r.startsWith("✗")) ? 1 : 0);
