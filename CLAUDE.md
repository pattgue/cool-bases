# Cool Bases

Plugin de Obsidian de Patt: vistas de tarjetas para Bases, diseñadas desde un panel. TypeScript sin framework con los helpers de DOM de Obsidian, esbuild, `css/` que se junta en `styles.css`, `src/i18n.ts` en inglés y español, y lint con `eslint-plugin-obsidianmd`.

**Pruebas:** `npm run check`, `npm run lint`, `npm run build` y después `cd test && npm test` (mock de Obsidian y harness en Chromium; informe y capturas en `test/out/`). Si hay un Cool Trip compilado en `../cool-trip` (o `COOL_TRIP=/ruta/a/cool-trip`), las pruebas también cargan los dos plugins juntos.

**Versiones:** `manifest.json`, `package.json`, `package-lock.json` y `versions.json` a la vez. Patt crea la etiqueta `x.y.z` (sin «v») y la Action hace la Release.

## El Cool Kit (la Cool Bar): una sola fuente

- El código común de la Cool Bar son `src/cool-kit/` (kit.ts, i18n.ts, settings.ts, README.md) y `css/cool-kit.css`. **La fuente es este repo, rama `main`.** Los demás plugins Cool (hoy `pattgue/cool-trip`) lo copian tal cual, sin tocar nada.
- Cualquier cambio en el kit sube `KIT_VERSION` en `kit.ts` y los selectores `[data-ck="…"]` de `cool-kit.css` al mismo número, y se copia a todos los plugins Cool en la misma ronda.
- Lo que es de Cool Bases (su botón, `kind: "panel"`, sus ajustes en `store.coolBar`, el panel que cuelga del botón) va en `src/main.ts`, `src/view.ts` y `src/panel.ts`, nunca en `src/cool-kit/`.
- En el móvil, de momento, el kit no pinta la barra (`Platform.isPhone`); mientras tanto Cool Bases enseña su botón «✎ Editar tarjeta» en la vista. Pendiente con Patt: el diseño de la Cool Bar del móvil.
