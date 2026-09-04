# SPEC: `visual-design` — Etapa 6

Padre: [`CAPABILITY-MAP.md`](CAPABILITY-MAP.md) · Depende de: `routine` · Label: `stage:6-design`

## Objetivo

Cerrar la aplicación del handoff de Claude Design sobre las vistas que ya
funcionan, sin tocar una sola línea de lógica del temporizador.

## Fuente de verdad

**[`docs/DESIGN.md`](../DESIGN.md) es normativo**; el detalle medido está en el
handoff. La dirección aprobada es **"Aliento"** (halos que respiran a 5,5 s).

> **Corrección (2026-09-03).** Dos versiones previas de esta spec se
> contradecían entre sí: una daba por aprobada la dirección **"Gráfica"** (el
> dial de 620 px con arco de progreso) y la otra decía lo contrario en el mismo
> archivo. **Gana el handoff** (CLAUDE.md §5): `design_handoff_cairn/README.md`
> §"Decisión de dirección visual" dice textualmente *"La dirección del producto
> es Aliento"*, y `DESIGN.md` §1 coincide. `Cairn Foco Grafico.dc.html` y
> `Cairn Foco Estampa.dc.html` quedan como registro y **no se implementan**;
> de Gráfica solo se rescataron las escuadras de encuadre de las esquinas.
> Todo lo que esta spec decía sobre el dial, el arco de 360°/minuto y la cifra
> de contorno queda anulado.

| Archivo                                                | Qué es                                                              |
| ------------------------------------------------------ | ------------------------------------------------------------------- |
| `design_handoff_cairn/README.md`                       | especificación medida: geometría, tokens, tipografía, animaciones    |
| `design_handoff_cairn/Cairn Foco.dc.html`              | **fuente de verdad visual** de Foco (dirección aprobada)             |
| `design_handoff_cairn/Cairn Rutina.dc.html`            | panel de rutina: colapsado, lectura y edición, con la transición     |
| `design_handoff_cairn/Cairn Widget y Ambiente.dc.html` | los dos modos de fondo y todos sus estados                           |
| `design_handoff_cairn/Cairn Ajustes.dc.html`           | ventana de ajustes, interactiva                                      |
| `design_handoff_cairn/Cairn Sistema Web.dc.html`       | hoja de tokens y componentes para la web                             |
| `design_handoff_cairn/Cairn Kit Capturas.dc.html`      | los tres encuadres para mostrar la app                               |
| `design_handoff_cairn_landing/`                        | la landing completa en alta fidelidad, con su copy final             |
| `logo/`                                                | la marca, con `LEEME.md` (resguardo, tamaños mínimos, variantes)     |
| `support.js`, `image-slot.js`                          | runtime para abrir los `.dc.html` en el navegador; **no es diseño**  |

Los `.dc.html` son **referencias de diseño, no código para copiar**. Se recrean en
React + Tailwind con los patrones del proyecto.

## Alcance real de la etapa

Las etapas 2 a 5 ya salieron con el lenguaje de Aliento: los tokens, las dos
tipografías empaquetadas, las cuatro animaciones, Foco a pantalla completa, el
panel de rutina, el Widget y la barra de Ambiente están hechos. Lo que esta
etapa cierra es la lista de `DESIGN.md` §7:

1. **Selector de tema.** Los tokens de `[data-theme="light"]` y el campo `theme`
   de `store.json` ya existen; faltan el control en Ajustes, el comando de Rust
   que lo escriba y la aplicación a las tres ventanas.
2. **Las secciones MODOS, RUTINA y APARIENCIA de Ajustes**, que hoy solo tiene
   CICLO y SISTEMA.
3. **El menú `▾`** de la pastilla partida, para posponer minutos arbitrarios.
4. **El sonido al avisar**: el interruptor de SISTEMA y el tono.
5. **La etiqueta de rutina** en la sobre-línea de Foco. El handoff la dibuja con
   el nombre del documento (`CORRECCIÓN DE POSTURA`), no con el intervalo.
6. **Los controles del Widget al pasar el mouse.**

## Lo que el handoff NO decide

