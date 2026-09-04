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

> **Lo implementado es una aproximación, y es a propósito.** La ventana de
> Ambiente es transparente y no hay forma de leer qué hay detrás, así que la
> tinta sigue al **tema de la app**. Con el tema en Sistema eso es literalmente
> el tema de Windows, que es lo más cerca que estamos del fondo del escritorio.
> La consecuencia visible: tema claro sobre un fondo oscuro deja la franja casi
> invisible, y se arregla cambiando el tema.

Los grises **no son tokens nuevos**: son `color-mix(in oklab, var(--color-fg) N%, transparent)`.
Los porcentajes que usa el handoff, ya expuestos como variables en `index.css`:

- Texto: 100 % (cifra), 66 % (botón secundario), 52 % (sobre-línea), 42 / 38 %
  (etiquetas), 34 / 30 % (pistas), 22 % (números de línea).
- Líneas: 30 % (escuadras, marco de lámina), 26 % (casilla), 22 / 20 % (bordes
  de botón), 18 % (chip), 16 / 14 / 13 / 12 / 10 / 8 % (halos y divisores).
- Superficies: 8 % (hover), 6 / 4 / 3 % (fondos de caja).

El acento se mueve **en luminosidad, nunca en tono**: `hover oklch(0.82 0.055 150)`,
`activo oklch(0.70 0.05 150)`, `tenue … / .35`.

Cuando el acento hace de **superficie** y no de tinta, se mezcla igual que los
grises: 12 % (tarjeta de modo elegida), 22 % (pista del interruptor encendido),
55 / 70 / 90 % (arco de Foco y hairline del Widget). Están en `index.css` como
`--ac-12 … --ac-90`.

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
en acento + `INHALAR · EXHALAR`), fila de botones y pista al pie.

Entre la sobre-línea y el cronómetro van **24 px, no los 6 del handoff**: con
`line-height: .92` la caja del cronómetro queda más corta que sus propios
glifos, así que a 196 px las cifras se suben y le pisan la itálica.

**La fila de botones va anclada al pie (`bottom: 88px`), abierta o cerrada**, y
no colgando del cronómetro como la dibuja `Cairn Foco.dc.html`. Manda
`Cairn Rutina.dc.html`, que es el único archivo del handoff que dibuja los dos
estados: con la fila en el flujo, encoger el cronómetro al abrir la rutina la
movería, y eso está prohibido más abajo.

**El bloque del cronómetro, en cambio, va centrado con el panel cerrado**
(`padding-top: calc(50vh - 130px)`, la mitad de su propio alto) y sube a 58 px
al abrirse un panel. El `padding-top: 150px` que usa el prototipo de Rutina para
el estado colapsado deja el cronómetro arriba y el halo en el centro: en el
artboard corto del handoff no se nota, y en un monitor de verdad parte la
pantalla en dos mitades que no se hablan.

Botones: `LISTO` en pastilla sólida de acento; `posponer 5` + `▾` en pastilla
partida con borde al 20 %; `ver rutina` en pastilla con borde.

### Rutina — `Cairn Rutina.dc.html`

Panel dentro de Foco, **colapsado por defecto**. Transición de 450 ms
`cubic-bezier(.4,0,.2,1)`: el cronómetro baja de 196 a 60 px y sube al
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

MODOS lleva dos filas y no una: las tres tarjetas del **modo por defecto** que
dibuja el handoff, y una fila **Pantalla** que el handoff no tiene —hecha con
los mismos chips que CICLO— porque el handoff asume un solo monitor. Ver §7.

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
- **Responsive:** resuelto a 1240 px. Cortes en 1024 / 900 / 700 (más uno en 480
  para la nav). La captura de Foco se escala con el ancho y **no se reflowea**:
  siendo una imagen real, `width:100%` con `height:auto` ya conserva su relación
  de aspecto sin `transform`. La relación es la de la pantalla capturada (16/9),
  no 16/10: recortar a 16/10 comía el título de la rutina.
