# SPEC: `routine` — Etapa 5

Padre: [`CAPABILITY-MAP.md`](CAPABILITY-MAP.md) · Depende de: `presence-modes` · Label: `stage:5-routine`

## Objetivo

La rutina: un documento markdown editable desde la app, colapsado por defecto en
la pantalla de Foco, con un botón "ver rutina" que lo expande. Renderizado con
soporte de listas con casillas de verificación.

**El objetivo secundario pesa igual que el primero:** dejar el almacenamiento
listo para que la etapa 2 del producto (notas, tareas y recordatorios en
markdown, estilo Notion mínimo) no obligue a migrar nada.

## Almacenamiento

```
<app_data_dir>/notes/routine.md
```

Un `.md` real, UTF-8, dentro de un **directorio** de notas. Esa es toda la
decisión de compatibilidad futura: crecer significa agregar archivos a `notes/`
y, si algún día hace falta, un índice. No hay migración posible que hacer porque
no hay formato propietario del que migrar.

Sin frontmatter en el MVP. Si más adelante hacen falta metadatos, el markdown
acepta frontmatter YAML sin romper a los lectores que lo ignoran.

**Escritura atómica, obligatoria:** escribir a `routine.md.tmp` y `rename` sobre
el destino. Un corte de luz a mitad de un `write` directo deja la rutina
truncada, y la rutina es contenido que el usuario escribió a mano — no se
regenera.

Si `notes/routine.md` no existe al arrancar, se crea con una rutina de ejemplo.

## Dependencias a agregar (avisar antes — CLAUDE.md §5)

| Paquete          | Para qué                                                 |
| ---------------- | -------------------------------------------------------- |
| `react-markdown` | renderizar markdown a JSX sin `dangerouslySetInnerHTML`  |
| `remark-gfm`     | listas con casillas (`- [ ]` / `- [x]`), tablas, tachado |

**Nada más.** La edición es un `<textarea>` pelado: sin ProseMirror, sin TipTap,
sin editor WYSIWYG. Marcar una casilla desde la vista renderizada es voltear
`[ ]`↔`[x]` en el markdown fuente, en la línea que reporta `remark-gfm` — unas
15 líneas, y deja el archivo legible en cualquier editor de texto.

## Alcance

- Comandos de Rust: `routine_read()` y `routine_write(content)` -la convención
  del repo es `<módulo>_<verbo>`, como `timer_snapshot`-. **No** van declarados
  en `src-tauri/capabilities/`: el ACL de Tauri v2 solo gatea los comandos
  `core:*` y los de plugins, y los propios de la app están permitidos por
  defecto para todas las ventanas (CLAUDE.md §11, verificado contra Tauri
  2.11.5). La versión previa de esta línea decía lo contrario y era falsa.
- Panel colapsado por defecto en Foco, expandible con "ver rutina".
- Dos estados: **lectura** (renderizado) y **edición** (`<textarea>` con el
  markdown crudo). Alternar entre ellos no pierde cambios sin guardar.
- Marcar/desmarcar una casilla en modo lectura persiste al archivo.
- **Confirmar el ciclo con `LISTO` desmarca la rutina entera.** Si no quedara
  limpia, la pausa siguiente arrancaria con todo tildado y habria que
  desmarcarlo a mano, que es exactamente el trabajo que la rutina viene a
  ahorrar. Si no habia nada marcado, el archivo no se toca.

## Criterios de aceptación

1. El panel arranca **colapsado**. La primera vez que se abre, `notes/routine.md`
   existe y tiene contenido de ejemplo. _(La creación es perezosa: el archivo
   aparece al abrir el panel o al apretar `LISTO`, no al abrir Foco. Arrancar la
   app no tiene por qué escribir en disco algo que el usuario todavía no pidió.)_
2. "ver rutina" expande el panel; el markdown se ve renderizado (títulos, listas,
   negritas), no como texto plano.
3. Las listas con casillas se ven como casillas y se pueden marcar.
4. Marcar una casilla, cerrar la app y reabrir → la casilla sigue marcada.
5. Editar en el `<textarea>` y guardar → el archivo en disco refleja el cambio,
   verificable abriéndolo con el Bloc de Notas.
