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
`[ ]`↔`[x]` en el markdown fuente por índice de casilla — unas 15 líneas, y deja
el archivo legible en cualquier editor de texto.

## Alcance

- Comandos de Rust: `read_routine()` y `write_routine(content)`. Ambos declarados
  en `src-tauri/capabilities/`, o el `invoke` falla en runtime sin avisar.
- Panel colapsado por defecto en Foco, expandible con "ver rutina".
- Dos estados: **lectura** (renderizado) y **edición** (`<textarea>` con el
  markdown crudo). Alternar entre ellos no pierde cambios sin guardar.
- Marcar/desmarcar una casilla en modo lectura persiste al archivo.

## Criterios de aceptación

1. Al abrir Foco por primera vez existe `notes/routine.md` con contenido de
   ejemplo, y el panel está **colapsado**.
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
  una función pura `toggleCheckbox(markdown, index) -> markdown`:
  - voltea la casilla N y **solo** esa;
  - `- [ ]` → `- [x]` y a la inversa;
  - no confunde un `- [x]` dentro de un bloque de código con una casilla real;
  - respeta la indentación de casillas anidadas;
  - un índice fuera de rango devuelve el markdown sin cambios, sin lanzar;
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

## Límites

- **Nunca:** guardar la rutina en `store.json` (CLAUDE.md §3).
- **Nunca:** `dangerouslySetInnerHTML`. `react-markdown` renderiza a JSX
  precisamente para no tener que sanitizar HTML a mano.
- **Nunca:** un editor WYSIWYG. `<textarea>` hasta que Manu pida otra cosa.
- **No todavía:** múltiples notas, tags, búsqueda, índice. El directorio `notes/`
  los deja posibles; construirlos ahora es la sobreingeniería que esta spec evita.
- **Preguntar primero:** cualquier paquete más allá de los dos listados.

## Preguntas abiertas

- El handoff todavía no diseñó la rutina expandida. Hasta que llegue, el panel usa
  los tokens de Foco (Newsreader para el cuerpo, IBM Plex Mono para las etiquetas)
  y se refina en la etapa 6.
