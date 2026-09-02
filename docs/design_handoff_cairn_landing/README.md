# Handoff: Cairn — landing page

## Overview
Cairn es una app de escritorio para Windows (Tauri + React + Tailwind): un temporizador de intervalos que cada 45 minutos (configurable) avisa que es hora de una pausa, y **no vuelve a contar hasta que el usuario confirma que terminó**. Se vende como licencia única.

Este handoff cubre la **landing page completa**: ocho secciones, de héroe a pie. El contenido sigue `landing_mensaje_y_estructura.md`; la forma sigue `Cairn Sistema Web.dc.html` (tokens, escala, componentes, grilla) y `Cairn Kit Capturas.dc.html` (los tres encuadres para mostrar la app).

## About the Design Files
Los archivos son **referencias de diseño hechas en HTML**: prototipos que muestran apariencia y comportamiento, no código de producción para copiar. La tarea es **recrear el diseño en el entorno real del proyecto** con sus patrones y componentes establecidos. `Cairn Landing.dc.html` se abre directamente en el navegador; el cronómetro de la captura de Foco corre de verdad y las preguntas frecuentes se abren y cierran.

## Fidelity
**Alta fidelidad (hifi).** Tipografía, colores, medidas, animaciones y copy son finales. El copy está escrito para publicarse tal cual.

Una salvedad: **las capturas de la app están recreadas en HTML/CSS, no son imágenes**. En producción se reemplazan por PNG/WebP a 2× exportados de la app real, respetando los marcos del kit de capturas. Los halos, el grano y la respiración de esas maquetas existen para que la página se pueda revisar sin la app compilada.

## Estructura de la página

Ancho máximo 1240 px, margen lateral 64 px, 160 px de aire entre secciones. Fondo `#0B0C0B` en toda la página; no hay secciones claras.

| # | Sección | Contenido |
|---|---|---|
| — | Barra Ambiente | Una franja fija de 3 px al 62 % de ancho, arriba del todo (`position:fixed`, `z-index:50`, `pointer-events:none`). Es el producto funcionando sobre su propia web. |
| — | Nav | Mojón + logotipo a la izquierda; MODOS / PRECIO / PREGUNTAS y botón `DESCARGAR` en pastilla secundaria a la derecha. Sin fondo, sin sombra, no es sticky. |
| 1 | Héroe | Etiqueta `TEMPORIZADOR DE PAUSAS · WINDOWS`, promesa en Display 84 px, subtítulo en Cuerpo 17, dos botones, nota `Windows 10 y 11 · 8 MB · sin cuenta`. Wash radial animado detrás (`wash`, 11 s). Debajo, la captura de Foco en marco A. |
| 2 | Tres modos | Tres bloques alternados texto/imagen: **Ambiente** (tres tiras de escritorio, marco C), **Widget** (recorte de escritorio, marco B, texto a la derecha), **Foco** (maqueta con cronómetro vivo, texto a la izquierda). |
| 3 | El ciclo | Cuatro pasos en línea horizontal dentro de una caja de superficie: *Contando → Aviso → Tu pausa → Confirmás*. Los tres primeros en gris, el cuarto con punto y número en acento y la línea degradada. Al pie: `↩ SÓLO DESDE ACÁ VUELVE AL PRINCIPIO`. |
| 4 | La rutina | Dos capturas lado a lado: panel en **lectura** (ítems a 22 px, casillas, dos marcadas) y en **edición** (canaleta de números + fuente markdown). |
| 5 | Tres razones | Tres tarjetas de superficie, numeradas en acento. |
| 6 | Precio | Texto argumentando la licencia única a la izquierda; caja de precio de 440 px con borde de acento al 40 % a la derecha: `US$ 18`, cuatro ítems incluidos, botón `COMPRAR LICENCIA`, nota de prueba de 14 días. |
| 7 | Preguntas | Cinco preguntas en acordeón, una abierta por vez (la primera abierta al cargar). Divisores de 1 px al 12 %. |
| 8 | Cierre + pie | Mojón grande, `La próxima pausa puede esperarte.`, botón de descarga. Pie con logotipo, CHANGELOG, correo y LICENCIA. |

