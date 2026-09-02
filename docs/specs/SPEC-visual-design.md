# SPEC: `visual-design` — Etapa 6

Padre: [`CAPABILITY-MAP.md`](CAPABILITY-MAP.md) · Depende de: `routine` · Label: `stage:6-design`

## Objetivo

Aplicar el handoff de Claude Design a las vistas que ya funcionan. Hasta acá la
UI fue deliberadamente fea; esta etapa la reemplaza sin tocar una sola línea de
lógica del temporizador.

## Fuente de verdad

`docs/design_handoff_cairn_foco/` — dirección aprobada **"Aliento"**.

| Archivo                     | Qué es                                                                   |
| --------------------------- | ------------------------------------------------------------------------ |
| `README.md`                 | especificación medida: tokens, tipografía, componentes, animaciones      |
| `Cairn Foco.dc.html`        | **fuente de verdad visual** de Foco: hifi, ambos temas, animaciones      |
| `Cairn Direcciones.dc.html` | exploración completa; el turno `#3a` es la aprobada, con Widget/Ambiente |

Los `.dc.html` son **referencias de diseño, no código para copiar**. Se recrean en
React + Tailwind con los patrones del proyecto.

**Fidelidad declarada:** Foco es **hifi** — colores, tipografía, tamaños,
espaciados, hover y animaciones son finales y se recrean fielmente. Widget y
Ambiente son **lofi**: maquetas de intención, no pantallas terminadas.

## Lo que el handoff NO decide

Se escribe acá para que nadie lo implemente al revés más adelante:

- **El estado sigue siendo `deadline_ms`.** El §State Management del handoff
  propone `cycleStartedAt` y define posponer como
  `cycleStartedAt = now - (interval - n)`. Es un rodeo para reusar un campo. Gana
  `architecture.md` §D2 y CLAUDE.md §2. Equivalencia para leer el handoff:
  `deadline_ms == cycleStartedAt + interval`.
- **Ambiente mide 3 px / 5 px**, no los 4 px del brief original. Acá **sí** gana
  el handoff: es la decisión posterior, y es una decisión visual.
- **Rutina expandida y Ajustes no están diseñadas.** Se construyen con el
  vocabulario de Foco y se revisan cuando llegue su handoff.

## Tokens

```css
:root              { --bg:#0b0c0b; --fg:#e9e4d8; --ac:oklch(0.76 0.05 150); } /* oscuro, default */
[data-theme=light] { --bg:#efece3; --fg:#1a1c19; --ac:oklch(0.50 0.05 150); }
```

Los grises intermedios **no son colores nuevos**: son
`color-mix(in oklab, var(--fg) N%, transparent)` con N ∈ {8, 10, 12, 13, 20, 22,
25, 30, 34, 38, 52, 66}. Se declaran como tokens de color de Tailwind, no como
utilidades arbitrarias repetidas.

**Trampa documentada por el handoff: no usar `currentColor` dentro de
`color-mix`** — no resuelve contra un `color` seteado en línea y rompe el tema
claro.

Tipografía: **Newsreader** 300 (display y cifras, 196/52/19/14 px) e **IBM Plex
Mono** 400 (etiquetas y controles, 12/10/9 px). Cifras siempre con
`font-variant-numeric: tabular-nums`. Radios: `999px`, `50%`, `4px`, `0`.
Sombras: ninguna — la profundidad sale de la viñeta y los halos.

### Dependencia a agregar (avisar antes — CLAUDE.md §5)

Las dos familias van **empaquetadas localmente** (`@fontsource/newsreader` y
`@fontsource/ibm-plex-mono`, o los `.woff2` versionados a mano). **Prohibido
linkear a Google Fonts:** Cairn no hace red (CLAUDE.md §2), y una app de
escritorio no puede depender de conexión para renderizar su pantalla principal.

## Criterios de aceptación

1. Foco reproduce el `.dc.html` de referencia: siete capas de fondo, cuatro
   escuadras de encuadre, etiqueta de rutina, sobre-línea, cronómetro de 196 px,
   marca de respiración, fila de botones y pista inferior.
2. Los dos temas funcionan y se cambian desde Ajustes. El círculo del prototipo es
   solo de prueba y **no** va al producto.
3. Las cuatro animaciones corren con sus períodos y delays: `halo` 5,5 s con
   delays 0 / 0,7 / 1,4 s; `wash` 11 s; `turn` 45 s lineal; `breathe` 5,5 s.
4. **`prefers-reduced-motion` congela halos, wash, arco y punto de respiración en
   su estado medio.** No es opcional.
5. El grupo "posponer 5 ▾" funciona partido: el segmento izquierdo pospone el
   valor rápido; `▾` abre el menú con 10 / 15 / 30 y un campo de minutos libres.
6. Widget y Ambiente adoptan los tokens y el vocabulario, sin pretender ser
   pantallas finales (son lofi en el handoff).
7. La app renderiza correctamente **sin conexión a internet**.
8. Cero hex hardcodeado en componentes: todo sale de los tokens.

## Tests (TDD)

Etapa mayormente visual; el test automático se reserva para lo que sí tiene lógica
y para lo que puede romperse en silencio.

- `vitest` — el formateo `mm:ss` del cronómetro ascendente, incluido el paso de
  `59:59` a `60:00` (el handoff especifica `mm:ss`, no `h:mm:ss`, así que hay que
  decidir y testear qué pasa pasada la hora).
- `vitest` — el resolvedor de tokens: pedir una mezcla con N fuera del conjunto de
  12 valores permitidos falla en tiempo de test, no en producción. Es lo que
  impide que se filtre un hex suelto.
- **Todo lo demás va a checklist visual.** Un snapshot de DOM no prueba que un
  halo respire.

## Verificación manual

- [ ] Comparar Foco lado a lado con `Cairn Foco.dc.html` abierto en el navegador,
      en ambos temas.
- [ ] Activar "Reducir movimiento" en Windows → las animaciones se congelan.
- [ ] Desconectar internet, reiniciar la app → las tipografías se ven igual.
- [ ] Hover sobre `LISTO`, sobre cada segmento de "posponer 5 ▾" y sobre
      "ver rutina": los tres estados coinciden con la referencia.
- [ ] `▾` abre el menú; un valor arbitrario de minutos funciona.
- [ ] Ambiente sobre un fondo claro y sobre uno oscuro: se lee en los dos.

## Límites

- **Nunca:** tocar `timer.rs` en esta etapa. Si el diseño parece exigir un cambio
  de lógica, es señal de que se leyó mal el handoff — releer §"Lo que el handoff
  NO decide".
- **Nunca:** copiar y pegar el `.dc.html`. Se recrea con los componentes del
  proyecto.
- **Nunca:** hex hardcodeado, ni Google Fonts por CDN.
- **Preguntar primero:** cualquier librería de animación. Las cuatro animaciones
  son CSS puro en el handoff y así se quedan — sin Framer Motion, sin GSAP.

## Preguntas abiertas

- **Cronómetro pasada la hora:** el handoff fija `mm:ss`. ¿A los 60 minutos de
  pausa muestra `60:00` o pasa a `1:00:00`? Se decide al implementar y se anota;
  no bloquea.
- Rutina expandida, Widget final, Ambiente final y Ajustes esperan su propio
  handoff. Hasta entonces se construyen con el vocabulario de Foco.
