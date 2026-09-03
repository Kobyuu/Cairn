# Cairn — Sistema de diseño (normativo)

> **Este documento manda sobre cualquier decisión visual del proyecto.** Es la
> destilación operativa del handoff de Claude Design que vive en
> [`design_handoff_cairn/`](design_handoff_cairn/). Ante una duda de detalle, la
> fuente es el `.dc.html` correspondiente; ante una contradicción, gana el
> handoff y **se corrige este archivo**, no al revés.
>
> Los `.dc.html` son **referencias**, no código para copiar: la tarea siempre es
> recrear el diseño con los patrones del proyecto (React + Tailwind v4).

## 0. Cómo se usa

Cualquier cambio que toque `src/` empieza leyendo esto. En concreto:

1. **Nunca hardcodear un color.** Todo sale de los tokens de `src/index.css`
   (CLAUDE.md §5). Si hace falta un color que no existe, se agrega como token
   con su justificación, no como un hex suelto en un componente.
2. **Nunca `currentColor` dentro de `color-mix`.** No resuelve contra un `color`
   seteado en línea y rompe el tema claro. Es un error real del handoff, no una
   precaución teórica.
3. **Nada en negrita.** El peso tipográfico del producto es 300 y 400. Si algo
   necesita jerarquía, se resuelve con tamaño, color o `letter-spacing`.
4. **Todo número lleva `tabular-nums`.** Un contador que baila al cambiar de
   cifra es el defecto más visible de un temporizador.

## 1. Dirección visual: **Aliento**

De las tres familias exploradas (Aliento, Gráfica, Estampa) la aprobada es
**Aliento**: halos concéntricos que respiran a **5,5 s**, el ritmo de una
respiración lenta.

El motivo es de escala, no de gusto: es el único lenguaje que sobrevive a los
tres modos. El dial de Gráfica no existe en una barra de 3 px, y el rojo de
Estampa es demasiado alerta para algo que está encendido ocho horas. La
respiración, en cambio, es la misma en el Foco, en el punto del Widget y en la
barra de Ambiente.

Rescatado de las descartadas: los **marcos de lámina** de Estampa (solo en el
panel de rutina, donde las imágenes tienen función) y las **escuadras de
encuadre** de Gráfica. `Cairn Foco Grafico.dc.html` y `Cairn Foco Estampa.dc.html`
quedan como registro y **no se implementan**.

## 2. Tokens

### Color

| Token         | Oscuro (default)        | Claro                   |
| ------------- | ----------------------- | ----------------------- |
| `--color-bg`  | `#0b0c0b`               | `#efece3`               |
| `--color-fg`  | `#e9e4d8`               | `#1a1c19`               |
| `--color-ac`  | `oklch(0.76 0.05 150)`  | `oklch(0.5 0.05 150)`   |

**Ambiente tiene tinta propia**, elegida por el fondo de la ventana de atrás y
**no** por el tema de la app: `oklch(0.82 0.06 150)` sobre oscuro,
`oklch(0.42 0.05 150)` sobre claro.

Los grises **no son tokens nuevos**: son `color-mix(in oklab, var(--color-fg) N%, transparent)`.
Los porcentajes que usa el handoff, ya expuestos como variables en `index.css`:

- Texto: 100 % (cifra), 66 % (botón secundario), 52 % (sobre-línea), 42 / 38 %
  (etiquetas), 34 / 30 % (pistas), 22 % (números de línea).
- Líneas: 30 % (escuadras, marco de lámina), 26 % (casilla), 22 / 20 % (bordes
  de botón), 18 % (chip), 16 / 14 / 13 / 12 / 10 / 8 % (halos y divisores).
- Superficies: 8 % (hover), 6 / 4 / 3 % (fondos de caja).

El acento se mueve **en luminosidad, nunca en tono**: `hover oklch(0.82 0.055 150)`,
`activo oklch(0.70 0.05 150)`, `tenue … / .35`.

### Tipografía

Dos familias, y ninguna más:

- **Newsreader 300** — cifras y frases. Itálica para las sobre-líneas y pistas.
- **IBM Plex Mono 400** — etiquetas, botones y datos. Siempre en mayúsculas con
  `letter-spacing` alto.

