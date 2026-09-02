# SPEC: `system-integration` — Etapa 3

Padre: [`CAPABILITY-MAP.md`](CAPABILITY-MAP.md) · Depende de: `timer-core` · Label: `stage:3-system`

## Objetivo

Que Cairn se comporte como una app de escritorio de verdad y no como una pestaña:
vive en la bandeja, sobrevive al cierre de la ventana, no se duplica, recuerda sus
ajustes entre sesiones y puede arrancar con Windows. Es la etapa donde el
temporizador de la etapa 2 deja de perderse al reiniciar la PC.

## Dependencias a agregar (avisar antes — CLAUDE.md §5)

Cuatro plugins oficiales de Tauri. Un *plugin* de Tauri es un crate de Rust más,
opcionalmente, un paquete JS que expone sus comandos al frontend.

| Plugin                         | Para qué                                |
| ------------------------------ | --------------------------------------- |
| `tauri-plugin-store`           | `store.json` de ajustes                 |
| `tauri-plugin-notification`    | notificación de Windows al vencer       |
| `tauri-plugin-single-instance` | traer al frente la instancia ya abierta |
| `tauri-plugin-autostart`       | iniciar con Windows                     |

Más la feature `tray-icon` del crate `tauri`. Ninguna dependencia de terceros.

## Alcance

### Bandeja

Icono con menú: cambiar de modo (los tres ítems ya presentes aunque las ventanas
lleguen en la etapa 4), pausar/reanudar, ajustes, salir. El ítem de pausa refleja
el estado real del temporizador, no un booleano propio.

### Ciclo de vida

- `WindowEvent::CloseRequested` → `api.prevent_close()` + `hide()`.
- `RunEvent::ExitRequested` → `api.prevent_exit()`. **Sin esto la app muere al
  ocultar la última ventana y la bandeja queda huérfana.**
- Única salida real: "Salir" del menú → `app.exit(0)`.

### Instancia única

`tauri-plugin-single-instance` **registrado primero, antes que cualquier otro
plugin** (requisito documentado; falla en silencio si no). Su callback hace
`show()` → `unminimize()` → `set_focus()`, **en ese orden**: `set_focus` de `tao`
es un no-op si la ventana está oculta o minimizada.

### Ajustes persistidos

`store.json` en el directorio de datos de la app:

```json
{
  "interval_min": 45,
  "default_mode": "foco",
  "quick_snooze_min": 5,
  "widget_pos": { "x": 1200, "y": 80 },
  "autostart": false,
  "theme": "dark"
}
```

Cada clave tiene un default en código: un `store.json` ausente, vacío o corrupto
arranca con defaults y se reescribe, **nunca** rompe el arranque. Cambiar el
intervalo mientras el temporizador corre **no** reinicia el ciclo: solo afecta al
próximo `Running`.

### Notificación

Al vencer, notificación del sistema. Requiere el identificador propio de la app
fijado en la etapa 1 — con `com.tauri.dev` las notificaciones de Windows fallan
sin decir por qué.

### Autostart

Toggle en ajustes, persistido en `store.json` **y** aplicado al registro por el
plugin. Los dos tienen que quedar sincronizados: si el usuario saca la entrada a
mano desde el Administrador de tareas, el toggle debe leer el estado real del
plugin al abrir ajustes, no el del JSON.

## Criterios de aceptación

1. Cerrar la ventana la esconde; el icono sigue en la bandeja y el temporizador
   sigue contando.
2. "Salir" desde la bandeja termina el proceso (verificable en el Administrador
   de tareas).
3. Ejecutar el `.exe` una segunda vez **no** abre otra instancia: trae la
   existente al frente.
4. Pausar y reanudar desde la bandeja mueve el mismo estado que los botones.
5. Al vencer aparece una notificación de Windows.
6. Cambiar el intervalo, cerrar la app y reabrirla: el intervalo persiste.
7. Activar autostart, reiniciar Windows: Cairn arranca.
8. Borrar `store.json` a mano y abrir: arranca con los defaults, sin error.

## Tests (TDD)

Lo testeable automáticamente es la capa de ajustes, no el sistema operativo.

- `cargo test` — `settings.rs`: deserializar un JSON completo, uno con claves
  faltantes (→ defaults), uno con tipos equivocados (→ defaults, sin panic), y
  uno corrupto o vacío (→ defaults). Roundtrip serializar→deserializar idempotente.
- `cargo test` — cambiar `interval_min` con el temporizador en `Running` no
  altera el `deadline_ms` en curso.
- **Bandeja, notificación, instancia única y autostart: verificación manual.** No
  hay forma honesta de automatizarlos acá, y simular el registro de Windows
  costaría más que la checklist.

## Verificación manual

- [ ] Icono visible en la bandeja con los cuatro grupos del menú.
- [ ] Cerrar con la X → sigue en bandeja, el contador no se reinició.
- [ ] Doble ejecución del `.exe` → una sola instancia, traída al frente.
- [ ] Notificación al vencer, con el texto correcto.
- [ ] Ajustes sobreviven a cerrar y reabrir.
- [ ] Autostart on → reiniciar Windows → arranca. Autostart off → no arranca.
- [ ] `store.json` borrado → arranca con defaults.

## Límites

- **Nunca:** guardar la rutina ni ningún contenido en `store.json` (CLAUDE.md §3).
- **Nunca:** `unsafe` ni Win32 directo para el foco — `set_focus()` ya trae el
  workaround del ALT sintético.
- **No todavía:** las tres ventanas. Acá hay una sola; el menú de modos puede
  quedar deshabilitado o sin efecto visible hasta la etapa 4.
- **Preguntar primero:** cualquier plugin más allá de los cuatro listados.

## Preguntas abiertas

- La ventana de Ajustes se crea bajo demanda con `WebviewWindowBuilder` y se
  destruye al cerrarse (decisión D4). Si en la práctica molesta que pierda estado
  al cerrarla, se revisa entonces — no se anticipa.
