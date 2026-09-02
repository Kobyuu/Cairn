# Handoff: Cairn — set completo (app + sistema web + landing)

## Overview
Cairn es una app de escritorio para Windows (Tauri + React + Tailwind): un temporizador de intervalos que cada X minutos (45 por defecto, configurable) avisa que es hora de una pausa. El ciclo **no** se reinicia solo — vuelve a contar únicamente cuando el usuario confirma que terminó. El caso de uso es tenerla abierta todo el día: no es una app que se usa, es una que está.

Este paquete cierra el diseño de la aplicación y abre el de la web. Contiene: la **decisión de dirección visual**, las **cinco pantallas** de la app (Foco, Rutina expandida, Widget, Ambiente, Ajustes), la **marca**, la **extensión del sistema para web**, el **kit de capturas** y el **mensaje y estructura de la landing**.

## About the Design Files
Los archivos son **referencias de diseño hechas en HTML**: prototipos que muestran apariencia y comportamiento, no código de producción para copiar. La tarea es **recrear los diseños en el entorno real del proyecto** con sus patrones y componentes establecidos. Cada `.dc.html` se abre directamente en el navegador; los cronómetros corren de verdad y los estados son clickeables.

## Fidelity
**Alta fidelidad (hifi)** en las cinco pantallas de la app, la marca y el kit de capturas.
**Especificación (no maqueta)** en `Cairn Sistema Web.dc.html` — es una hoja de tokens, no una página.
**Documento de contenido** en `landing_mensaje_y_estructura.md` — define qué dice la landing; el diseño de la página todavía no existe.

---

## Decisión de dirección visual

Se exploraron tres familias para la pantalla de Foco: **Aliento** (halos que respiran), **Gráfica** (dial de marcas con arco de progreso) y **Estampa** (láminas encuadradas, tinta verde-negra y rojo de estampa).

**La dirección del producto es Aliento.** Razón: es la única de las tres cuyo lenguaje escala a los otros dos modos. El dial de la variante Gráfica no existe en una barra de 3 px, y el rojo de Estampa es demasiado alerta para algo que está encendido ocho horas. Los halos, en cambio, son un ritmo — 5,5 segundos, el de una respiración lenta — que se repite igual en el punto del Widget y en la respiración de la barra de Ambiente. La marca queda con un solo gesto reconocible en todos lados.

**Lo que se rescató de las otras dos:**
- De Estampa, los **marcos de lámina**: se mudaron al panel de rutina, que es donde las imágenes tienen función real (una referencia visual del ejercicio, no decoración).
- De Gráfica, las **marcas de encuadre en las esquinas** y el criterio de tratar el dato como gráfico.
- `Cairn Foco Grafico.dc.html` y `Cairn Foco Estampa.dc.html` quedan en el proyecto como registro; no se implementan.

---

## Screens / Views

### 1. Foco (pantalla completa) — hifi
`Cairn Foco.dc.html`. Aparece al cumplirse el intervalo. El detalle de capas está abajo; el `.dc.html` es la fuente de verdad medida.

Contenedor `100vw × 100vh`, todo centrado. Capas de fondo concéntricas: wash de 900 px (`radial-gradient`, animación `wash` 11 s), tres halos de 660 / 520 / 400 px con bordes al 13 / 10 / 8 % y animación `halo` 5,5 s desfasada 0 / 0,7 / 1,4 s, un arco de acento de 212 px que gira en 45 s, grano de 3 px al 50 % y viñeta radial. Cuatro escuadras de 9 px en las esquinas, a 34 / 44 px de los bordes.

Contenido: etiqueta de rutina arriba (Mono 10 px, `.34em`, 38 %, entre dos hairlines de 56 px), sobre-línea `llevás en pausa` (Newsreader italic 19 px, 52 %), **cronómetro ascendente** (Newsreader 300, 196 px, `tabular-nums`, `mm:ss`), marca de respiración (punto de 5 px en acento + `INHALAR · EXHALAR`), y la fila de botones a 76 px: `LISTO` en pastilla sólida de acento, la pastilla partida `posponer 5` + `▾`, y `ver rutina`. Pista al pie: `mantené posponer para elegir los minutos`.