- **El estado sigue siendo `deadline_ms`.** El §State Management del handoff usa
  `cycleStartedAt` y define posponer como `cycleStartedAt = now - (interval - n)`.
  Es un rodeo para reusar un campo. Gana `architecture.md` §D2 y CLAUDE.md §2, y
  posponer es `deadline = now + n`. Equivalencia para leer el handoff:
  `deadline_ms == cycleStartedAt + interval`.
- **`pauseCountToday` no se implementa.** Existía para la cifra de contorno de
  la dirección **Gráfica** — el número gigante de pausas del día detrás del
  dial. Ninguna de las cinco pantallas de Aliento lo muestra, y un contador que
  nadie pinta es estado muerto con un bug de medianoche incluido. Si aparece la
  pantalla que lo necesita, se agrega ahí y se deriva, no se persiste.
- **`theme` suma `"system"` pero el default sigue siendo `"dark"`.** El handoff
  dibuja tres chips (Sistema / Claro / Oscuro); `DESIGN.md` §2 dice que el
  oscuro es el default del producto. Gana el handoff para las opciones y
  `DESIGN.md` para el default.
- **Ambiente sigue siendo 3–5 px.** El handoff lo confirma en "Pantallas
  faltantes"; coincide con `architecture.md` §D6 y `SPEC-presence-modes`.
- **No hay notificación del sistema.** El toast de la etapa 3 salió acá porque
  aparece en el mismo instante en que Foco tapa el monitor entero: un aviso
  encima del aviso. (La segunda razón de entonces —que sin instalador Windows lo
  emitía con la identidad de PowerShell— **ya no corre desde #16**, que registra
  el `AppUserModelID`.) El aviso de Cairn es la pantalla de Foco más el tono.
  Detalle en `DESIGN.md` §7 y en la nota final de `SPEC-system-integration.md`.

## Tokens

```css
:root              { --bg:#0b0c0b; --fg:#e9e4d8; --ac:oklch(0.76 0.05 150); } /* oscuro, default */
[data-theme=light] { --bg:#efece3; --fg:#1a1c19; --ac:oklch(0.50 0.05 150); }
```

Los grises **no son colores nuevos**: son
`color-mix(in oklab, var(--fg) N%, transparent)`, ya declarados como variables
en `src/index.css`. Un porcentaje que no esté ahí se agrega ahí, no en línea.

**Trampa documentada: no usar `currentColor` dentro de `color-mix`** — no resuelve
contra un `color` seteado en línea y rompe el tema claro.

Tipografía: **Newsreader** 300 e **IBM Plex Mono** 400, ambas **empaquetadas
locales** (`@fontsource-variable/newsreader`, `@fontsource/ibm-plex-mono`).
**Prohibido linkear a Google Fonts:** Cairn no hace red (CLAUDE.md §2). Cifras
siempre con `font-variant-numeric: tabular-nums`. Nada en negrita.

## Criterios de aceptación

1. Foco reproduce `Cairn Foco.dc.html`: wash de 900 px, halos de 660 / 520 /
   400 px desfasados, arco de 212 px, grano, viñeta, escuadras, y la
   sobre-línea con **el nombre del documento de rutina**.
2. Los dos temas funcionan y se cambian desde Ajustes, con las tres opciones
   (Sistema / Claro / Oscuro). El cambio alcanza a las tres ventanas sin
   reiniciar la app.
3. Ajustes tiene las cinco secciones del handoff: CICLO · MODOS · RUTINA ·
   APARIENCIA · SISTEMA, sin botón de aceptar ni de cancelar.
4. Las cuatro animaciones corren: `halo` 5,5 s, `wash` 11 s, `turn` 45 s lineal,
   `breathe` 5,5 s.
5. **`prefers-reduced-motion` congela halos, wash, arco y respiración en su
   estado medio; el ancho y el grosor de Ambiente no se tocan**, porque son
   información y no decoración. Esa distinción es el punto de la regla.
6. El menú `▾` abre **hacia arriba** y acepta minutos arbitrarios.
7. **La fila de botones no se mueve** al abrir o cerrar un panel: `LISTO` está
   en el mismo píxel. Es la única acción que no puede reubicarse nunca.
8. La app renderiza correctamente **sin conexión a internet**.
9. Cero hex hardcodeado en componentes: todo sale de los tokens.

## Tests (TDD)

