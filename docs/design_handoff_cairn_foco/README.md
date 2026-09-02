# Handoff: Cairn — pantalla de Foco, dirección "Gráfica" (dial)

## Overview
Cairn es una app de escritorio para Windows (Tauri + React + Tailwind): un temporizador de intervalos que cada X minutos (45 por defecto, configurable) avisa que es hora de una pausa. El ciclo **no** se reinicia solo: vuelve a contar únicamente cuando el usuario confirma que terminó.

Este handoff cubre la **pantalla de Foco** en la variante *Gráfica*: la misma paleta y la misma calma que la dirección "Aliento", pero construida como una pieza gráfica — un dial de marcas concéntricas con arco de progreso, grilla de encuadre y una cifra de contorno gigante como fondo. Es la opción a implementar si se quiere que la pausa se lea como un instrumento y no como un texto.

## About the Design Files
Los archivos de este paquete son **referencias de diseño hechas en HTML**: prototipos que muestran apariencia y comportamiento, no código de producción para copiar. La tarea es **recrear el diseño en el entorno real del proyecto** (Tauri + React + Tailwind) con sus patrones y componentes establecidos. `Cairn Foco Grafico.dc.html` se abre directamente en el navegador y es la fuente de verdad visual y de animación: el cronómetro corre de verdad y el arco de progreso avanza con los segundos.

## Fidelity
**Alta fidelidad (hifi).** Colores, tipografía, tamaños, posiciones, estados hover y animaciones son finales y deben recrearse fielmente. Sólo el contenido es de muestra (nombre de rutina, número de pausa, minutos del posponer rápido).

## Screens / Views

### Foco (pantalla completa) — hifi
**Purpose:** avisar que se cumplió el intervalo y ofrecer tres acciones: confirmar (reinicia el ciclo), posponer, ver la rutina. Ocupa la pantalla entera; el diseño compensa esa agresividad con contraste bajo en todo lo secundario, una única tinta de acento y movimiento lentísimo.

**Layout:** contenedor único `100vw × 100vh`, `position:relative`, `overflow:hidden`, `display:flex; align-items:center; justify-content:center`. El dial es el único elemento en el flujo y queda centrado; todo lo demás está posicionado en absoluto contra los bordes. Medido a 1120 × 700; el dial de 620 px es el que define el mínimo razonable de ventana (~1000 × 780 para que respire; ver *Responsive*).

**Capas de fondo:**
1. Grano: `position:absolute; inset:0`, `background-image:radial-gradient(circle, color-mix(in oklab, <fg> 10%, transparent) .6px, transparent .6px)`, `background-size:3px 3px`, `opacity:.45`, `pointer-events:none`.
2. Grilla de encuadre: cuatro hairlines de 1 px al 10 % de `<fg>`, a **96 px** de cada borde (dos verticales de alto completo, dos horizontales de ancho completo).
3. Cifra de contorno: el número de pausa del día (`06`) en Newsreader 300 a **420 px**, `line-height:.8`, `color:transparent`, `-webkit-text-stroke:1px color-mix(in oklab, <fg> 14%, transparent)`, anclada `right:60px; bottom:-90px` — se sale del borde inferior a propósito. `pointer-events:none; user-select:none`.

**Dial (620 × 620 px, centrado, `position:relative`):**
| Capa | Especificación |
|---|---|
| Anillo de marcas | `inset:0`, `border-radius:50%`. Fondo `repeating-conic-gradient(from -0.25deg, color-mix(in oklab, <fg> 26%, transparent) 0 0.5deg, transparent 0.5deg 6deg)` → 60 marcas de 0,5°. Recortado a anillo con `mask:radial-gradient(circle, transparent 0 289px, #000 289px)` (y el prefijo `-webkit-mask`), o sea 21 px de grosor. |
| Arco de progreso | `inset:26px`, `border-radius:50%`. Fondo `conic-gradient(<ac> 0 Ndeg, color-mix(in oklab, <fg> 8%, transparent) Ndeg 360deg)` donde `N = (segundos % 60) / 60 × 360`. Máscara `radial-gradient(circle, transparent 0 279px, #000 279px)` → anillo de 5 px. Animación `grow` 5,5 s `ease-in-out infinite alternate`. |
| Aro interior | `inset:52px`, `border-radius:50%`, `border:1px solid color-mix(in oklab, <fg> 9%, transparent)`. |
| Aro de acento | mismo `inset:52px`, sólo `border-top:1px solid color-mix(in oklab, <ac> 45%, transparent)`, animación `spin` 45 s lineal infinita (una vuelta completa por ciclo visual). |

