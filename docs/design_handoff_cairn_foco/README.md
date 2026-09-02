# Handoff: Cairn — pantalla de Foco (dirección "Aliento")

## Overview
Cairn es una app de escritorio para Windows (Tauri + React + Tailwind): un temporizador de intervalos que cada X minutos (45 por defecto) avisa que es hora de una pausa. El ciclo **no** se reinicia solo — vuelve a contar únicamente cuando el usuario confirma que terminó.

Este handoff cubre la **dirección visual aprobada ("Aliento")** y la **pantalla de Foco** (el aviso a pantalla completa) ya resuelta a alta fidelidad, más los bocetos de Widget y Ambiente que se derivan de ella. Las pantallas restantes (Rutina expandida, Widget final, Ambiente final, Ajustes) todavía no están diseñadas; los tokens y el vocabulario visual de este documento son la base para hacerlas.

## About the Design Files
Los archivos de este paquete son **referencias de diseño hechas en HTML**: prototipos que muestran la apariencia y el comportamiento buscados, no código de producción para copiar. La tarea es **recrear estos diseños en el entorno real del proyecto** (Tauri + React + Tailwind), usando sus patrones y componentes establecidos. Los archivos `.dc.html` se abren directamente en el navegador y sirven como fuente de verdad visual y de animación.

## Fidelity
**Alta fidelidad (hifi)** para la pantalla de Foco: colores, tipografía, tamaños, espaciados, estados hover y animaciones son finales y deben recrearse fielmente.
**Baja fidelidad (lofi)** para Widget y Ambiente: son maquetas de intención (proporción, color, comportamiento) dentro de paneles de muestra, no pantallas terminadas.

## Screens / Views

### 1. Foco (pantalla completa) — hifi
**Purpose:** avisar que se cumplió el intervalo y permitir tres acciones: confirmar (reinicia el ciclo), posponer, o ver la rutina. Aparece a pantalla completa; el diseño compensa esa agresividad con aire, contraste bajo en los elementos secundarios y una animación de respiración lenta.

**Layout:** un único contenedor `100vw × 100vh`, `display:flex; flex-direction:column; align-items:center; justify-content:center`. Referencia medida a 1120 × 700. Todo lo secundario está posicionado en absoluto contra los bordes; el bloque central (cronómetro) y la fila de botones son los únicos elementos en el flujo.

**Capas de fondo (todas centradas, `position:absolute`, `pointer-events:none`):**
1. Wash: 900 × 900 px, `border-radius:50%`, `radial-gradient(circle, color-mix(in oklab, <fg> 9%, transparent) 0%, transparent 62%)`, animación `wash` 11 s.
2. Halo exterior: 660 × 660, `border:1px solid color-mix(in oklab, <fg> 13%, transparent)`, animación `halo` 5,5 s, delay 0 s.
3. Halo medio: 520 × 520, borde al 10 %, `halo` 5,5 s, delay 0,7 s.
4. Halo interior: 400 × 400, borde al 8 %, `halo` 5,5 s, delay 1,4 s.
5. Arco de acento: 212 × 212, sólo `border-top:1px solid color-mix(in oklab, <ac> 55%, transparent)`, rotación lineal 45 s (una vuelta).
6. Grano: `inset:0`, `background-image:radial-gradient(circle, color-mix(in oklab, <fg> 12%, transparent) .6px, transparent .6px)`, `background-size:3px 3px`, `opacity:.5`.
7. Viñeta: `inset:0`, `radial-gradient(ellipse at center, transparent 42%, color-mix(in oklab, <bg> 82%, transparent) 100%)`.

**Marcas de encuadre:** cuatro escuadras de 9 × 9 px en las esquinas, a 34 px del borde vertical y 44 px del horizontal, un solo borde de 1 px al 25 % de `<fg>` en los dos lados que forman la escuadra.

**Componentes:**

