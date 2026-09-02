# SPEC: `visual-design` — Etapa 6

Padre: [`CAPABILITY-MAP.md`](CAPABILITY-MAP.md) · Depende de: `routine` · Label: `stage:6-design`

## Objetivo

Aplicar el handoff de Claude Design a las vistas que ya funcionan. Hasta acá la
UI fue deliberadamente fea; esta etapa la reemplaza sin tocar una sola línea de
lógica del temporizador.

## Fuente de verdad

**[`docs/DESIGN.md`](../DESIGN.md) es normativo**; el detalle medido está en el
handoff. La dirección aprobada es **"Aliento"** (halos que respiran a 5,5 s).

> **Corrección.** Una versión anterior de esta spec daba por aprobada la
> dirección **"Gráfica" (dial)**. El handoff posterior la descartó: el dial no
> existe en una barra de 3 px, y ese es justamente el criterio que decide —
> Aliento es la única de las tres familias cuyo lenguaje escala a los tres modos.
> `Cairn Foco Grafico.dc.html` y `Cairn Foco Estampa.dc.html` quedan como
> registro y **no se implementan**.

| Archivo                                        | Qué es                                                              |
| ---------------------------------------------- | ------------------------------------------------------------------- |
| `design_handoff_cairn/README.md`               | especificación medida: geometría, tokens, tipografía, animaciones    |
| `design_handoff_cairn/Cairn Foco.dc.html`      | **fuente de verdad visual** de Foco (dirección aprobada)             |
| `design_handoff_cairn/Cairn Rutina.dc.html`    | panel de rutina: colapsado, lectura y edición, con la transición     |
| `design_handoff_cairn/Cairn Widget y Ambiente.dc.html` | los dos modos de fondo y todos sus estados                   |
| `design_handoff_cairn/Cairn Ajustes.dc.html`   | ventana de ajustes, interactiva                                     |
| `design_handoff_cairn/Cairn Sistema Web.dc.html` | hoja de tokens y componentes para la web                          |
| `design_handoff_cairn/Cairn Kit Capturas.dc.html` | los tres encuadres para mostrar la app                           |
| `design_handoff_cairn_landing/`                | la landing completa en alta fidelidad, con su copy final            |
| `logo/`                                        | la marca, con `LEEME.md` (resguardo, tamaños mínimos, variantes)     |
| `support.js`, `image-slot.js`                  | runtime para abrir los `.dc.html` en el navegador; **no es diseño**  |

> **Gráfica es la dirección elegida** (confirmado por Manu el 2026-09-02, tras la
> reescritura del handoff que reemplazó a "Aliento"). `Cairn Foco.dc.html` queda
> en el repo solo como registro de la opción descartada: **no se implementa**.

Los `.dc.html` son **referencias de diseño, no código para copiar**. Se recrean en
React + Tailwind con los patrones del proyecto.

**Fidelidad:** Foco es **hifi**. Rutina expandida, Widget, Ambiente y Ajustes
**no están diseñadas** — el handoff las lista como pendientes.

## Composición de Foco

Contenedor `100vw × 100vh`, `overflow:hidden`, todo centrado. El **dial de 620 px
es el único elemento en el flujo**; el resto va en absoluto contra los bordes.

**Fondo (tres capas):** grano de 3×3 px al 45%; grilla de encuadre de cuatro
hairlines a 96 px de cada borde; y la cifra de contorno — el número de pausa del
día en Newsreader 420 px, `color:transparent` con `-webkit-text-stroke`, anclada
saliéndose del borde inferior a propósito.

**Dial (620 px):** anillo de 60 marcas hecho con `repeating-conic-gradient` y
recortado con `mask:radial-gradient` a 21 px de grosor; arco de progreso con
`conic-gradient` recortado a 5 px; dos aros interiores, uno de ellos solo
`border-top` en color de acento girando con `spin`.

**Barra de controles** (`bottom:96px`): una sola caja segmentada, borde de 1 px,
**sin radio y sin sombra** — `LISTO` | `POSPONER 5` | `▾` | `VER RUTINA`. El menú
de `▾` abre **hacia arriba**, alineado al segmento, con el mismo borde y fondo.

## Lo que el handoff NO decide

Se escribe acá para que nadie lo implemente al revés más adelante:

- **El estado sigue siendo `deadline_ms`.** El §State Management del handoff usa
  `cycleStartedAt` y define posponer como `cycleStartedAt = now - (interval - n)`.
  Es un rodeo para reusar un campo. Gana `architecture.md` §D2 y CLAUDE.md §2, y
  posponer es `deadline = now + n`. Equivalencia para leer el handoff:
  `deadline_ms == cycleStartedAt + interval`.
- **`pauseCountToday` es un campo nuevo.** La cifra de contorno y el margen
  derecho lo necesitan, y hoy no existe en el estado ni en `store.json`. Es un
  contador que se reinicia a medianoche: **derivarlo, no persistirlo**, contando
  las confirmaciones del día. Persistirlo obliga a manejar el cambio de fecha con
  la app abierta, que es un bug esperando.
- **Ambiente sigue siendo 3–5 px.** El handoff lo confirma en "Pantallas
  faltantes"; coincide con `architecture.md` §D6 y `SPEC-presence-modes`.

## Tokens

```css
:root              { --bg:#0b0c0b; --fg:#e9e4d8; --ac:oklch(0.76 0.05 150); } /* oscuro, default */
[data-theme=light] { --bg:#efece3; --fg:#1a1c19; --ac:oklch(0.50 0.05 150); }
```

Idénticos a la dirección anterior: el rediseño cambió la composición, no la paleta.