### 2. Rutina expandida — hifi
`Cairn Rutina.dc.html`. El panel dentro de Foco, con sus dos estados y la transición. **Colapsado por defecto.**

**Transición colapsado → abierto** (450 ms, `cubic-bezier(.4,0,.2,1)`, todas las propiedades a la vez):
- El cronómetro pasa de **196 px a 68 px** y sube al encabezado; el halo se mueve de `top:50%` a `top:22%`.
- La marca `INHALAR · EXHALAR` va a opacidad 0 en 300 ms (el ritmo sigue en el halo, no hace falta nombrarlo).
- El panel entra con opacidad 0 → 1 en 350 ms y `top` de 300 px a 216 px.
- El botón `ver rutina` cambia a `ocultar rutina` y toma el borde y el color del acento.
- La fila de botones **no se mueve**: `LISTO` está en el mismo píxel abierto y cerrado. Es la única acción que no debe reubicarse nunca.

**Panel:** 860 px de ancho (`max-width: calc(100vw - 160px)`), `bottom:150px`. Encabezado con `RUTINA`, contador `N DE 5 HECHAS`, y a la derecha los botones de estado.

**Estado lectura** (cómodo de seguir mientras te movés):
- Títulos de sección: Mono 14 px, `letter-spacing:.26em`, mayúsculas, tinta al 40 %.
- Ítems: Newsreader 300 a **27 px**, `line-height:1.5`, con casilla de **26 × 26 px** (borde 1 px al 26 %; al marcar, se rellena de acento y muestra `✓` en color de fondo). El ítem completo es el área clickeable; al marcarlo el texto baja al 34 % y toma `line-through`.
- Cita (`>` en markdown): Newsreader italic 20 px al 46 %, con borde izquierdo de 1 px al 16 % y 44 px de padding.
- Imágenes: marco de lámina — borde 1 px al 30 %, padding 9 px, fondo de la tinta al 4 %, borde interior al 14 %, y pie con `LÁMINA I` + sección en Mono 9 px `.24em`. Es lo que se rescató de la dirección Estampa. Ancho 290 px, a la derecha del primer bloque.
- Scroll interno con `overflow:auto`; el encabezado y los botones quedan fijos.

**Estado edición** (mismo ancho, sin reflow del resto):
- Caja de 1 px al 16 % con fondo de la tinta al 3 %. Canaleta de números de línea de 52 px, separada por 1 px al 12 %, cifras al 22 %.
- Fuente markdown en Mono 15 px, `line-height:2.1`, `caret-color` de acento. Sin resaltado de sintaxis: el documento es corto y el resaltado agrega ruido.
- Pie de ayuda: `MARKDOWN · # TÍTULO · - LISTA · - [ ] CASILLA · **NEGRITA**` y `CTRL+S GUARDAR · ESC CANCELAR`.
- Botones: `GUARDAR` en acento sólido, `CANCELAR` en pastilla al 46 %. La transición lectura ↔ edición es un cambio de contenido sin animación de layout: el encabezado y el ancho no se mueven, así que el ojo no pierde el lugar.

**Pensado para crecer** (el futuro espacio de notas y tareas): el panel ya es un documento con scroll propio, ancho fijo y encabezado con metadatos. Para estirarlo hacia varios documentos sólo hace falta agregar una columna de navegación de ~220 px a la izquierda del panel, sin tocar el resto: el ancho de lectura (860 px) y el árbol de estilos del markdown quedan iguales. **No** meter tabs arriba: rompe el encabezado y compite con la fila de botones de Foco.