| Elemento | Especificación |
|---|---|
| Etiqueta de rutina | Arriba centrada, `top:46px`. IBM Plex Mono 10 px, `letter-spacing:.34em`, mayúsculas, color `<fg>` 38 %. Flanqueada por dos hairlines de 56 × 1 px al 22 %, `gap:18px`. Texto: `CORRECCIÓN DE POSTURA` (nombre de la rutina activa). |
| Sobre-línea | Newsreader italic 300, 19 px, `<fg>` 52 %. Texto: `llevás en pausa`. |
| Cronómetro | Newsreader 300, **196 px**, `line-height:.92`, `letter-spacing:-.025em`, `font-variant-numeric:tabular-nums`, color `<fg>` puro, `margin-top:6px`. Formato `mm:ss`, cuenta **hacia arriba** desde que apareció la pantalla. |
| Marca de respiración | 20 px debajo del cronómetro. Punto de 5 px, `border-radius:50%`, fondo `<ac>`, animación `breathe` 5,5 s. Junto a él IBM Plex Mono 10 px, `letter-spacing:.3em`, `<fg>` 34 %: `INHALAR · EXHALAR`. `gap:14px`. |
| Fila de botones | `margin-top:76px`, `display:flex; gap:12px`, IBM Plex Mono 12 px. |
| Botón `LISTO` | `padding:12px 34px`, `border-radius:999px`, fondo `<ac>`, texto `<bg>`, `letter-spacing:.14em`. Hover: `filter:brightness(1.1)`. Acción: reinicia el ciclo. |
| Grupo `posponer 5` + `▾` | Pastilla partida: borde 1 px `<fg>` 20 %, `border-radius:999px`, `overflow:hidden`, texto `<fg>` 66 %. Segmento izquierdo `padding:12px 18px`, `letter-spacing:.06em`; separador de 1 px al 20 %; segmento derecho `padding:12px 13px`, glifo `▾` a 9 px. Hover por segmento: fondo `<fg>` 8 %. Click izquierdo = posponer los minutos del posponer rápido (5 por defecto, configurable). Click en `▾` = menú con 10 / 15 / 30 y un campo numérico para minutos arbitrarios. |
| Botón `ver rutina` | Pastilla completa, `padding:12px 20px`, mismo borde/color/hover que el grupo anterior. Expande el panel de rutina; colapsado por defecto. |
| Pista inferior | `bottom:52px`, centrada, Newsreader italic 14 px, `<fg>` 30 %: `mantené posponer para elegir los minutos`. |
| Interruptor de tema | Círculo de 11 px, `top:40px; right:78px`, borde 1 px `<fg>` 30 %; hover rellena al 30 %. En el producto real esto vive en Ajustes; en el prototipo está a mano para revisar ambos temas. |

### 2. Widget — lofi
Ventana chica sin bordes, siempre encima, arrastrable, con fondo transparente real. Maqueta: 320 × 120 px, `border-radius:4px`, mismo `<bg>`/`<fg>`, un solo halo de 210 px animado `halo` 5,5 s y la capa de grano al 45 %. Contenido: minutos restantes en Newsreader 300 a 52 px (`letter-spacing:-.02em`) y, a la derecha, IBM Plex Mono 9 px `letter-spacing:.24em` `line-height:1.9` al 42 %: `MIN / RESTANTES`. Al pasar el mouse deben aparecer dos controles mínimos (pausar, cambiar de modo) en el mismo estilo de pastilla de Foco; en arrastre el marco se reduce a una hairline. Pendiente de diseño final.

### 3. Ambiente — lofi
Sin ventana: una barra pegada al borde superior de la pantalla, todo el ancho, sin texto.
- Estado normal: **3 px** de alto, color de tinta del tema al 50 % de opacidad, ancho = porcentaje de ciclo transcurrido. Avance en pasos de 1 %, sin easing.
- Último 10 %: pasa a **5 px** y respira con la misma curva y período que los halos de Foco (`breathe`, 5,5 s), con la opacidad hacia arriba (0,85 pico).
- Debe leerse sobre fondos claros y oscuros: sobre claro usa la tinta oscura (`oklch(0.5 0.05 150 / .5)`), sobre oscuro el verde claro (`oklch(0.82 0.06 150 / .85)`).
- Pausa (ciclo detenido): pendiente de definir; la intención es congelar el ancho y bajar la opacidad, sin animación.

### 4. Rutina expandida, Ajustes
No diseñadas todavía. La rutina es un documento markdown editable por el usuario (títulos, listas, listas con casilla, negritas) con dos estados, lectura y edición, y a futuro crece hacia notas y tareas. Ajustes cubre duración del intervalo, modo por defecto, duración del posponer rápido, editar la rutina, iniciar con Windows y tema.