## Interactions & Behavior
- **Acordeón de preguntas:** click en la fila abre y cierra; abrir una cierra la anterior (`abierta` es un índice, `-1` = todas cerradas). Toda la fila es clickeable, no sólo el título. El signo `+` pasa a `−` y toma el color de acento.
- **Hover:** 150 ms, sólo color. Botón primario `oklch(0.76 0.05 150)` → `oklch(0.82 0.055 150)`. Botón secundario: fondo de la tinta al 8 % y borde al 34 %. Filas del nav y del pie pasan a tinta plena.
- **Animaciones**, todas CSS, todas en las capturas: `halo` (`scale .9→1.08`, `opacity .26→.55`, 5,5 s, desfases 0 / 0,7 / 1,4 s), `wash` (11 s), `turn` (45 s lineal), `breathe` (`opacity .5→1`, 5,5 s). La respiración de 5,5 s es el único ritmo de la marca.
- **Cronómetro** de la maqueta de Foco: cuenta hacia arriba desde 01:24, formato `mm:ss`, `tabular-nums`. En producción puede quedar estático en `01:24` si se usa una imagen; si se anima, todos los números de la página tienen que coincidir (`01:24` en Foco, `27 min` en el Widget).
- **`prefers-reduced-motion`:** congelar `halo`, `wash`, `turn` y `breathe` en su estado medio. La barra Ambiente fija no se anima nunca.
- **Scroll:** `scroll-behavior:smooth` en `html` para los anclajes del nav. Sin parallax, sin contadores animados, sin carruseles.
- **Entradas por scroll** (no implementadas en el prototipo, opcionales): opacidad 0 → 1 con 12 px de subida en 500 ms, una sola vez por elemento.

## Responsive
El prototipo está resuelto a 1240 px. Reglas para bajar:
- **≥1024 px:** como está. Los bloques de modos usan `flex-wrap` con `min-width:420px` en la parte visual y 300 px en la de texto, así que se apilan solos.
- **<900 px:** margen lateral a 24 px, aire entre secciones a 96 px, Display a 52 px, H1 a 38 px, H2 a 28 px. Las cuatro columnas del ciclo pasan a lista vertical con la línea a la izquierda en vez de arriba.
- **<700 px:** el par lectura/edición de la rutina se apila (edición primero recortada a ~260 px de alto). La caja de precio pasa a ancho completo. El nav pierde los tres enlaces y deja sólo el logotipo y `DESCARGAR`.
- La captura de Foco mantiene `aspect-ratio:16/10` en todos los anchos; el contenido interno se escala con `transform: scale()` desde el centro por debajo de 700 px, no se reflowea.

## State Management
La página es casi estática. Único estado real:
- `abierta` (int) — índice de la pregunta abierta; `-1` = todas cerradas. Inicia en `0`.
- `s` (int) — segundos del cronómetro de la maqueta; se elimina si la captura pasa a ser imagen.
- Prop `precio` (int, 18) — alimenta la caja de precio. Expuesto como tweak para probar valores.

Todo lo demás es contenido: `razones`, `ciclo`, `faq`, `incluye`, `tiras` y `pasos` son arrays de datos en el componente. En producción conviene que vivan en un JSON o CMS mínimo, no en el markup.

