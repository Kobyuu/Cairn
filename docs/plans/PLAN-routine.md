# Plan de ejecución — Etapa 5 · `routine`

Spec: [`SPEC-routine.md`](../specs/SPEC-routine.md) · Arquitectura: D9 · Diseño:
[`DESIGN.md`](../DESIGN.md) §4 y `docs/design_handoff_cairn/Cairn Rutina.dc.html`

## Decisiones tomadas antes de escribir código

1. **El índice de casilla se reemplaza por el número de LÍNEA del fuente.**
   La spec pedía `toggleCheckbox(markdown, index)`, con el índice contado en el
   orden en que aparecen las casillas. Eso obliga a mantener DOS parsers que
   tienen que coincidir exactamente: el de `remark-gfm`, que decide qué es una
   casilla en la vista renderizada, y uno propio que las cuenta en el fuente. En
   cuanto discrepan —un `- [x]` adentro de un bloque de código, una lista
   indentada cuatro espacios— el usuario marca una casilla y se voltea otra.

   `react-markdown` pasa el nodo de hast a cada componente (`passNode: true`,
   verificado en `node_modules/react-markdown/lib/index.js`), y ese nodo trae
   `position.start.line`: la línea exacta del `- [ ]` en el archivo. Así que el
   que decide qué es una casilla es **uno solo**, `remark-gfm`, y la función
   pura pasa a ser `toggleCheckboxAtLine(markdown, line)`.

   Los tests de la spec siguen valiendo todos —voltear solo esa, `[ ]`↔`[x]`,
   indentación anidada, fuera de rango sin lanzar, preservar el resto byte a
   byte incluido el `\n` final—; el de "no confundir un `- [x]` dentro de un
   bloque de código" se vuelve estructuralmente imposible en vez de testeado, y
   se conserva igual como test de la guarda de la función.

2. **Foco adopta el encuadre del handoff de Rutina, no el de Foco.**
   Los dos `.dc.html` se contradicen: `Cairn Foco.dc.html` centra el bloque en
   el flujo con la fila de botones a 76 px, y `Cairn Rutina.dc.html` fija el
   encabezado arriba (`padding-top` 150 px) y **ancla la fila de botones a
   `bottom:88px`**, igual abierto que cerrado.

   Gana el de Rutina **para la fila de botones**, y no por antigüedad: es el
   único encuadre en el que la regla dura "`LISTO` está en el mismo píxel
   abierto y cerrado" se puede cumplir. Con la fila en el flujo, encoger el
   cronómetro de 196 a 60 px la mueve por definición; y el panel necesita la
   franja de 172 px al pie para existir.

   **Pero el `padding-top: 150px` del prototipo para el estado colapsado se
   descartó, probándolo en pantalla.** Deja el cronómetro arriba mientras el
   halo sigue centrado, y en un monitor de verdad la pantalla queda partida en
   dos mitades que no se hablan: arriba las cifras, en el medio un anillo vacío.
   En el artboard corto del `.dc.html` no se nota. El bloque va centrado
   (`calc(50vh - 130px)`, la mitad de su propio alto) y sube a 58 px recién al
   abrirse un panel. Así el colapsado queda como en la etapa 4 y el único cambio
   visible es la fila de botones, que baja al pie.

3. **El panel de ajustes se muda a la misma región que el panel de rutina.**
   Los ajustes ya vivían dentro de Foco reemplazando al cronómetro. Con el
   encabezado que ahora se encoge, el estado "abierto" es uno solo y lo comparten
   los dos paneles: `panelOpen = showSettings || routineOpen`. Un solo juego de
   transiciones en vez de dos.

4. **La rutina se relee cada vez que se abre el panel, salvo que haya un
   borrador sin guardar.** Es el criterio 6 de la spec —editar el `.md` desde el
   Bloc de Notas con la app abierta y ver el cambio al reabrir— y la única forma
   de que el archivo en disco siga siendo la fuente de verdad. La excepción del
   borrador existe para que colapsar el panel a mitad de una edición no tire lo
   escrito: por eso el estado vive en un hook de Foco (`useRoutine`) y no adentro
   del panel, que se desmontaría.

5. **`routine_read` / `routine_write`, no `read_routine` / `write_routine`.**
   La convención del repo es `<módulo>_<verbo>` (`timer_snapshot`,
   `settings_set_autostart`). Los comandos propios de la app **no** necesitan
   permiso en `capabilities/` (CLAUDE.md §11, verificado contra Tauri 2.11.5):
   el ACL solo gatea `core:*` y plugins. La spec decía lo contrario y se corrige.

6. **La escritura atómica hace `sync_all` antes del `rename`.** Escribir el
   temporal y renombrar sin bajar los datos a disco deja una ventana en la que
   el `rename` ya ocurrió y el contenido del temporal todavía está en el caché
   del sistema: un corte ahí deja un `routine.md` de cero bytes, que es
   exactamente lo que la escritura atómica venía a evitar.

## Tareas

| # | Tarea | Archivos | Verificación |
| - | ----- | -------- | ------------ |
| 1 | `routine.rs`: tests primero (lee-crea, roundtrip UTF-8, sin `.tmp` colgado, pisa el destino), después `read_at`/`write_at` y los dos comandos | `src-tauri/src/routine.rs`, `lib.rs` | `cargo test` |
| 2 | `toggleCheckboxAtLine` + `countCheckboxes`: tests primero | `src/routine.ts`, `src/routine.test.ts` | `pnpm test` |
| 3 | Panel de rutina (lectura renderizada + edición) | `src/views/Routine.tsx`, `src/useRoutine.ts` | manual |
| 4 | Reencuadre de Foco y cableado del panel | `src/views/Foco.tsx`, `src/index.css` | manual |
| 5 | Verificación completa y docs | `docs/DESIGN.md`, `docs/specs/SPEC-routine.md` | los cinco comandos de §7 |