6. Un `routine.md` escrito a mano desde afuera se lee correctamente al reabrir.
7. Expandir la rutina **no** afecta al cronómetro ascendente de Foco.

## Tests (TDD — se escriben ANTES del código)

- `vitest` — el volteo de casillas es la lógica con bugs escondidos, así que es
  una función pura. Va por **número de línea** y no por índice de casilla
  (`toggleCheckboxAtLine(markdown, line) -> markdown`): el índice obliga a
  mantener dos parsers que tienen que coincidir con el de `remark-gfm`, y
  `react-markdown` ya entrega la línea exacta del fuente en
  `node.position.start.line`. Razonado en `docs/plans/PLAN-routine.md`. Casos:
  - voltea la casilla N y **solo** esa;
  - `- [ ]` → `- [x]` y a la inversa;
  - no confunde un `- [x]` dentro de un bloque de código con una casilla real
    -para el volteo es estructural, porque la línea la decide `remark-gfm`; para
    `countCheckboxes`, que mira el fuente entero, es un test de verdad-;
  - respeta la indentación de casillas anidadas;
  - una línea fuera de rango, o que no empieza con una casilla, devuelve el
    markdown sin cambios, sin lanzar;
  - preserva el resto del documento byte a byte, incluido el salto de línea final
    (perder el `\n` final en cada guardado es cómo un archivo se ensucia de a poco).
- `cargo test` — `routine.rs`: `read` de un archivo inexistente devuelve el
  contenido de ejemplo y lo crea; roundtrip `write`→`read` conserva UTF-8 con
  acentos y emojis; `write` no deja el `.tmp` colgado tras un guardado exitoso.

## Verificación manual

- [ ] Marcar tres casillas, cerrar, reabrir → las tres siguen marcadas.
- [ ] Editar la rutina desde el Bloc de Notas con la app abierta, reabrir el
      panel → se ve el cambio.
- [ ] Escribir un acento y un emoji, guardar, abrir el archivo desde afuera → se
      ven bien.
- [ ] Expandir y colapsar mientras corre el cronómetro → el cronómetro no salta.
- [ ] `notes/` borrado entero → arranca y lo recrea, sin error.
- [ ] **Con el panel ya abierto**, editar `routine.md` desde afuera y marcar una
      casilla → la app escribe el documento que tenía en memoria y se lleva
      puesta la edición externa. Es el límite conocido: la relectura ocurre al
      **abrir** el panel, no mientras está abierto.
- [ ] Una casilla adentro de una cita (`> - [ ] algo`) se marca y se guarda.
- [ ] Marcar todo, apretar `LISTO`, reabrir el panel → todo desmarcado, y el
      resto del documento igual que antes.
- [ ] Apretar `LISTO` sin haber abierto nunca el panel → no rompe nada, y al
      abrirlo después la rutina está limpia.
- [ ] Con "efectos de animación" apagado en Windows, el panel abre de golpe y
      sin recorrido, pero abre.

## Límites

- **Nunca:** guardar la rutina en `store.json` (CLAUDE.md §3).
- **Nunca:** `dangerouslySetInnerHTML`. `react-markdown` renderiza a JSX
  precisamente para no tener que sanitizar HTML a mano.
- **Nunca:** un editor WYSIWYG. `<textarea>` hasta que Manu pida otra cosa.
- **No todavía:** múltiples notas, tags, búsqueda, índice. El directorio `notes/`
  los deja posibles; construirlos ahora es la sobreingeniería que esta spec evita.
- **Preguntar primero:** cualquier paquete más allá de los dos listados.

## Preguntas abiertas

- ~~El handoff todavía no diseñó la rutina expandida.~~ Sí lo hizo:
  `docs/design_handoff_cairn/Cairn Rutina.dc.html`, y es lo que se implementó.
- La **lámina de referencia** del handoff (el marco con una imagen al costado de
  la primera sección) no se implementó: es contenido del usuario y hoy no hay
  forma de que el webview cargue un archivo de su disco sin habilitar el
  protocolo de assets. Queda para cuando haga falta de verdad.