Escala web (siete pasos): Display 84/1.02 · H1 56/1.08 · H2 34/1.2 · H3 26/1.25 ·
Cuerpo 17/1.75 · Cuerpo S 13/1.9 (Mono) · Etiqueta 10 con `.3em` (Mono).

Las dos van **empaquetadas locales**, vía `@fontsource-variable/newsreader` y
`@fontsource/ibm-plex-mono`: los `.woff2` viven en el bundle y la app no le pide
nada a ninguna red al arrancar (CLAUDE.md §2). Por eso el `@import` de Google
Fonts que traen los `.dc.html` y los SVG de marca **no puede entrar a la app** —
en la landing sí está bien.

De Newsreader se usa la variante **`opsz`**, la que trae el eje de tamaño óptico
que pide el handoff (`opsz 6..72`). No es un lujo: el mismo tipo se usa a 196 px
en el cronómetro y a 19 px en la sobre-línea, y sin ese eje el trazo fino se
rompe en el tamaño chico. La familia se llama `Newsreader Variable`.

> **Costo medido y aceptado:** el bundle lleva **628 KB** de fuentes en 11
> archivos, de los cuales unos 330 KB son subsets (latin-ext, cirílico, griego,
> vietnamita) que el español nunca carga — el navegador solo pide `latin` por el
> `unicode-range`, pero los archivos igual viajan en el `.exe`. Recortarlos exige
> escribir los `@font-face` a mano contra rutas internas del paquete, que se
> rompen en el próximo `pnpm update`. Si el tamaño del instalador llega a
> importar, ese es el camino.

### Espaciado y grilla (web)

Escala `4 · 8 · 12 · 16 · 24 · 40 · 64 · 96 · 160`. Ancho máximo 1240, texto
máximo 680, 12 columnas, gutter 24, margen 64 (24 en móvil), 160 px de aire
entre secciones (96 en móvil).

## 3. Movimiento

Cuatro animaciones, todas CSS, todas en `index.css`:

| Nombre    | Qué hace                                | Duración |
| --------- | --------------------------------------- | -------- |
| `halo`    | `scale .9→1.08`, `opacity .28→.62`      | 5,5 s    |
| `wash`    | `scale 1→1.14`, `opacity .5→.85`        | 11 s     |
| `turn`    | `rotate 0→360`, lineal                  | 45 s     |
| `breathe` | `opacity .5→1`                          | 5,5 s    |

Hover: **150 ms y solo de color**. Entradas: opacidad + 12 px de subida en 500 ms.

**Prohibido:** parallax, contadores animados, carruseles automáticos.

**`prefers-reduced-motion`:** se congelan halos, wash, arco y respiración en su
estado medio. **El ancho y el grosor de Ambiente no se tocan**: son información,
no decoración. Esta distinción es la regla, no un detalle de implementación.

## 4. Las cinco pantallas

Detalle completo en el handoff. Lo que no se negocia:

### Foco — `Cairn Foco.dc.html`

`100vw × 100vh`, todo centrado. Capas de fondo concéntricas: wash de 900 px,
halos de 660 / 520 / 400 px con bordes al 13 / 10 / 8 % y desfase 0 / 0,7 / 1,4 s,
arco de acento de 212 px girando en 45 s, grano de 3 px al 50 % y viñeta.
Escuadras de 9 px a 34 / 44 px de los bordes.

Contenido: etiqueta de rutina (Mono 10 px, `.34em`, 38 %, entre dos hairlines de
56 px), sobre-línea itálica de 19 px al 52 %, **cronómetro de 196 px**
(Newsreader 300, `tabular-nums`, `mm:ss`), marca de respiración (punto de 5 px
en acento + `INHALAR · EXHALAR`), fila de botones a 76 px, y pista al pie.

Botones: `LISTO` en pastilla sólida de acento; `posponer 5` + `▾` en pastilla
partida con borde al 20 %; `ver rutina` en pastilla con borde.

### Rutina — `Cairn Rutina.dc.html`

Panel dentro de Foco, **colapsado por defecto**. Transición de 450 ms
`cubic-bezier(.4,0,.2,1)`: el cronómetro baja de 196 a 68 px y sube al
encabezado, el halo va de `top:50%` a `22%`, `INHALAR · EXHALAR` se va en 300 ms.

