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
| `tauri-plugin-notification`    | notificación de Windows al vencer — **quitado en la etapa 6**, ver abajo |
| `tauri-plugin-single-instance` | traer al frente la instancia ya abierta |
| `tauri-plugin-autostart`       | iniciar con Windows                     |

Más la feature `tray-icon` del crate `tauri`. Ninguna dependencia de terceros.

**Resuelto al implementar:** los cuatro se usan **solo desde Rust**, y hacia el
webview van comandos propios de Cairn (`settings_snapshot`,
`settings_set_autostart`). Por eso **no hace falta ningún paquete JS** ni ninguna
entrada nueva en `capabilities/`: el ACL de Tauri v2 gatea los comandos de plugin
invocados desde el webview, no las llamadas desde Rust (CLAUDE.md §11).

**Además, un cambio de perfil de compilación, no una dependencia:**
`[profile.dev.package."*"] debug = 0` en `src-tauri/Cargo.toml`. El crate
`windows` que entra por el plugin de notificaciones, compilado con `debuginfo=2`,
hace que **rustc desborde su propia pila** en Windows y muera con
`STATUS_STACK_BUFFER_OVERRUN`. Sin esa línea la etapa 3 no compila.

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
arranca con defaults y se reescribe, **nunca** rompe el arranque.

Cambiar el intervalo mientras el temporizador corre **no** reinicia el ciclo: solo
afecta al próximo `Running`.

> **Decisión de Manu, 2026-09-02.** Esto **reemplaza** el comportamiento de la
> etapa 2, donde `timer_set_interval` reiniciaba el ciclo. El motivo: cambiar un
> ajuste no puede destruir tiempo ya invertido — es la misma familia que "cambiar
> de modo nunca reinicia la cuenta" (CLAUDE.md §2). De paso desaparece la
> excepción para `Elapsed` que la etapa 2 necesitaba para no borrar una
> confirmación pendiente por la puerta de atrás.
>
> Efecto lateral conocido y aceptado: la rama de despertar-tardío de `advance`
> mide contra el intervalo **vigente**, así que bajar el intervalo y después
> suspender la PC puede convertir en reinicio silencioso un caso que antes
> avisaba. Es un borde raro y blindarlo obligaría a arrastrar el intervalo con el
> que nació cada ciclo.
>
> Alternativa descartada, anotada por si el uso real la pide: reencuadrar el
> ciclo preservando lo corrido (`deadline = inicio_del_ciclo + intervalo_nuevo`,
> acotado a "ahora"), que da efecto inmediato **y** no pierde tiempo, a cambio de
> más lógica y más tests.

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
  altera el `deadline_ms` en curso
  (`changing_the_interval_leaves_the_running_cycle_alone`), ni se lleva puesta
  una confirmación pendiente
  (`changing_the_interval_does_not_swallow_a_pending_confirmation`).
- **Bandeja, notificación, instancia única y autostart: verificación manual.** No
  hay forma honesta de automatizarlos acá, y simular el registro de Windows
  costaría más que la checklist.

## Verificación manual

Con `pnpm tauri dev`. Para que la espera sea corta, empezar bajando el intervalo
a 1 minuto desde la pantalla de ajustes.

**Bandeja y ciclo de vida**

- [ ] Icono del mojón visible en la bandeja, con los cuatro grupos del menú:
      los tres modos (deshabilitados), pausar/reanudar, Ajustes y Salir.
- [ ] Cerrar con la X → la ventana desaparece, el icono sigue en la bandeja y el
      contador **no se reinició** (verificable al reabrir desde "Ajustes").
- [ ] "Ajustes" en la bandeja con la ventana escondida **y minimizada** → la trae
      al frente en los dos casos (es el orden `show → unminimize → set_focus`).
- [ ] "Salir" → el proceso `Cairn.exe` desaparece del Administrador de tareas.
- [ ] Doble clic al `.exe` con la app ya abierta → **no** aparece una segunda
      instancia; se trae la existente al frente.