Etapa mayormente visual; el test automático se reserva para lo que tiene lógica
y puede romperse en silencio.

- `vitest` — `resolveTheme(setting, prefersLight)`: `"dark"` y `"light"` mandan
  siempre; `"system"` sigue a `prefers-color-scheme`; un valor inventado cae a
  oscuro, que es el default del producto.
- `vitest` — `routineTitle(markdown)`: el primer `#` del documento, ignorando
  `##`, líneas vacías y un documento sin título.
- `vitest` — el formateo `mm:ss` del cronómetro y el paso a `h:mm:ss` pasada la
  hora (ya cubierto en `timer.test.ts`).
- `cargo test` — `sound_on_alert` sobrevive el roundtrip de `store.json`, el
  tema `"system"` se acepta y uno inventado cae al default, y las dos listas de
  claves (snake_case en disco, camelCase al frontend) siguen clavadas.
- **Todo lo demás va a checklist visual.** Un snapshot de DOM no prueba que un
  halo respire.

## Verificación manual

- [ ] Comparar Foco lado a lado con `Cairn Foco.dc.html` en el navegador, en
      ambos temas.
- [ ] Cambiar el tema en Ajustes → cambian Foco, Widget y Ambiente.
- [ ] Poner el tema en Sistema y cambiar el tema de Windows → la app acompaña.
- [ ] Activar "Reducir movimiento" en Windows → los halos dejan de respirar
      **pero la barra de Ambiente sigue avanzando**.
- [ ] Desconectar internet, reiniciar la app → las tipografías se ven igual.
- [ ] `▾` abre el menú hacia arriba; un valor arbitrario de minutos funciona.
- [ ] Elegir otro modo en MODOS conmuta de verdad y la bandeja queda marcada
      igual.
- [ ] `ABRIR CARPETA` abre el Explorador con `routine.md` seleccionado.
- [ ] Abrir y cerrar el panel: `LISTO` no se mueve un píxel.
- [ ] Los dos campos numéricos (el intervalo de CICLO y el `MIN` del menú `▾`)
      **no muestran las flechitas nativas de Windows**.
- [ ] `Win + ↓` sobre Foco baja a Ambiente, y la marca del menú de la bandeja
      se mueve a Ambiente con él.
- [ ] Elegir un modo por defecto, abrir `Ajustes` desde la bandeja, salir y
      reabrir: la app arranca en el modo elegido, no en Foco.
- [ ] Con el ciclo vencido y el widget a la vista: la cifra cuenta hacia arriba
      (`N MIN DE PAUSA`) y al pasar el mouse aparece `LISTO`, que reinicia el
      ciclo **y** deja la rutina desmarcada.
- [ ] Al vencer **no** aparece ningún toast de Windows: el aviso es la pantalla
      de Foco más el tono.
- [ ] Con dos o más monitores: MODOS → **Pantalla** → elegir el segundo mueve
      Foco **y** la franja de Ambiente ahí, al instante. Con un solo monitor la
      fila no aparece.
- [ ] Desenchufar el monitor elegido: las dos ventanas vuelven al primario solas
      y al volver a enchufarlo regresan, sin tocar ningún ajuste.

## Límites

- **Nunca:** tocar `timer.rs` en esta etapa. Si el diseño parece exigir un cambio
  de lógica, es señal de que se leyó mal el handoff — releer §"Lo que el handoff
  NO decide".
- **Nunca:** copiar y pegar el `.dc.html`, ni incluir `support.js`, que es runtime
  del prototipo y no parte del diseño.
- **Nunca:** hex hardcodeado, ni Google Fonts por CDN.
- **Preguntar primero:** cualquier librería de animación o de audio. Las cuatro
  animaciones son CSS puro y el tono del aviso es WebAudio de la plataforma —
  sin Framer Motion, sin GSAP, sin Howler.

## Preguntas resueltas al implementar

1. **Cronómetro pasada la hora:** el handoff fija `mm:ss`. A los 60 minutos pasa
   a `h:mm:ss` (`formatDuration` en `src/timer.ts`), porque `60:00` seguido de
   `61:00` se lee como un error de la app antes que como una hora.
2. **Widget y Ambiente:** se construyeron en la etapa 4 con el vocabulario de
   Aliento y el handoff los cubre; no esperan otro handoff.