## Interactions & Behavior
- **LISTO** → cierra Foco y reinicia el contador de intervalo desde cero. Es la única acción que reinicia el ciclo.
- **posponer 5** → cierra Foco y vuelve a avisar en la duración del posponer rápido.
- **▾ / mantener presionado** → menú con opciones fijas y entrada de minutos arbitrarios.
- **ver rutina** → expande el panel de rutina dentro de Foco (colapsado por defecto).
- **Cronómetro** → arranca en 0 al aparecer la pantalla y cuenta hacia arriba en segundos, `mm:ss`.
- **Animaciones** (todas CSS, sin motor gráfico):
  - `halo`: `0%,100% { transform:scale(.9); opacity:.28 } 50% { transform:scale(1.08); opacity:.62 }`, 5,5 s `ease-in-out infinite`, delays 0 / 0,7 / 1,4 s.
  - `wash`: `0%,100% { transform:scale(1); opacity:.5 } 50% { transform:scale(1.14); opacity:.85 }`, 11 s `ease-in-out infinite`.
  - `turn`: rotación 0→360°, 45 s lineal infinita.
  - `breathe`: `0%,100% { opacity:.5 } 50% { opacity:1 }`, 5,5 s `ease-in-out infinite`.
  - Hover de botones: sin transición declarada; agregar `transition: background .15s ease, filter .15s ease` si el equipo lo prefiere.
- **Respetar `prefers-reduced-motion`**: si está activo, congelar halos, wash, arco y punto de respiración en su estado medio.

## State Management
- `intervalMinutes` (por defecto 45), `quickSnoozeMinutes` (por defecto 5), `mode` (`foco` | `widget` | `ambiente`), `theme` (`oscuro` | `claro`), `startWithWindows` (bool).
- `cycleStartedAt` → deriva el progreso de Ambiente y el tiempo restante del Widget.
- `focusShownAt` → deriva el cronómetro ascendente de Foco.
- `paused` (bool) → congela el ciclo.
- `routineMarkdown` (string) y `routineExpanded` (bool).
- `snoozeMenuOpen` (bool).
- Transiciones: intervalo cumplido → mostrar Foco; LISTO → `cycleStartedAt = now`, cerrar Foco; posponer(n) → `cycleStartedAt = now - (intervalMinutes - n)`, cerrar Foco. El ciclo nunca se reinicia por sí mismo.

## Design Tokens

Tema oscuro (por defecto):
- `bg` `#0b0c0b`
- `fg` `#e9e4d8`
- `ac` `oklch(0.76 0.05 150)`

Tema claro:
- `bg` `#efece3`
- `fg` `#1a1c19`
- `ac` `oklch(0.5 0.05 150)`

Los grises intermedios no son colores nuevos: son `color-mix(in oklab, <fg> N%, transparent)` con N ∈ {8, 10, 12, 13, 20, 22, 25, 30, 34, 38, 52, 66}. En Tailwind se resuelven bien como variables CSS (`--fg`) + utilidades arbitrarias `text-[color-mix(in_oklab,var(--fg)_38%,transparent)]`, o declarando esas 12 mezclas como tokens de color. **No usar `currentColor` dentro de `color-mix`**: no resuelve contra un `color` seteado en línea y rompe el tema claro.

Tipografía:
- Display / cifras: **Newsreader** 300 (y 300 italic para las notas). Tamaños usados: 196 / 52 / 19 / 14 px.
- Etiquetas y controles: **IBM Plex Mono** 400. Tamaños: 12 / 10 / 9 px, `letter-spacing` .06 / .14 / .24 / .3 / .34em.
- Cifras siempre con `font-variant-numeric: tabular-nums`.

Radios: `999px` (botones), `50%` (halos y puntos), `4px` (widget), `0` en el resto.
Sombras: ninguna. La profundidad viene de la viñeta y los halos.
Espaciados usados: 6 / 12 / 14 / 18 / 20 / 34 / 44 / 46 / 52 / 76 px.

## Assets
Ninguno. Sin imágenes, sin iconos, sin ilustraciones: todo es tipografía, gradientes y bordes CSS. Los dos únicos glifos son `▾` (menú de posponer) y `·` (separador), ambos de la tipografía. Fuentes: Newsreader e IBM Plex Mono desde Google Fonts — empaquetarlas localmente en el build de Tauri para que funcione sin conexión.

## Files
- `Cairn Foco.dc.html` — pantalla de Foco a pantalla completa, con cronómetro real, ambos temas y todas las animaciones. Fuente de verdad.
- `Cairn Direcciones.dc.html` — el recorrido completo de exploración. Turno 3 (`#3a`) es la dirección aprobada y contiene también las maquetas de Widget y Ambiente; los turnos 2 y 1 son las direcciones descartadas, útiles como registro de por qué se eligió Aliento.
