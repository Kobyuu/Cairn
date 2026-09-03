# Plan: `visual-design` — Etapa 6

Spec: [`SPEC-visual-design.md`](../specs/SPEC-visual-design.md) · Diseño normativo:
[`DESIGN.md`](../DESIGN.md) · Dirección: **Aliento**.

## Qué falta de verdad

La etapa 6 no es "aplicar el handoff a una UI fea": los tokens, la tipografía,
las cuatro animaciones, Foco, Rutina, Widget y Ambiente ya salieron con el
lenguaje de Aliento en las etapas 2 a 5. Lo que queda es la lista de
`DESIGN.md` §7, y es corta:

| Falta                                             | Dónde                        |
| ------------------------------------------------- | ---------------------------- |
| Selector de tema (control + comando + aplicación) | Ajustes, `settings.rs`, boot |
| Secciones MODOS · RUTINA · APARIENCIA de Ajustes  | `Foco.tsx`                   |
| Menú `▾` de posponer arbitrario                   | `Foco.tsx`                   |
| Sonido al avisar (interruptor + tono)             | Ajustes + `sound.ts`         |
| Etiqueta de rutina en la sobre-línea de Foco      | `Foco.tsx`                   |
| Controles del Widget al pasar el mouse            | `Widget.tsx`                 |

## Decisiones tomadas antes de escribir código

1. **`pauseCountToday` NO se implementa.** Es un campo del §State Management
   del handoff que existía para la **cifra de contorno de la dirección
   Gráfica** — el número gigante de pausas del día detrás del dial. Gráfica se
   descartó, y ninguna de las cinco pantallas de Aliento muestra ese número.
   Un contador que nadie pinta es estado muerto con un bug de medianoche
   incluido. Si algún día aparece la pantalla que lo necesita, se agrega ahí.
2. **`theme` suma `"system"`, pero el default sigue siendo `"dark"`.** El
   handoff dibuja tres chips (Sistema / Claro / Oscuro) y su prototipo arranca
   en Sistema; `DESIGN.md` §2 dice que el oscuro es el default del producto.
   Gana `DESIGN.md` para el default —cambiarlo mandaría a Manu al tema claro
   sin pedirlo— y gana el handoff para las tres opciones.
3. **El tema lo resuelve el frontend, no Rust.** Rust persiste el string y lo
   emite; cada ventana lo traduce a `data-theme="dark"|"light"`, porque
   `"system"` depende de `prefers-color-scheme`, que solo existe en el webview.
4. **Elegir el modo por defecto en Ajustes cambia el modo de verdad**
   (`modes::set_mode`), no solo el archivo. `default_mode` es un campo único
   que significa las dos cosas; persistirlo sin conmutar dejaría la bandeja
   marcando un modo y el archivo diciendo otro.
5. **Del Widget entran los controles del hover y quedan afuera el
   `backdrop-filter`, la sombra larga y el estado de arrastre.** Los dos
   primeros ya tenían su razón en `DESIGN.md` §7 y no cambió nada: no hay nada
   que muestrear detrás de una ventana transparente, y la sombra es un color
   hardcodeado que se ve como un halo cuadrado. El arrastre lo dibuja Windows y
   el webview no recibe eventos de mouse mientras dura, así que no hay dónde
   colgarlo. Los controles del hover sí entran: son función, no decoración.
6. **La CSP del backlog no entra en esta etapa.** Es deuda anterior con su
   propio riesgo de romper el render; va por el flujo de backlog (CLAUDE.md §6:
   preguntar → spec → issue), no de contrabando en una etapa visual.

## Tareas

Agrupadas por archivo (CLAUDE.md §10.2), en orden de dependencia.

### T1 — Core: los ajustes nuevos (`settings.rs`, `lib.rs`)

- `THEMES` pasa a `["system", "dark", "light"]`.
- Campo nuevo `sound_on_alert: bool` (default `false`), en `from_json`,
  `to_json` y los dos tests de contrato (claves snake_case / wire camelCase).
- Comandos `settings_set_theme` y `settings_set_sound`, que persisten y
  **emiten `settings-changed`** con los ajustes al resto de las ventanas.
- Registro en `invoke_handler`.
- **Tests:** `sound_on_alert` en el roundtrip, `"system"` aceptado, un tema
  inventado sigue cayendo al default, y las dos listas de claves actualizadas.

### T2 — Core: modo y rutina (`modes.rs`, `routine.rs`, `lib.rs`)

- `modes_set(mode: String)`: valida contra `Mode::from_label` y delega en
  `set_mode`. Es la fila MODOS de Ajustes.
- `routine_info()` → `{ modifiedMs }` para la fila RUTINA.
- `routine_reveal()`: abre el Explorador con `routine.md` seleccionado
  (`explorer /select,<ruta>`). Sin dependencia nueva; Windows es el único
  target (CLAUDE.md §1).

### T3 — Frontend puro (`theme.ts`, `routine.ts`) — **tests primero**

- `resolveTheme(setting, prefersLight)` → `"dark" | "light"`.
- `routineTitle(markdown)` → el primer `#` del documento, o `null`.

### T4 — Boot y hooks (`main.tsx`, `useSettings.ts`, `settings.ts`)

- `main.tsx` aplica el tema al arrancar y se suscribe a `settings-changed` y
  al cambio de `prefers-color-scheme`. Una sola vez, para las tres ventanas.
- `useSettings` expone `setTheme`, `setSound`, `setDefaultMode` y escucha
  `settings-changed` para no quedar desincronizado con la otra ventana.

### T5 — Foco (`Foco.tsx`, `sound.ts`)

- Sobre-línea = etiqueta de rutina (el `#` del documento), como el handoff.
- Pastilla partida `posponer N` + `▾`, con el menú abriendo **hacia arriba**.
- Secciones MODOS, RUTINA y APARIENCIA; el interruptor de sonido en SISTEMA.
- Tono corto y grave con WebAudio al pasar a `elapsed`, si el ajuste está
  encendido. Sin archivo de audio y sin dependencia.

### T6 — Widget (`Widget.tsx`)

- Al pasar el mouse aparecen pausar/reanudar y `MODO` en cajas de 30 px.

### T7 — Cierre

- Actualizar `DESIGN.md` §7 y `SPEC-visual-design.md`.
- Los cinco comandos de verificación, una sola vez (CLAUDE.md §10.2).
- Checklist de verificación manual y parada (CLAUDE.md §7).
