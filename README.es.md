# Cool Bases

Convierte tus [Bases](https://help.obsidian.md/bases) en tarjetas diseñadas por ti, desde un panel lateral visual.

🇬🇧 [Read in English](README.md)

![Una vista Cool Bases con el panel de edición abierto](docs/hero.png)

## Qué hace

- **Un tipo de vista nuevo para Bases.** Tus notas salen como tarjetas: libros, películas, personas, lugares, proyectos… cualquier cosa con propiedades.

- **La tarjeta se diseña en un panel, en vivo.** Tamaño, colores, fuente, imagen, datos y decoraciones. Cada cambio se ve al momento en las tarjetas. No se guarda nada hasta pulsar **Listo**.

  ![Cambiar la tarjeta en vivo desde el panel](docs/panel.png)

- **Cuatro estilos para empezar.** Póster, Ficha, Portada y Lista. Guarda los tuyos o copia el estilo de cualquier otra vista Cool Bases del vault.

  ![Los cuatro estilos predeterminados](docs/presets.png)

- **Tus datos, a tu manera.** Ordena las propiedades arrastrando, pon dos en la misma línea, convierte una en superíndice, enseña las listas como etiquetas, los enlaces con el nombre del sitio y las notas enlazadas una por línea.

  ![Opciones de los datos](docs/data.png)

- **Valoraciones y estados.** Estrellas, puntuación o caras a partir de un número o de emojis ⭐. Las propiedades sí/no como texto, pastilla, etiqueta, icono, punto… o una casilla que se marca en la propia tarjeta.

  ![Valoraciones y estados](docs/ratings-states.png)

- **Portadas para las notas sin imagen.** Se dibuja una portada tipográfica sencilla, para que todas las tarjetas midan lo mismo.

  ![Portadas generadas](docs/covers.png)

## Instalar

**Desde Plugins de la comunidad** (cuando esté publicado): Ajustes → Plugins de la comunidad → Explorar → busca **Cool Bases** → Instalar → Activar.

**Con BRAT:** instala el plugin [BRAT](https://github.com/TfTHacker/obsidian42-brat), elige **Add beta plugin** y pega `pattgue/cool-bases`.

**A mano:** descarga `main.js`, `manifest.json` y `styles.css` de la [última versión](https://github.com/pattgue/cool-bases/releases/latest) y ponlos en `.obsidian/plugins/cool-bases/` dentro de tu vault. Reinicia Obsidian y activa **Cool Bases** en Ajustes → Plugins de la comunidad.

## Primeros pasos

1. Activa el plugin principal **Bases** (Ajustes → Plugins principales → Bases).
2. Crea una base: clic derecho en una carpeta → **Nueva base**, o con el comando de Bases para crear una base nueva.
3. En el menú de vistas, arriba a la izquierda de la base, añade una vista (o edita la actual) y elige **Cool Bases** como diseño.

   ![Elegir Cool Bases como tipo de vista](docs/view-type.png)
4. Pulsa **✎ Editar tarjeta** (arriba a la derecha de la vista). El panel se abre a la derecha.
5. Cambia lo que quieras y pulsa **Listo**.

Las tarjetas empiezan con las propiedades marcadas en el menú **Propiedades** de la base. Un clic en una tarjeta abre su nota.

¿Quieres probarlo antes con datos de verdad? La carpeta [`demo-vault`](demo-vault) es un vault pequeño con libros y películas, ya diseñado.

## El panel

El panel edita la vista entera: todas sus tarjetas a la vez. Cada vista de cada base guarda su propio diseño, dentro del archivo `.base`.

Arriba: **Deshacer** (o Ctrl/Cmd+Z), **Cancelar** (o Escape: deja la vista como estaba) y **Listo** (guarda).

### Estilos
- **Predeterminados**: Póster, Ficha, Portada y Lista, y además **Mis estilos**.
- **Guardar estilo**: guarda el diseño actual con un nombre, para cualquier vista de este vault.
- **Copiar de otra vista**: toma el diseño de otra vista Cool Bases (no sus datos).

### Tarjeta
- **Tamaño**: ancho, alto o un formato fijo (1:1, 4:5, 3:4, 2:3, 16:9), llenar el ancho, margen interior, redondeo de las esquinas y separación entre tarjetas.
- **Colores**: fondo (con degradado si quieres), texto, detalles (el color de acento) y borde.
- **Fuente**: tipografía, peso, tamaño y alineación. Puedes elegir cualquier fuente instalada en tu ordenador o escribir su nombre.
- **Imagen**: qué propiedad tiene la imagen, su posición y su ajuste (**Encajar**, **Original**, **Enmarcada**, **Fondo**), efectos (B/N, duotono, desenfoque, invertir), grano, brillo y un degradado oscuro. **Sin imagen** decide qué enseñan las notas sin imagen: nada, sus iniciales, un hueco o una **Portada** generada.

### Datos
- El **título** está siempre, pero puede llevar datos encima.
- Ordena las demás propiedades arrastrando, quítalas con ✕ y añade más con **+ Añadir dato**.
- El icono de cadena entre dos datos los pone en la **misma línea**, con un separador.
- Cada dato tiene su tipografía, mayúsculas, color, tamaño, peso, **Ajustar** (una sola línea, encoge hasta caber), separación arriba y abajo, cursiva, subrayado, resaltado, tachado, superíndice, enlace y hover.
- Tipos: **Texto**, **Número**, **Dato inteligente** (un número de seguidores u oyentes que enlaza al perfil), **Etiquetas**, **Enlace** y **Notas enlazadas** (también las notas que enlazan *a* esta).

### Decoraciones
- **Pie**: una franja abajo de la tarjeta para enlaces (web, redes…).
- **Valoración**: estrellas, una puntuación (como 8⁄10) o caras, entre los datos o en cualquiera de los 9 puntos de la tarjeta.
- **Estados**: uno por cada propiedad sí/no que quieras enseñar: texto, pastilla, etiqueta, casilla, icono o punto.
- **Líneas**: separadores que se arrastran entre los datos.
- **Hover**: cómo se ven los enlaces al pasar el puntero.

### CSS libre
Para todo lo demás. Solo se aplica a esa vista. Clases útiles: `.cb-card`, `.cb-body`, `.cb-media`, `.cb-l` (una línea de datos), `.cb-i[data-prop="note.year"]` (un dato), `.cb-st` (un estado), `.cb-foot`.

## Trucos

- **Valoraciones con emoji.** Si tus valoraciones son como `⭐⭐⭐⭐`, Cool Bases cuenta las estrellas. También vale un número (eliges sobre cuánto).
- **Marcar desde la tarjeta.** Da a una propiedad sí/no (como `read`) un estado con formato **Casilla**: al pulsarla en la tarjeta cambia la nota, sin abrirla.
- **Portadas generadas.** Imagen → Sin imagen → **Portada**. Elige el texto de abajo (el autor, el director, el año…), colores automáticos o los de la tarjeta, y una forma.
- **Varios datos en una línea.** Pulsa la cadena entre dos datos: `1927 · Germany · 153 min`. La valoración y los estados también se pueden juntar a una línea.
- **Superíndices.** Activa **Superíndice** en un dato para ponerlo pequeño y arriba, detrás del anterior, como el año junto a un título.

## Preguntas frecuentes

**¿Dónde se guarda mi diseño?**
En el archivo `.base`, dentro de la vista, en la clave `coolbases`. Si borras esa clave, la vista vuelve a la tarjeta de partida.

**¿Cambia mis notas?**
Solo si marcas un estado **Casilla** en una tarjeta: eso cambia la propiedad sí/no de esa nota. No escribe nada más en tus notas.

**¿Qué lee?**
Las propiedades de tus notas, a través de Obsidian, para pintar las tarjetas. Y solo para **Copiar de otra vista** lista los archivos `.base` del vault, para encontrar sus vistas Cool Bases. No lee nada más y no envía nada a internet.

**¿Puedo usar mis fuentes?**
Sí: cualquier fuente instalada en tu ordenador. Si Obsidian no puede listarlas, escribe el nombre en el buscador de tipografías. Las portadas generadas solo pueden usar fuentes instaladas en el sistema.

**¿El dato inteligente se actualiza solo?**
No. Enseña el número que hay en la nota y enlaza al perfil. Mantenerlo al día es cosa tuya (o de otro plugin).

**¿Se conecta a internet?**
No. Solo enseña las imágenes a las que apuntan tus notas.

## Compatibilidad

- Obsidian **1.10** o posterior (necesita la API de vistas de Bases).
- Escritorio y móvil.

## Ayuda y sugerencias

¿Algo falla o tienes una idea? Abre un [issue en GitHub](https://github.com/pattgue/cool-bases/issues). Las capturas ayudan mucho.

## Licencia

[MIT](LICENSE) © 2026 Patt
