# Capturas para el README

Las imágenes de `docs/` son marcadores: cada uno dice qué captura falta. Hazlas en este vault, con el mismo nombre de archivo, y sustitúyelas.

## Preparar el vault
1. En la raíz del repositorio: `npm install` y `npm run build`.
2. Copia `main.js`, `manifest.json` y `styles.css` a `demo-vault/.obsidian/plugins/cool-bases/` (esa carpeta no se sube: está en `.gitignore`).
3. Abre `demo-vault` como vault en Obsidian, activa el plugin principal **Bases** y **Cool Bases** en Plugins de la comunidad.
4. Obsidian **en inglés** (Ajustes → General → Idioma), tema por defecto, oscuro salvo que se diga otra cosa. Ventana de unos 1600 × 900.
5. Comprueba que se ven todas las portadas (vienen de Wikimedia Commons). Si alguna no carga, borra la propiedad `cover` / `poster` de esa nota: saldrá una portada generada.

## Bases y vistas
- `Books.base`: **Shelf** (estilo Portada: portada a la izquierda, estrellas, casilla «Read») y **Reading list** (estilo Lista, sin imagen; el año como superíndice).
- `Films.base`: **Posters** (estilo Póster: imagen de fondo, puntuación arriba a la derecha) y **Cards** (estilo Ficha: imagen arriba, datos juntados en una línea, etiquetas, pie con Wikipedia).
- «Don Quixote» y «Nosferatu» no tienen imagen a propósito: enseñan la portada generada.

## Una captura por imagen

| Archivo | Tamaño | Qué tiene que salir |
|---|---|---|
| `docs/hero.png` | 1600 × 900 | **Books · Shelf** con el panel **✎ Edit card** abierto, bloque **Size** desplegado. Que se vean 4–6 tarjetas, entre ellas «Don Quixote». |
| `docs/view-type.png` | 1200 × 700 | El menú de vistas de una base abierto, con **Cool Bases** en la lista de diseños (layouts). |
| `docs/panel.png` | 1200 × 800 | **Films · Cards** con el panel abierto en **Colors** o **Font**, a mitad de un cambio (p. ej. el selector de color abierto). Mejor como GIF corto (`docs/panel.gif`, cambia también el nombre en los README). |
| `docs/presets.png` | 1200 × 800 | Las cuatro vistas juntas, recortadas (Shelf, Reading list, Posters, Cards), o el menú **Presets** abierto con sus miniaturas. |
| `docs/data.png` | 1200 × 800 | **Films · Cards** con la lista **Data** del panel: `year · country · runtime` juntados con la cadena y el desplegable de un dato abierto. |
| `docs/ratings-states.png` | 1200 × 800 | **Books · Shelf** o **Films · Posters** de cerca: estrellas, la puntuación 8⁄10 y la casilla «Read» marcada en una tarjeta. |
| `docs/covers.png` | 1200 × 800 | Las portadas generadas: «Don Quixote» en Shelf y «Nosferatu» en Cards, con el bloque **Image → No image → Cover** abierto. |

Para el listado de community.obsidian.md (opcional): hasta 5 capturas de escritorio de 1200 × 800 y 5 de móvil de 900 × 1600 (PNG, JPEG o WebP, máximo 5 MB).