### 3. Widget — hifi
`Cairn Widget y Ambiente.dc.html`, bloque 6a. Ver `design_handoff_cairn_widget_ambiente` para el detalle. Resumen: 176 × 68 px, radio 5, fondo del tema al 62 % con blur 14 px, borde al 10 %. Minutos restantes en Newsreader 300 a 38 px + etiqueta `MIN / RESTANTES` en Mono 9 px. Hairline de progreso de 2 px al pie. Estados: reposo, hover (fondo 82 %, aparecen pausar y `MODO` en cajas de 30 px), arrastre (`scale(.96) rotate(-.6deg)`, borde punteado, sin hairline), pausado (cifra al 40 %, hairline gris), último 10 % (borde de acento, hairline de 3 px, punto que respira).

### 4. Ambiente — hifi
Mismo archivo, bloque 6b. Barra al borde superior, ancho completo, **3 px** todo el ciclo y **5 px** en el último 10 %, `pointer-events:none`, sin texto. Avance en pasos de 1 % sin easing. Dos tintas propias según el fondo: `oklch(0.82 0.06 150)` sobre oscuro, `oklch(0.42 0.05 150)` sobre claro, con opacidad que sube del 40 % al 90 % junto con el avance. En el último 10 % respira con `breathe` 5,5 s. En pausa: ancho congelado y opacidad al 18 %, sin animación.

### 5. Ajustes — hifi
`Cairn Ajustes.dc.html`. Ventana con scroll, columna de 720 px centrada, `max-width: calc(100vw - 96px)`, padding 64 px arriba.

Encabezado: el mojón de la marca a tamaño chico + `Ajustes` en Newsreader 300 a 44 px + versión a la derecha. Divisor de 1 px al 14 %.

Secciones, separadas por títulos en Mono 10 px `.3em` al 38 % con 48 px de aire arriba:
| Sección | Filas |
|---|---|
| CICLO | **Duración del intervalo**: chips de 25 / 45 / 60 / 90 + campo numérico libre con sufijo `MIN`. **Posponer rápido**: chips de 2 / 5 / 10 / 15. |
| MODOS | **Modo por defecto**: tres tarjetas iguales (Ambiente / Widget / Foco), cada una con un diagrama de 64 × 40 px que muestra dónde aparece cada modo, título y una línea de descripción. Seleccionada: borde de acento y fondo de acento al 12 %. |
| RUTINA | Nombre del documento, metadatos (`5 pasos · markdown · editado hace 3 días`) y dos acciones: `EDITAR` y `ABRIR CARPETA`. |
| APARIENCIA | **Tema**: chips Sistema / Claro / Oscuro. La nota aclara que Ambiente elige su tinta según el fondo de cada ventana, independientemente de esto. |
| SISTEMA | Dos interruptores de 52 × 26 px: **Iniciar con Windows** (encendido por defecto) y **Sonido al avisar** (apagado por defecto). |

Cada fila es título en Newsreader 300 a 23 px + descripción en Mono 11 px al 42 %, con el control alineado a la derecha. Divisores de 1 px al 10 % sólo dentro de una sección, nunca entre título y primera fila. Al pie: `LOS AJUSTES SE GUARDAN AL INSTANTE` y `RESTABLECER TODO`. **No hay botón de aceptar ni de cancelar.**

Chips: `padding:9px 15px`, sin radio, borde al 18 %; activo con fondo de acento y texto en color de fondo. Interruptores: pastilla de 999, borde al 22 % (acento si está activo), pista de acento al 22 %, punto de 18 px.

---

## Sistema para web
`Cairn Sistema Web.dc.html`. Extiende los tres tokens de la app con lo que una página de venta necesita.