## Design Tokens
- **Base:** tinta `#E9E4D8`, fondo `#0B0C0B`, acento `oklch(0.76 0.05 150)`.
- **Estados:** `acento-hover oklch(0.82 0.055 150)`, `acento-activo oklch(0.70 0.05 150)`, `acento-tenue oklch(0.76 0.05 150 / .35)` (anillo de foco), `error oklch(0.62 0.13 32)`, `exito oklch(0.68 0.09 150)`.
- **Superficies:** `rgba(233,228,216,.03)` y `.06`. **Líneas:** `.12` (suave) y `.20`.
- **Tintas de Ambiente:** `oklch(0.82 0.06 150)` sobre oscuro, `oklch(0.42 0.05 150)` sobre claro.
- **Escala:** Display 84/1.02 · H1 56/1.08 · H2 34/1.2 · H3 26/1.25 · Cuerpo 17/1.75 · Cuerpo S 13/1.9 (Mono) · Etiqueta 10 con `.3em` (Mono). **Newsreader 300** para frases, **IBM Plex Mono 400** para etiquetas y datos. Nada en negrita: la jerarquía es tamaño y color.
- **Botones:** radio 999, alto 44, foco con `outline:2px` de acento al 35 % y `offset:3px`.
- **Marcos de captura:** radio 8, borde de la tinta al 10 %, sombra `0 40px 90px rgba(0,0,0,.55)` + `0 4px 12px rgba(0,0,0,.4)` (marco A) o `0 30px 70px rgba(0,0,0,.5)` (B y C).
- **Grilla:** máximo 1240, texto máximo 680, gutter 24, margen 64 (24 en móvil), 160 px entre secciones (96 en móvil). Espaciado: 4 · 8 · 12 · 16 · 24 · 40 · 64 · 96 · 160.

Los grises son opacidades de la tinta, no colores nuevos. **No usar `currentColor` dentro de `color-mix`**: no resuelve contra un `color` seteado en línea.

## Copy
El texto de la página es definitivo y está escrito para publicarse. Reglas si hay que ampliarlo: frases cortas, presente, segunda persona, voseo. Sin signos de exclamación, sin emoji. Los números se escriben como números. Nunca prometer resultados de salud. Prohibido: "impulsá tu productividad", "diseñado para ayudarte a", "en el mundo acelerado de hoy", "revolucionario", "sin esfuerzo".

## Assets
- **Fuentes:** Newsreader (300, 300 italic) e IBM Plex Mono (300, 400) desde Google Fonts. Autohospedarlas en producción: son dos familias y el ahorro de latencia se nota en el héroe.
- **Marca:** carpeta `logo/`. Favicon `logo/cairn.ico` y `logo/png/cairn-mojon-claro-32.png`. El mojón del nav, del cierre y del pie está dibujado con divs (un círculo y dos barras redondeadas) — en producción usar `logo/cairn-mojon-claro.svg`.
- **OG image:** 1200 × 630, fondo `#0B0C0B`, mojón arriba a la izquierda, la promesa en Newsreader 300 a 56 px, y una tira de Ambiente al 62 % en el borde superior de la imagen. Falta producirla.
- **Capturas reales:** faltan. PNG a 2×, WebP en producción, siempre tema oscuro.

## Metadatos
- **Title:** Cairn — temporizador de pausas para Windows
- **Description:** Un aviso cada 45 minutos que no vuelve a contar hasta que confirmás. Tres modos, uno de ellos casi invisible.

## Pendientes
- Capturas reales exportadas de la app y OG image.
- Página de descarga, instalador firmado y changelog.
- Integración de pago para `COMPRAR LICENCIA`.
- Analítica: definir si la hay. Si se pone, que sea sin cookies — la promesa de la página es que no hay cuenta ni servidor.

## Files
| Archivo | Qué es |
|---|---|
| `Cairn Landing.dc.html` | La landing completa. Fuente de verdad de este handoff. |
| `landing_mensaje_y_estructura.md` | El brief de contenido: promesa, razones, precio argumentado, tono, qué queda afuera. |
| `Cairn Sistema Web.dc.html` | Tokens, escala tipográfica, componentes y grilla. |
| `Cairn Kit Capturas.dc.html` | Los tres marcos para mostrar la app y sus reglas. |
| `Cairn Foco.dc.html`, `Cairn Rutina.dc.html`, `Cairn Widget y Ambiente.dc.html`, `Cairn Ajustes.dc.html` | Las pantallas reales de la app, de donde salen las capturas. |
| `logo/` | Marca completa: icono, mojón, logotipo, lockups y reglas de uso. |
| `support.js`, `image-slot.js` | Runtime para abrir los prototipos en el navegador. No son parte del diseño. |