**Bandeja y estado compartido**

- [ ] Pausar desde la bandeja → el ítem pasa a decir "Reanudar" **y** la ventana
      muestra "temporizador detenido". Reanudar desde la ventana → el ítem vuelve
      a "Pausar" solo.
- [ ] Con el temporizador vencido, el ítem de pausa queda **deshabilitado**.

**Notificación**

- [ ] ~~Al vencer aparece la notificación de Windows~~ — **ya no aplica**, ver
      la nota del final. Lo que aparece al vencer es la pantalla de Foco.
- [ ] (histórico) Al vencer aparecía la notificación de Windows con "Cairn" y
      "Es hora de una pausa.".
- [ ] Apretar un botón justo en el segundo del vencimiento **igual** notifica.

**Ajustes**

- [ ] Cambiar el intervalo con el ciclo corriendo → el contador en pantalla
      **no salta**: sigue bajando desde donde estaba. El intervalo nuevo recién
      se usa al apretar LISTO.
- [ ] Cambiar el intervalo, cerrar la app desde la bandeja y reabrir → persiste.
- [ ] `%APPDATA%\com.kobyuu.cairn\store.json` existe desde el primer arranque y
      se puede abrir con el Bloc de Notas.
- [ ] Borrar `store.json` a mano y abrir → arranca con 45 min, sin error.
- [ ] Escribir basura adentro (`{"interval_min": "hola"}`) → arranca con 45 y lo
      reescribe, sin perder los otros ajustes.
- [ ] Autostart on → reiniciar Windows → arranca. Autostart off → no arranca.
- [ ] Con autostart en on, sacar la entrada a mano desde el Administrador de
      tareas → reabrir Ajustes muestra el interruptor **apagado** (lee el
      registro, no el JSON).

**Diseño** (`docs/DESIGN.md`)

- [ ] Los halos respiran juntos, desfasados, y el arco de acento gira despacio.
- [ ] El contador no baila al cambiar de cifra (`tabular-nums`).
- [ ] `LISTO` está **en el mismo píxel** contando, en pausa y vencido.
- [ ] Con "Mostrar animaciones en Windows" apagado, los halos quedan quietos
      pero visibles, no desaparecen.

## Límites

- **Sabido y aceptado:** `tauri-plugin-store` guarda con un `fs::write` pelado,
  **sin temporal + rename**, así que la regla de escritura atómica de CLAUDE.md §3
  no aplica a `store.json` — un corte de luz a mitad puede truncarlo. Está
  mitigado de verdad: `Settings::from_json` tolera cualquier basura y cae a los
  defaults, así que el arranque nunca se rompe; lo que se pierde son los ajustes.
  La regla sí aplica, y sin excepción, a `notes/routine.md` en la etapa 5.
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

---

## Nota de la etapa 6: se quitó la notificación del sistema

`tauri-plugin-notification` y el toast al vencer salieron del proyecto en la
etapa 6, con su dependencia de Cargo. Dos razones que se suman:

1. **Es redundante.** El toast aparecía en el mismo instante en que la pantalla
   de Foco tapa el monitor entero, o sea un aviso encima del aviso.
2. **~~Sale con la identidad de PowerShell.~~ Resuelto por #16.** Un toast de
   Windows necesita un `AppUserModelID` registrado por un instalador. Cuando se
   escribió esto Cairn no tenía; desde #16 el instalador NSIS lo registra con
   `com.kobyuu.cairn` (`docs/specs/SPEC-distribution.md` §5). **La razón 1 sigue
   en pie y sola alcanza**: el toast sería un aviso encima del aviso. Si algún
   día se decide "avisar sin taparte", ya no hay impedimento técnico.

El aviso de Cairn **es** la pantalla de Foco, más el tono de `src/sound.ts` si
el interruptor de Ajustes está encendido. Un toast propio sólo tendría sentido
como *alternativa* a que Foco tome la pantalla, y eso es una decisión de
producto que todavía no se tomó. Detalle en `docs/DESIGN.md` §7.