Los grises **no son colores nuevos**: son
`color-mix(in oklab, var(--fg) N%, transparent)` con N ∈ {8, 9, 10, 14, 18, 20,
24, 26, 30, 34, 40, 46, 66} — trece valores. Se declaran como tokens de Tailwind,
no como utilidades arbitrarias repetidas.

**Trampa documentada: no usar `currentColor` dentro de `color-mix`** — no resuelve
contra un `color` seteado en línea y rompe el tema claro.

Tipografía: **Newsreader** 300 (420 / 150 / 17 px) e **IBM Plex Mono** 400
(12 / 11 / 10 / 9 px, `letter-spacing` .08–.4em). Cifras siempre con
`font-variant-numeric: tabular-nums`. Radios: `50%` en el dial, **`0` en todo lo
demás**. Sin sombras.

### Dependencia a agregar (avisar antes — CLAUDE.md §5)

Las dos familias van **empaquetadas localmente** (`@fontsource/newsreader` y
`@fontsource/ibm-plex-mono`, o los `.woff2` versionados a mano). **Prohibido
linkear a Google Fonts:** Cairn no hace red (CLAUDE.md §2), y una app de
escritorio no puede depender de conexión para renderizar su pantalla principal.

## Criterios de aceptación

1. Foco reproduce `Cairn Foco Grafico.dc.html`: las tres capas de fondo, el dial
   de 620 px con sus cuatro anillos, el bloque central y la barra segmentada.
2. **El arco recorre 360° por minuto** — marca los segundos de la pausa, no el
   ciclo de trabajo. Se actualiza una vez por segundo **sin transición**: el salto
   de 6° coincide con el paso de las marcas, y suavizarlo rompe el efecto.
3. Los dos temas funcionan y se cambian desde Ajustes. El cuadrado del prototipo
   es solo de prueba y **no** va al producto.
4. Las tres animaciones corren: `spin` 45 s lineal, `pulse` 5,5 s, `grow` 5,5 s
   `alternate`.
5. **`prefers-reduced-motion` congela `spin`, `pulse` y `grow` — pero el arco
   sigue actualizándose**, porque es información, no decoración. Esa distinción es
   el punto de la regla.
6. La barra segmentada funciona; el menú de `▾` abre hacia arriba y acepta minutos
   arbitrarios.
7. Por debajo de ~1000 × 780 px el bloque central escala con `transform: scale()`
   desde el centro, o el dial baja a 460 px con el cronómetro a 112 px.
   **No reflowear**: la composición depende del dial centrado y la grilla a 96 px.
8. La app renderiza correctamente **sin conexión a internet**.
9. Cero hex hardcodeado en componentes: todo sale de los tokens.

## Tests (TDD)

Etapa mayormente visual; el test automático se reserva para lo que tiene lógica y
puede romperse en silencio.

- `vitest` — el ángulo del arco: `angle(elapsedSec) === (elapsedSec % 60) / 60 * 360`.
  Casos: 0 s → 0°; 30 s → 180°; 59 s → 354°; 60 s → 0° (vuelve a empezar);
  3661 s → 6°. El wrap del minuto es donde se cuela el off-by-one.
- `vitest` — el formateo `mm:ss` del cronómetro, incluido el paso de `59:59` a
  `60:00` (el handoff fija `mm:ss`, así que hay que decidir y testear qué pasa
  pasada la hora).
- `vitest` — `pauseCountToday` se reinicia al cambiar de día con la app abierta.
- `vitest` — el resolvedor de tokens: pedir una mezcla con N fuera de los trece
  valores permitidos falla en tiempo de test, no en producción. Es lo que impide
  que se filtre un hex suelto.
- **Todo lo demás va a checklist visual.** Un snapshot de DOM no prueba que un
  dial respire.

## Verificación manual

- [ ] Comparar Foco lado a lado con `Cairn Foco Grafico.dc.html` en el navegador,
      en ambos temas.
- [ ] Mirar el arco un minuto entero: avanza a saltos de 6 s por marca y vuelve a
      cero al minuto.
- [ ] Activar "Reducir movimiento" en Windows → el dial deja de respirar **pero el
      arco sigue avanzando**.
- [ ] Desconectar internet, reiniciar la app → las tipografías se ven igual.
- [ ] Hover sobre los cuatro segmentos de la barra: coinciden con la referencia.
- [ ] `▾` abre el menú hacia arriba; un valor arbitrario de minutos funciona.
- [ ] Achicar la ventana a menos de 1000 px de ancho → escala, no reflowea.

## Límites

- **Nunca:** tocar `timer.rs` en esta etapa. Si el diseño parece exigir un cambio
  de lógica, es señal de que se leyó mal el handoff — releer §"Lo que el handoff
  NO decide".
- **Nunca:** copiar y pegar el `.dc.html`, ni incluir `support.js`, que es runtime
  del prototipo y no parte del diseño.
- **Nunca:** hex hardcodeado, ni Google Fonts por CDN.
- **Nunca:** transición en el arco. El salto discreto es la decisión, no un
  descuido.
- **Preguntar primero:** cualquier librería de animación. Las tres animaciones son
  CSS puro en el handoff y así se quedan — sin Framer Motion, sin GSAP.

## Preguntas abiertas

1. **Cronómetro pasada la hora:** el handoff fija `mm:ss`. ¿A los 60 minutos
   muestra `60:00` o pasa a `1:00:00`? Se decide al implementar y se anota.
2. Rutina expandida, Widget, Ambiente y Ajustes esperan su propio handoff. Hasta
   entonces se construyen con el vocabulario de Gráfica.