**La fila de botones no se mueve.** `LISTO` está en el mismo píxel abierto y
cerrado. Es la única acción que no puede reubicarse nunca.

Panel de 860 px (`max-width: calc(100vw - 160px)`), scroll interno, encabezado
fijo. Lectura: ítems Newsreader 300 a 27 px, casillas de 26 px, citas itálicas al
46 %, imágenes en marco de lámina. Edición: Mono 15 px, `line-height:2.1`,
canaleta de números de línea de 52 px, **sin resaltado de sintaxis**.

Pensado para crecer hacia notas: se agrega una columna de navegación de ~220 px
a la izquierda. **No meter tabs arriba** — rompe el encabezado y compite con la
fila de botones.

### Widget — `Cairn Widget y Ambiente.dc.html` (6a)

176 × 68 px, radio 5, fondo del tema al 62 % con blur 14 px, borde al 10 %.
Minutos en Newsreader 300 a 38 px + `MIN / RESTANTES` en Mono 9 px. Hairline de
progreso de 2 px al pie. Estados: reposo, hover, arrastre, pausado, último 10 %.

### Ambiente — mismo archivo (6b)

Barra al borde superior, ancho completo, **3 px** todo el ciclo y **5 px** en el
último 10 %, `pointer-events:none`, **sin texto**. Avance en pasos de 1 % sin
easing. Opacidad del 40 % al 90 % junto con el avance. En pausa: ancho congelado
y opacidad al 18 %, sin animación.

### Ajustes — `Cairn Ajustes.dc.html`

Columna de 720 px centrada, `max-width: calc(100vw - 96px)`, padding 64 arriba.
Secciones CICLO · MODOS · RUTINA · APARIENCIA · SISTEMA, con títulos en Mono
10 px `.3em` al 38 % y 48 px de aire arriba.

Cada fila: título Newsreader 300 a 23 px + descripción Mono 11 px al 42 %, con el
control a la derecha. Chips `padding:9px 15px`, **sin radio**, borde al 18 %;
activo con fondo de acento y texto en color de fondo. Interruptores de 52 × 26 px.

**No hay botón de aceptar ni de cancelar**: los ajustes se guardan al instante.

## 5. Assets

**La app no usa imágenes ni iconos.** Todo es tipografía, gradientes y bordes.
Las tres excepciones: el ícono de pausa del Widget (dos rectángulos), los glifos
`▾ · ✓` de la tipografía, y las láminas del panel de rutina, que son **contenido
del usuario**.

La marca vive en [`../assets/logo/`](../assets/logo/) con su propio `LEEME.md`
(área de resguardo, tamaños mínimos, variantes). Los iconos de la app ya están
instalados en `src-tauri/icons/`.

> **Los SVG de marca traen un `@import` de Google Fonts.** Dentro de la app hay
> que usar los **PNG**, o convertir el texto a curvas. En la landing el SVG está
> bien.

## 6. Landing y sistema web

El mensaje, la estructura de ocho secciones, el precio y el tono están en
[`design_handoff_cairn/landing_mensaje_y_estructura.md`](design_handoff_cairn/landing_mensaje_y_estructura.md);
los tokens, la escala y los componentes web en `Cairn Sistema Web.dc.html`; y la
**página completa en alta fidelidad** en
[`design_handoff_cairn_landing/Cairn Landing.dc.html`](design_handoff_cairn_landing/).
El copy de ese prototipo **está escrito para publicarse tal cual**.

Lo que hay que saber antes de implementarla:

- **Las capturas del prototipo están recreadas en HTML/CSS, no son imágenes.**
  En producción se reemplazan por PNG/WebP a 2× exportados de la app real,
  respetando los marcos del kit. Los halos y el grano de esas maquetas existen
  solo para poder revisar la página sin la app compilada.
- **Responsive:** resuelto a 1240 px. Cortes en 1024 / 900 / 700. Por debajo de
  700 la captura de Foco se escala con `transform: scale()` desde el centro y
  **no se reflowea**; mantiene `aspect-ratio:16/10` en todos los anchos.