- **Base:** tinta `#E9E4D8`, fondo `#0B0C0B`, acento `oklch(0.76 0.05 150)`.
- **Superficies:** `rgba(233,228,216,.03)` y `.06`; líneas al `.12` y `.20`; papel `#EFECE3`.
- **Estados:** `acento-hover oklch(0.82 0.055 150)`, `acento-activo oklch(0.70 0.05 150)`, `acento-tenue oklch(0.76 0.05 150 / .35)`, `error oklch(0.62 0.13 32)`, `error-texto oklch(0.72 0.12 32)`, `exito oklch(0.68 0.09 150)`. El acento se mueve en luminosidad, nunca en tono.
- **Escala tipográfica**, siete pasos: Display 84/1.02, H1 56/1.08, H2 34/1.2, H3 26/1.25, Cuerpo 17/1.75, Cuerpo S 13/1.9 (Mono), Etiqueta 10 con `.3em` (Mono). Newsreader 300 para frases, IBM Plex Mono 400 para datos. **Nada en negrita.**
- **Componentes:** botones (radio 999, alto 44, foco con outline de 2 px al 35 % y offset 3), campos (sin radio, borde 18 % → acento 55 % en foco → error 60 %), tarjeta de razón (borde 12 %, fondo 3 %, padding 24, sin sombra), caja de precio.
- **Grilla:** ancho máximo 1240, texto máximo 680, 12 columnas, gutter 24, margen 64 (24 en móvil), 160 px de aire entre secciones (96 en móvil). Espaciado: 4 · 8 · 12 · 16 · 24 · 40 · 64 · 96 · 160.
- **Movimiento:** la respiración de 5,5 s es el único ritmo de la marca. Entradas con opacidad y 12 px de subida en 500 ms; hover en 150 ms y sólo de color. Prohibido: parallax, contadores animados, carruseles automáticos.

## Kit de capturas
`Cairn Kit Capturas.dc.html`. Tres encuadres, uno por modo, con el mismo fondo, sombra y borde para que se lean como serie.

- **Marco A — Foco:** ventana de 900 px 16:10, radio 8, borde al 10 %, sombra `0 40px 90px rgba(0,0,0,.55)` + `0 4px 12px rgba(0,0,0,.4)`, sobre fondo `linear-gradient(160deg,#15181A,#0E100F,#131110)` con 64 px de aire.
- **Marco B — Widget:** recorte de escritorio, no marco completo. El widget siempre **sobre una ventana ajena** (nunca fondo plano), en la esquina inferior derecha a 44 px de los bordes. Lo que se vende es que no molesta, y eso sólo se ve en contexto.
- **Marco C — Ambiente:** tres tiras de 104 px en secuencia vertical (18 % sobre oscuro, 62 % sobre claro, 93 % respirando), separadas 12 px. **La barra se muestra a su grosor real; si no se ve, se agranda el encuadre, nunca la barra.**
- Reglas generales: PNG a 2× / WebP en producción, siempre el tema oscuro, y **los mismos números en toda la web** (`01:24` en Foco, `27 min` en el Widget). Nunca marcos de macOS, manos sosteniendo pantallas, ni perspectiva 3D.

## Landing
`landing_mensaje_y_estructura.md`. Promesa, las tres razones, estructura de ocho secciones con el material asignado a cada una, precio (licencia única US$ 18, argumentado), cinco preguntas frecuentes, reglas de tono (voseo, sin exclamaciones, lista de frases prohibidas), metadatos y OG image, y qué queda afuera. **El diseño de la página todavía no existe** — este documento es su brief.

---

## Interactions & Behavior (transversal)
- **LISTO** es la única acción que reinicia el ciclo (`cycleStartedAt = now`).
- **Posponer**: rápido con un click (5 min por defecto), arbitrario desde el `▾` o manteniendo presionado — `cycleStartedAt = now - (intervalMinutes - n)`.
- **Cambio de modo** (Foco / Widget / Ambiente) nunca altera el ciclo: los tres leen el mismo `cycleStartedAt`.
- **Animaciones**, todas CSS: `halo` (`scale .9→1.08`, `opacity .28→.62`, 5,5 s), `wash` (11 s), `turn` (45 s lineal), `breathe` (`opacity .5→1`, 5,5 s). Hover en 150 ms.
- **`prefers-reduced-motion`**: congelar halos, wash, arco y respiración en su estado medio. El ancho y el grosor de Ambiente no se tocan: son información, no decoración.
- **Multi-monitor**: Ambiente en el monitor principal. Recomendación: no replicar, para no duplicar el estímulo.