- **Estado:** ninguno. El acordeón de preguntas es `<details name="faq">`
  nativo —abre una y cierra las demás sin JavaScript— y el cronómetro `01:24`
  es parte de la captura, no un contador vivo.

  > La versión previa de esta línea pedía que el contenido (`razones`, `ciclo`,
  > `faq`, `tiras`, `pasos`) fuera **datos y no markup**. Eso describía el
  > prototipo, que es un componente con estado. La landing implementada es HTML
  > plano: cumplirlo obligaría a renderizar el texto por JavaScript, y una
  > página cuyo argumento es «no hay servidor» no puede depender de JS para
  > mostrar lo que dice. **En la implementación el markup es los datos.**
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
| Ajustes                        | **Hecho** — las cinco secciones: CICLO · MODOS · RUTINA · APARIENCIA · SISTEMA |
| Rutina                         | **Hecho** en `src/views/Routine.tsx` (lectura renderizada y edición en `<textarea>`); falta la lámina de referencia, que es contenido del usuario |
| Widget · Ambiente              | **Hecho** en `src/views/Widget.tsx` y `src/views/Ambient.tsx` (ver abajo lo omitido) |
| Fuentes empaquetadas           | **Hecho** — Newsreader Variable (eje `opsz`) + IBM Plex Mono 400 |
| Landing                        | **Hecha** en `site/` — HTML plano, sin build (issue #3)        |

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
- **El estado de arrastre** (escala .96, rotación -.6°, borde punteado). El
  webview **no recibe eventos de mouse mientras dura el arrastre**: lo maneja
  Windows desde que `data-tauri-drag-region` dispara el `WM_NCLBUTTONDOWN`, así
  que no hay un `mouseup` al que colgar el final del estado. Dibujarlo dejaría
  el widget torcido hasta el próximo `mouseenter`.

**Los botones de pausa y `MODO` del hover SÍ entraron** en la etapa 6: son
función, no decoración, y son la única forma de pausar sin ir a la bandeja. Al
pasar el mouse reemplazan a `MIN / RESTANTES` —en 176 px no entran los dos— y
`MODO` rota los tres modos en el orden Ambiente → Widget → Foco.

**Y con el ciclo vencido, el widget muestra `LISTO` en lugar de pausar.** Ese
estado no existía cuando el handoff dibujó el widget, porque entonces al vencer
Foco tapaba la pantalla y no había forma de estar mirando el widget. Ahora que
Foco se puede apartar, sí la hay: la cifra cuenta **hacia arriba** (`N MIN DE
PAUSA`, en vez de un `0 MIN RESTANTES` que sería falso) y el control del hover
pasa a ser `LISTO` en sólido de acento, porque es la única acción que cierra el
ciclo. Confirma igual que el `LISTO` de Foco: reinicia y deja la rutina limpia
(la regla vive en `clearRoutineChecks`, escrita una sola vez).

**No hay notificación del sistema, y es una decisión.** La etapa 3 levantaba un
toast de Windows al vencer, con `tauri-plugin-notification`. Salió en la etapa 6
por dos razones que se sumaban: aparece en el **mismo instante** en que Foco tapa
el monitor entero, así que es un aviso encima del aviso; y sin instalador que
registrara el `AppUserModelID` de la app, Windows lo emitía con la identidad de
PowerShell.

**La segunda razón ya no corre.** Desde el issue #16 hay instalador NSIS, y el
bundler escribe `PKEY_AppUserModel_ID` con el valor de `com.kobyuu.cairn` en los
accesos directos del menú Inicio y del escritorio (verificado en
`installer.nsi:949,952,976`). O sea: **un toast con la identidad de Cairn ya es
posible.** Ver `docs/specs/SPEC-distribution.md` §5.

Queda en pie la primera, que era la de fondo: el aviso de Cairn **es** la
pantalla de Foco, más el tono de `sound.ts` si está encendido, y un toast encima
sería redundante. Un toast propio sólo tendría sentido como *alternativa* a que
Foco tome la pantalla —"avisar sin taparte"—, y eso sigue siendo una decisión de
producto abierta, no un cambio de piel.

**Lo que cerró la etapa 6:** el selector de tema (tres chips, el comando
`settings_set_theme` y la aplicación a las tres ventanas por el evento
`settings-changed`), las secciones MODOS / RUTINA / APARIENCIA de Ajustes, el
menú `▾` de posponer arbitrario, el sonido al avisar, la etiqueta de rutina en
la sobre-línea de Foco y los controles del Widget al pasar el mouse.

**Lo que se decidió NO implementar, con su razón:**

- **`pauseCountToday`.** El §State Management del handoff lo lista, pero existía
  para la **cifra de contorno de la dirección Gráfica** — el número gigante de
  pausas del día detrás del dial. Gráfica se descartó y ninguna pantalla de
  Aliento lo muestra: sería un contador que nadie pinta, con un bug de
  medianoche incluido.
- **`RESTABLECER TODO`** al pie de Ajustes. Restablecer de verdad implica
  reescribir el intervalo del ciclo en curso y conmutar de modo: tres efectos
  encadenados para un botón que nadie pidió y que ya tiene equivalente —
  `store.json` es un archivo que se abre con el Bloc de Notas y se borra
  (CLAUDE.md §3), y la app arranca con defaults sin un solo error.
- **El encabezado de Ajustes** (mojón de la marca + `Ajustes` a 44 px +
  versión). Ajustes no es una ventana propia: es un panel dentro de Foco, y la
  sobre-línea ya dice `AJUSTES` en el mismo lugar donde el handoff pone el
  título. Dos títulos serían el mismo dato dos veces.

**El primer cuadro siempre se pinta oscuro.** El tema guardado llega por IPC un
instante después de montar, así que con el tema claro elegido hay un parpadeo de
un cuadro al arrancar. Es el precio de no bloquear el render esperando al disco;
si molesta, el camino es que Rust inyecte el atributo al crear la ventana.

**Foco ya es pantalla completa.** Desde la etapa 4 la ventana se redimensiona en
píxeles físicos al monitor elegido (posición y tamaño), sin bordes y siempre
encima, pero **sin** `set_fullscreen(true)` (D5). El layout ya era relativo al
viewport, así que el cambio no tocó una sola línea de estilo. Como consecuencia,
Foco dejó de ser arrastrable: una ventana pegada al monitor no se mueve.

**Y por eso la pantalla se elige, no se arrastra.** Antes las dos ventanas
estaban clavadas al monitor **primario**, lo que en un escritorio de dos
pantallas es simplemente el monitor equivocado la mitad del tiempo. Arrastrarlas
no era una opción: el chequeo de 1 Hz de `keep_aligned` las devuelve a su
rectángulo, así que la ventana volvería sola en un segundo. La fila **Pantalla**
de MODOS resuelve lo mismo sin pelearle a esa alineación —aparece sólo con dos
monitores o más, porque un selector de una opción no es una elección— y vale
para Foco **y** Ambiente a la vez: las dos son la misma presencia en la misma
pantalla, y separarlas serían dos ajustes para una decisión.

Se guarda el **nombre** que reporta Windows (`\\.\DISPLAY1`), que es lo único
estable: el orden de la lista y las coordenadas cambian al enchufar o
desenchufar algo. Ausente = el primario, *el que sea*, así que cambiar el
monitor principal desde Windows sigue funcionando sin tocar Cairn. Si la
pantalla elegida se desenchufa, las ventanas caen al primario y **la elección
no se borra**: volver a enchufarla la restaura sola.

**Foco se puede apartar aunque el ciclo esté vencido, y el ciclo no se mueve.**
Minimizarla —con `Win + ↓` o desde la barra de tareas— o abrir la carpeta de
notas la baja a Ambiente. Antes no se podía: el cálculo de qué ventana mostrar
devolvía Foco mientras la fase estuviera vencida, así que la ventana volvía
sola. Ahora hay un bit de "el usuario la apartó" que caduca solo al salir de
vencido, de modo que la pausa siguiente vuelve a interrumpir. **La fase sigue en
`Elapsed` y la barra de Ambiente se queda al 100 %:** apartar la ventana no es
confirmar, y solo LISTO reinicia el ciclo (CLAUDE.md §2).

**Cambiar de modo tiene dos sabores.** Elegirlo (submenú de la bandeja, tarjetas
de MODOS, botón `MODO` del widget) guarda `default_mode`; traer una ventana por
esta vez (`Ajustes` de la bandeja, volver a ejecutar el `.exe`, apartar Foco) no
lo toca. Cuando todo pasaba por el mismo camino, elegir Widget como modo por
defecto y después abrir Ajustes reescribía el archivo con `"foco"`, y la app
arrancaba en Foco para siempre.

Las dos marcas dicen cosas distintas, y cada una es cierta: **la del menú de la
bandeja sigue lo que estás viendo** (se mueve siempre, guarde o no — dejarla en
Foco después de minimizar a Ambiente es una mentira que se ve de un vistazo), y
**la tarjeta de MODOS sigue el archivo**, porque su título dice "modo por
defecto".