**Contenido del centro del dial** (columna centrada, `position:relative` para quedar sobre las máscaras):
- `EN PAUSA` — IBM Plex Mono 10 px, `letter-spacing:.34em`, `<fg>` 34 %.
- **Cronómetro** — Newsreader 300, **150 px**, `line-height:1`, `letter-spacing:-.03em`, `font-variant-numeric:tabular-nums`, `<fg>` puro, `margin-top:10px`. Formato `mm:ss`, cuenta hacia arriba desde que apareció la pantalla.
- Hairline 64 × 1 px al 20 %, `margin-top:22px`.
- `tomate el tiempo que necesites` — Newsreader italic 300, 17 px, `<fg>` 46 %, `margin-top:20px`.

**Elementos de borde:**
| Elemento | Especificación |
|---|---|
| Estado, arriba centrado | `top:56px`. Cuadrado de 6 px en `<ac>` con animación `pulse` 5,5 s + texto `INTERVALO CUMPLIDO` en Mono 10 px, `letter-spacing:.34em`, `<fg>` 34 %, `gap:14px`. |
| Rutina, margen izquierdo | `left:52px; top:50%`, `transform:translateY(-50%) rotate(180deg)`, `writing-mode:vertical-rl`. Mono 11 px, `letter-spacing:.4em`, `<fg>` 40 %. Texto: `CORRECCIÓN DE POSTURA` (lee de abajo hacia arriba). |
| Datos del ciclo, margen derecho | `right:52px; top:50%`, `translateY(-50%)`, `writing-mode:vertical-rl`. Mono 11 px, `.4em`, `<fg>` 26 %. Texto: `CICLO 45 MIN · PAUSA 6`. |
| Interruptor de tema | Cuadrado de 14 px, `top:52px; right:52px`, borde 1 px `<fg>` 30 %; hover rellena al 30 %. En el producto real vive en Ajustes; acá está a mano para revisar ambos temas. |
| Pista inferior | `bottom:52px`, centrada, Mono 10 px, `letter-spacing:.24em`, `<fg>` 24 %: `MANTENÉ POSPONER PARA ELEGIR LOS MINUTOS`. |

**Barra de controles** (`bottom:96px`, centrada, una sola caja segmentada, `border:1px solid <fg> 18%`, fondo `color-mix(in oklab, <bg> 70%, transparent)`, Mono 12 px, sin radio):
| Segmento | Especificación | Acción |
|---|---|---|
| `LISTO` | `padding:15px 40px`, fondo `<ac>`, texto `<bg>`, `letter-spacing:.16em`. Hover `filter:brightness(1.1)`. | Cierra Foco y reinicia el ciclo. |
| `POSPONER 5` | `padding:15px 22px`, `border-left:1px solid <fg> 18%`, color `<fg>` 66 %, `letter-spacing:.08em`. Hover fondo `<fg>` 8 %. | Posterga los minutos del posponer rápido (5 por defecto, configurable). |
| `▾` | `padding:15px 14px`, `border-left` igual, color `<fg>` 40 %, 9 px. Hover igual. | Abre menú: 10 / 15 / 30 min y campo numérico para minutos arbitrarios. También accesible manteniendo presionado `POSPONER 5`. |
| `VER RUTINA` | `padding:15px 22px`, `border-left` igual, color `<fg>` 66 %, `.08em`. Hover igual. | Expande el panel de rutina; colapsado por defecto. |

## Interactions & Behavior
- **LISTO** → cierra Foco, `cycleStartedAt = now`. Es la única acción que reinicia el ciclo.
- **POSPONER 5** → cierra Foco y vuelve a avisar en `quickSnoozeMinutes`.
- **▾ / mantener presionado POSPONER** → menú con valores fijos + minutos arbitrarios. El menú debe abrir hacia arriba, alineado al segmento, con el mismo borde y fondo de la barra (sin radio, sin sombra).
- **VER RUTINA** → expande el panel de rutina (markdown, en lectura por defecto). Pendiente de diseño; ver la sección de pantallas faltantes.
- **Cronómetro** → arranca en 0 al aparecer la pantalla, cuenta hacia arriba, `mm:ss`.
- **Arco de progreso** → recorre 360° por minuto (marca los segundos de la pausa, no el ciclo de trabajo). Actualizar una vez por segundo, sin transición: el salto de 6° por segundo coincide con el paso de las marcas.
- **Animaciones** (todo CSS, sin motor gráfico):
  - `spin`: `rotate(0deg)` → `rotate(360deg)`, 45 s lineal infinita.
  - `pulse`: `0%,100% { opacity:.35 } 50% { opacity:.9 }`, 5,5 s `ease-in-out infinite`.
  - `grow`: `0% { transform:scale(.985) } 100% { transform:scale(1.015) }`, 5,5 s `ease-in-out infinite alternate` — la respiración del dial, mismo período que la dirección Aliento.
  - Hover: sin transición declarada; agregar `transition: background .15s ease, filter .15s ease` si el equipo lo prefiere.
