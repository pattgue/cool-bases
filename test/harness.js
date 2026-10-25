/* Arnés: carga Cool Bases (main.js) con la API simulada y pinta las vistas de las bases de window.DATOS.
   #views[|es][|light]               todas las vistas, una debajo de otra
   #panel=<base>|<vista>[|es][|light] una vista con el panel abierto
   window.__lang lo pone la página antes de cargar el plugin (es / en). */
(async function () {
  "use strict";
  const { TFile, toValue, NullValue, StringValue, Events } = window.__obsidian;
  const D = window.DATOS;
  const out = document.getElementById("out");
  const log = (...a) => { (window.__log ||= []).push(a.join(" ")); };

  /* ---------- «vault» ---------- */
  const notes = D.notes.map(n => Object.assign(new TFile(n.path), { fm: n.fm }));
  const bases = D.bases.map(b => Object.assign(new TFile(b.path), { text: b.text, yaml: b.yaml }));
  const byName = new Map(notes.map(f => [f.basename.toLowerCase(), f]));
  const byPath = new Map(notes.map(f => [f.path, f]));
  const workspace = Object.assign(new Events(), {
    openLinkText: (l, s, m) => log("open", l, "from", s || "-", m ? "(new tab)" : ""),
    iterateAllLeaves: () => {},
  });
  const app = {
    renderContext: {},
    metadataCache: {
      getFileCache: f => f && f.fm ? { frontmatter: f.fm } : null,
      getFirstLinkpathDest: link => byName.get(String(link).split("/").pop().replace(/\.md$/, "").toLowerCase()) || null,
    },
    vault: { getMarkdownFiles: () => notes, getFiles: () => [...notes, ...bases], getResourcePath: f => "vault://" + f.path, cachedRead: async f => f.text,
      getAbstractFileByPath: p => byPath.get(p) || null },
    fileManager: { processFrontMatter: async (f, fn) => { fn(f.fm); log("frontmatter", f.path, JSON.stringify(f.fm)); } },
    workspace,
  };

  /* ---------- plugin ---------- */
  const mod = window.__pluginModule;
  const Cls = mod.default || mod;
  const plugin = new Cls(app, { id: "cool-bases" });
  await plugin.onload();
  const reg = window.__basesViews["cool-bases"];
  if (!reg) throw new Error("the «cool-bases» view was not registered");
  window.__app = app; window.__plugin = plugin;

  /* ---------- Bases: filtros, orden y grupos (lo justo para estas bases) ---------- */
  const toArr = v => Array.isArray(v) ? v : v == null ? [] : [v];
  const normProp = p => /^(note|file|formula)\./.test(p) ? p : "note." + p;
  const lit = s => { s = s.trim(); if (/^".*"$/.test(s)) return s.slice(1, -1); if (s === "true") return true; if (s === "false") return false; return isNaN(+s) ? s : +s; };
  function evalF(f, fm, path) {
    if (!f) return true;
    if (typeof f === "string") {
      let m = /^file\.inFolder\("([^"]+)"\)$/.exec(f.trim());
      if (m) return path.startsWith(m[1] + "/");
      m = /^(\w+)\.contains\((.+)\)$/.exec(f.trim());
      if (m) { const v = String(lit(m[2])).toLowerCase(); return toArr(fm[m[1]]).some(x => String(x).toLowerCase() === v); }
      m = /^(\w+)\s*(==|!=)\s*(.+)$/.exec(f.trim());
      if (m) { const a = fm[m[1]], b = lit(m[3]); const eq = typeof b === "boolean" ? a === b : String(a) === String(b); return m[2] === "==" ? eq : !eq; }
      throw new Error("filter not supported by the harness: " + f);
    }
    if (f.and) return f.and.every(x => evalF(x, fm, path));
    if (f.or) return f.or.some(x => evalF(x, fm, path));
    if (f.not) return !f.not.some(x => evalF(x, fm, path));
    return true;
  }
  const count = v => { const s = String(toArr(v)[0] ?? ""); const n = (s.match(/⭐|★/g) || []).length; if (n) return n; const d = s.replace(/\D/g, ""); return d ? +d : null; };
  function sortKey(prop, f) {
    const custom = window.__sortKey && window.__sortKey(prop, f);   // fórmulas: las puede dar la página
    if (custom !== undefined) return custom;
    if (prop === "file.name") return f.basename;
    const fm = f.fm, raw = fm[prop.replace(/^note\./, "")];
    return /rating/.test(prop) ? count(raw) : raw == null ? null : raw;
  }
  function makeView(base, v, store, host) {
    let list = notes.filter(n => evalF(base.yaml.filters, n.fm, n.path) && evalF(v.filters, n.fm, n.path));
    for (const s of (v.sort || []).slice().reverse()) {
      list = list.slice().sort((a, b) => { const x = sortKey(s.property, a), y = sortKey(s.property, b);
        if (x == null && y == null) return 0; if (x == null) return 1; if (y == null) return -1;
        const c = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y)); return s.direction === "DESC" ? -c : c; });
    }
    const entries = list.map(f => ({ file: f, getValue: p => {
      if (p === "file.name") return new StringValue(f.basename);
      if (p.startsWith("note.")) return toValue(f.fm[p.slice(5)]);
      /* fórmulas: las que defina un test en window.__formulas, { "formula.x": (frontmatter, valores) => Value } */
      if (window.__formulas && window.__formulas[p]) return window.__formulas[p](f.fm, window.__obsidian);
      return new NullValue();
    } }));
    const groups = [];
    if (v.groupBy && v.groupBy.property) {
      const map = new Map();
      for (const e of entries) { const k = toArr(e.file.fm[v.groupBy.property]).join(", "); if (!map.has(k)) map.set(k, []); map.get(k).push(e); }
      for (const [k, es] of [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]))) groups.push({ key: k ? new StringValue(k) : new NullValue(), hasKey: () => !!k, entries: es });
    } else groups.push({ key: new NullValue(), hasKey: () => false, entries });
    const props = new Set(["file.name"]);
    for (const e of entries) for (const k of Object.keys(e.file.fm)) props.add("note." + k);
    const config = {
      name: v.name,
      get: k => store[k],
      set: (k, val) => { store[k] = JSON.parse(JSON.stringify(val)); log("config.set", k); },
      getOrder: () => (v.order || []).map(normProp),
      getSort: () => (v.sort || []).map(s => ({ property: normProp(s.property), direction: s.direction })),
      getAsPropertyId: k => store[k] ? normProp(String(store[k])) : null,
      getDisplayName: p => (base.yaml.properties && base.yaml.properties[p] && base.yaml.properties[p].displayName) || (p === "file.name" ? "file name" : p.replace(/^(note|file|formula)\./, "")),
    };
    const controller = { app, config, data: { data: entries, groupedData: groups }, allProperties: [...props] };
    const scrollEl = host.createDiv({ cls: "bases-view-scroll" });
    const view = reg.factory(controller, scrollEl);
    view.onDataUpdated();
    return view;
  }
  window.__makeView = makeView;

  /* ---------- páginas ---------- */
  const parts = decodeURIComponent(location.hash.slice(1)).split("|");
  const light = parts.includes("light");
  document.body.className = light ? "theme-light" : "theme-dark";
  if (parts[0].startsWith("panel=")) {
    const bn = parts[0].slice(6), vn = parts[1];
    const base = bases.find(b => b.basename === bn), v = base.yaml.views.find(x => x.name === vn);
    const host = out.createDiv({ cls: "workspace-leaf-content" });
    app.workspace.iterateAllLeaves = cb => cb({ view: { containerEl: host, file: base } });   // la hoja de Obsidian con su .base
    host.createDiv({ cls: "bases-toolbar", text: base.basename + " · " + v.name });
    const store = Object.assign({}, v);
    const view = makeView(base, v, store, host);
    window.__view = view; window.__store = store;
    view.editBtn.click();
    return;
  }
  window.__views = [];
  for (const base of bases) for (const v of base.yaml.views) {
    if (v.type !== "cool-bases") continue;
    const sec = out.createDiv({ cls: "par" });
    sec.createEl("h2", { text: base.basename + " · " + v.name });
    const host = sec.createDiv({ cls: "workspace-leaf-content" });
    const store = Object.assign({}, v);
    window.__views.push({ id: base.basename + " · " + v.name, view: makeView(base, v, store, host), store });
  }
})().catch(e => { (window.__errors ||= []).push(String(e && e.stack || e)); document.body.prepend("ERROR: " + e); });