- **Estado:** casi nada. `abierta` (índice del acordeón, `-1` = todas cerradas,
  arranca en 0) y el cronómetro de la maqueta. El contenido (`razones`, `ciclo`,
  `faq`, `incluye`, `tiras`, `pasos`) va en datos, **no en el markup**.
- La barra de Ambiente fija de 3 px arriba de la página es el producto
  funcionando sobre su propia web. **Nunca se anima.**
- Fondo `#0B0C0B` en toda la página: **no hay secciones claras**.

Promesa: *«Cada 45 minutos, una pausa que te espera.»* Las tres razones, en este
orden: el ciclo no se reinicia solo · se puede volver casi invisible · la rutina
es tuya.

Tono: voseo, sin exclamaciones. Prohibido "productividad", "hábitos" y
"bienestar" — es donde está toda la competencia.

Capturas: siempre tema oscuro, **los mismos números en toda la web** (`01:24` en
Foco, `27 min` en el Widget), PNG a 2× / WebP. La barra de Ambiente se muestra a
**su grosor real**: si no se ve, se agranda el encuadre, nunca la barra. Nunca
marcos de macOS, manos sosteniendo pantallas, ni perspectiva 3D.

El trabajo está seguido en el issue [#3](https://github.com/Kobyuu/Cairn/issues/3).

## 7. Estado de la implementación

| Pieza                          | Estado                                                        |
| ------------------------------ | ------------------------------------------------------------- |
| Tokens, tipografía, movimiento | **Hecho** en `src/index.css`                                  |
| Foco                           | **Hecho** en `src/views/Foco.tsx`, ya a pantalla completa      |
| Ajustes                        | **Parcial**: CICLO (intervalo y posponer rápido) y SISTEMA (autostart). Faltan MODOS, RUTINA y APARIENCIA |
| Rutina                         | Etapa 5                                                       |
| Widget · Ambiente              | **Hecho** en `src/views/Widget.tsx` y `src/views/Ambient.tsx` (ver abajo lo omitido) |
| Fuentes empaquetadas           | **Hecho** — Newsreader Variable (eje `opsz`) + IBM Plex Mono 400 |
| Landing                        | Issue #3                                                      |

**Foco sigue cubriendo las tres fases, y es a propósito.** El handoff lo dibuja
en su estado vencido (`llevás en pausa` + cronómetro ascendente). Ahora que
existen los tres modos, `running` tiene además su Widget y su Ambiente — pero
Foco es también un modo que se puede elegir y dejar puesto todo el día, así que
la misma pantalla sigue pintando `running` y `paused` cambiando la sobre-línea y
la fila de botones, con el encuadre idéntico.

**Lo que se omitió del handoff del Widget, con su razón:**

- **`backdrop-filter: blur(14px)`.** Detrás de una ventana transparente no hay
  nada que el compositor del webview pueda muestrear: el blur no hace nada. El
  desenfoque real sería `windowEffects` (acrylic de Windows 11), que trae su
  propio tinte y pelea con la paleta. Queda para la etapa 6 si hace falta.
- **La sombra larga (`box-shadow`).** Es un color hardcodeado (CLAUDE.md §5) y
  sobre una ventana transparente se ve como un halo cuadrado, no como sombra.
- **Los botones de pausa y modo del estado hover, y el estado de arrastre**
  (escala .96, rotación -.6°, borde punteado). La bandeja ya tiene pausa y los
  tres modos; el arrastre lo dibuja Windows. Es decoración de la etapa 6.

**Lo que NO se implementó todavía y hay que saber:** el selector de tema (los
tokens de `[data-theme="light"]` ya existen y `store.json` ya guarda `theme`,
falta el control y el comando que lo escriba), el menú `▾` de posponer arbitrario
en la pastilla partida, el `pauseCountToday`, y el sonido al avisar.

**Foco ya es pantalla completa.** Desde la etapa 4 la ventana se redimensiona en
píxeles físicos al monitor primario (posición y tamaño), sin bordes y siempre
encima, pero **sin** `set_fullscreen(true)` (D5). El layout ya era relativo al
viewport, así que el cambio no tocó una sola línea de estilo. Como consecuencia,
Foco dejó de ser arrastrable: una ventana pegada al monitor no se mueve.