- **`prefers-reduced-motion`**: congelar `spin`, `pulse` y `grow` en su estado medio; el arco sigue actualizándose (es información, no decoración).
- **Responsive:** el dial es de tamaño fijo. Por debajo de ~1000 px de ancho o ~780 px de alto conviene escalar todo el bloque central con `transform: scale()` desde el centro, o reducir el dial a 460 px con el cronómetro a 112 px. No reflowear: la composición depende de que el dial esté centrado y la grilla a 96 px.

## State Management
- `intervalMinutes` (45), `quickSnoozeMinutes` (5), `mode` (`foco` | `widget` | `ambiente`), `theme` (`oscuro` | `claro`), `startWithWindows` (bool).
- `cycleStartedAt` → progreso de Ambiente y tiempo restante del Widget.
- `focusShownAt` → cronómetro ascendente y ángulo del arco (`(elapsedSec % 60) / 60 × 360`).
- `paused` (bool) → congela el ciclo.
- `routineMarkdown` (string), `routineExpanded` (bool), `snoozeMenuOpen` (bool).
- `pauseCountToday` (int) → alimenta la cifra de contorno del fondo y el margen derecho.
- Transiciones: intervalo cumplido → mostrar Foco; LISTO → `cycleStartedAt = now` y cerrar; posponer(n) → `cycleStartedAt = now - (intervalMinutes - n)` y cerrar. El ciclo nunca se reinicia por sí mismo.

## Design Tokens
Tema oscuro (por defecto):
- `bg` `#0b0c0b`
- `fg` `#e9e4d8`
- `ac` `oklch(0.76 0.05 150)`

Tema claro:
- `bg` `#efece3`
- `fg` `#1a1c19`
- `ac` `oklch(0.5 0.05 150)`

Los grises intermedios no son colores nuevos: son `color-mix(in oklab, <fg> N%, transparent)` con N ∈ {8, 9, 10, 14, 18, 20, 24, 26, 30, 34, 40, 46, 66}. En Tailwind: variables CSS (`--fg`, `--bg`, `--ac`) + utilidades arbitrarias, o esas 13 mezclas declaradas como tokens. **No usar `currentColor` dentro de `color-mix`**: no resuelve contra un `color` seteado en línea y rompe el tema claro.

Tipografía:
- Display / cifras: **Newsreader** 300 (300 italic para las notas). Tamaños usados: 420 (contorno) / 150 / 17 px.
- Etiquetas y controles: **IBM Plex Mono** 400. Tamaños: 12 / 11 / 10 / 9 px; `letter-spacing` .08 / .16 / .24 / .34 / .4em.
- Cifras siempre con `font-variant-numeric: tabular-nums`.

Geometría: dial 620 px; anillo de marcas 21 px de grosor (máscara a 289 px); arco 5 px (máscara a 279 px, `inset:26px`); aros interiores `inset:52px`. Radios: `50%` en el dial, `0` en todo lo demás. Sin sombras.
Espaciados usados: 10 / 14 / 20 / 22 / 26 / 40 / 52 / 56 / 60 / 96 px.

## Assets
Ninguno. Sin imágenes, sin iconos, sin ilustraciones: tipografía, gradientes cónicos, máscaras radiales y bordes. Los únicos glifos son `▾` y `·`, de la tipografía. Fuentes Newsreader e IBM Plex Mono desde Google Fonts — empaquetarlas locales en el build de Tauri para que funcione sin conexión.

## Pantallas faltantes
No están diseñadas todavía: **Rutina expandida** (markdown editable, estados lectura y edición, a futuro crece hacia notas y tareas), **Widget** (ventana chica sin bordes, siempre encima, arrastrable, transparente), **Ambiente** (barra de 3–5 px pegada al borde superior, sin texto) y **Ajustes**. Los tokens y el vocabulario de este documento son la base para hacerlas. Para Widget y Ambiente hay bocetos en la dirección Aliento (`design_handoff_cairn_foco`).

## Files
- `Cairn Foco Grafico.dc.html` — esta pantalla, a pantalla completa, ambos temas, cronómetro y arco reales. Fuente de verdad.
- `Cairn Foco.dc.html` — la otra opción de Foco (dirección "Aliento", halos que respiran), para comparar.
- `Cairn Direcciones.dc.html` — el recorrido de exploración completo: turno 3 es Aliento, turno 2 y 1 las direcciones descartadas.
- `support.js` — runtime necesario para abrir los `.dc.html` en el navegador. No es parte del diseño.