## State Management
- `intervalMinutes` (45), `quickSnoozeMinutes` (5), `mode` (`foco`|`widget`|`ambiente`), `theme` (`sistema`|`claro`|`oscuro`), `startWithWindows` (true), `soundOnAlert` (false).
- `cycleStartedAt` → única fuente de progreso (ancho de Ambiente, minutos del Widget).
- `focusShownAt` → cronómetro ascendente de Foco.
- `paused` (bool), `widgetPosition` ({x,y}, persistido).
- `routineMarkdown` (string), `routineView` (`colapsado`|`lectura`|`edicion`), `routineDone` (mapa de ítems marcados; se limpia al confirmar `LISTO`).
- `snoozeMenuOpen` (bool), `pauseCountToday` (int).
- Derivados: `progress`, `minutesLeft = ceil((1-progress) * intervalMinutes)`, `isFinalTenth = progress >= 0.9`.

## Design Tokens (app)
Oscuro: `bg #0b0c0b` · `fg #e9e4d8` · `ac oklch(0.76 0.05 150)`
Claro: `bg #efece3` · `fg #1a1c19` · `ac oklch(0.5 0.05 150)`
Ambiente: `oklch(0.82 0.06 150)` sobre oscuro, `oklch(0.42 0.05 150)` sobre claro.

Los grises son `color-mix(in oklab, <fg> N%, transparent)`. **No usar `currentColor` dentro de `color-mix`**: no resuelve contra un `color` seteado en línea y rompe el tema claro.

Tipografía: **Newsreader** 300 (cifras y frases, siempre `font-variant-numeric: tabular-nums` en números) e **IBM Plex Mono** 400 (etiquetas). Empaquetar ambas locales en el build de Tauri.

## Assets
La app no usa imágenes ni iconos: todo es tipografía, gradientes y bordes. Excepciones: el ícono de pausa del Widget (dos rectángulos), los glifos `▾ · ✓` de la tipografía, y las láminas del panel de rutina, que son **contenido del usuario** (arrastra sus propias imágenes al marco).

La marca está en `logo/`: `cairn.ico` (16→256), el mojón en SVG y PNG de 16 a 1024, y en `logo/logotipo/` el logotipo y los lockups horizontal y vertical, en cuatro variantes (claro, oscuro, mono blanco, mono negro). `logo/LEEME.md` tiene las reglas de resguardo y tamaños mínimos.

## Pendientes
- **Diseño de la landing** (el brief está listo; falta la página).
- **Diagrama del ciclo** para la sección 3 de la landing.
- **Capturas del panel de rutina** en marco A recortado, para la sección 4.
- Instalador, página de descarga, correo de bienvenida.

## Files
| Archivo | Qué es |
|---|---|
| `Cairn Foco.dc.html` | Pantalla de Foco. Dirección aprobada. |
| `Cairn Rutina.dc.html` | Panel de rutina: colapsado, lectura y edición, con la transición. Interactivo. |
| `Cairn Widget y Ambiente.dc.html` | Los dos modos de fondo, todos sus estados, sobre escritorio claro y oscuro. |
| `Cairn Ajustes.dc.html` | Ventana de ajustes. Interactiva. |
| `Cairn Sistema Web.dc.html` | Hoja de tokens, escala tipográfica, componentes y grilla para la web. |
| `Cairn Kit Capturas.dc.html` | Los tres encuadres para mostrar la app. |
| `landing_mensaje_y_estructura.md` | Mensaje, estructura, precio y tono de la landing. |
| `Cairn Foco Grafico.dc.html`, `Cairn Foco Estampa.dc.html` | Direcciones descartadas. Registro, no implementar. |
| `logo/` | Marca completa: icono, mojón, logotipo, lockups y reglas. |
| `image-slot.js`, `support.js` | Runtime para abrir los prototipos en el navegador. No son parte del diseño. |
