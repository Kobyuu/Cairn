# Cairn — Diseño

Fecha: 2026-09-02
Estado: aprobado (decisiones de arquitectura), pendiente plan de implementación

## Qué es

App de escritorio para Windows 10/11 que cada N minutos (45 por defecto) avisa
que es hora de una pausa. El ciclo se reinicia solo cuando el usuario confirma
que terminó. El intervalo es configurable, así que también sirve como pomodoro
o para cronometrar cualquier otra cosa.

Stack: Tauri v2 + React + TypeScript + Vite + Tailwind v4. Target: solo Windows.

## Decisiones de arquitectura

### D1 — El estado del temporizador vive en el core de Rust

Las ventanas son vistas que se suscriben a eventos. Razones:

1. El menú de la bandeja es Rust puro y muta el temporizador (pausar/reanudar).
   Con el estado en JS habría que hacer Rust → evento → JS → invoke → Rust, y
   se rompe si en ese momento no hay ninguna ventana con JS vivo.
2. WebView2 estrangula los timers de JS en ventanas ocultas. En cualquier modo
   hay al menos dos ventanas escondidas.
3. Cambiar de modo no debe reiniciar la cuenta. Con el estado en Rust las
   ventanas son intercambiables sin consecuencia.

Estado completo:

```rust
enum Phase {
    Idle,
    Running  { deadline_ms: u64 },   // instante de vencimiento, epoch Unix ms
    Paused   { remaining_ms: u64 },
    Elapsed  { since_ms: u64 },      // cronómetro ascendente de la pausa
}
```

### D2 — Reloj: hora de pared, no monotónico

`deadline_ms` es `SystemTime` → ms desde epoch Unix.

- `Instant` en Windows es `QueryPerformanceCounter` y NO avanza durante la
  suspensión. Con `Instant`, dormir 2h dejaría el temporizador intacto.
- Epoch-ms cruza a JS y se compara directo contra `Date.now()`: mismo dominio
  de reloj, sin conversiones ni dependencia de `chrono`.
- Guarda contra saltos de reloj (NTP, cambio manual): si
  `remaining > interval`, recortar a `interval`.

Un solo hilo en Rust chequea a 1 Hz si `now >= deadline`. NO emite el countdown
cada segundo: emite eventos solo en transiciones (started / paused / resumed /
elapsed / reset / settings-changed). Cada ventana deriva su propio contador
localmente restando `deadline_ms - Date.now()`. No hay acumulación de error
porque no hay acumulación.

### D3 — Al despertar de la suspensión

- Si `now - deadline > interval`: el usuario estuvo ausente más de un ciclo
  completo. Suspender la PC ya es una pausa. Reiniciar el ciclo en silencio,
  sin notificación y sin entrar a Foco.
- Si `now - deadline <= interval`: entrar a Foco normalmente, mostrando
  "vencido hace X". El cronómetro ascendente arranca desde `deadline`, no
  desde `now`, así que mide el atraso real.

### D4 — Tres ventanas de Tauri, no una reconfigurada

Argumento decisivo, verificado en el código fuente: **`transparent` no se
puede cambiar en caliente en Windows**. La API de ventanas de Tauri v2 expone
`set_decorations`, `set_shadow`, `set_skip_taskbar`, `set_always_on_top`,
`set_ignore_cursor_events`, `set_focusable`, `set_fullscreen` — pero no existe
`set_transparent`. En tao la transparencia se aplica al crear el `HWND`
(región DWM vacía + flag `WindowFlags::TRANSPARENT`).

AMBIENTE necesita transparente; FOCO necesita opaco y enfocable. Una sola
ventana implicaría destruir y recrear en cada cambio de modo.

Costo mitigado: las tres ventanas cargan **el mismo bundle**
(`index.html?view=foco|widget|ambient`). Un build de Vite, un árbol de React,
un switch en `main.tsx`. El costo extra es de instancias de WebView2
(~40-70 MB), no de código. A cambio: cambio de modo = `show()`/`hide()`,
instantáneo, y el widget recuerda su posición sin código porque es su propia
ventana.

Ajustes es una cuarta ventana creada bajo demanda con `WebviewWindowBuilder` y
destruida al cerrarse. Arranque = 3 webviews.

### D5 — FOCO: sin bordes, maximizada al tamaño del monitor

No `set_fullscreen(true)`. Cubre la pantalla incluida la barra de tareas pero
sin el modo fullscreen del sistema: aparece y desaparece al instante, no
reordena otras ventanas, y convive bien con always-on-top.

### D6 — AMBIENTE: monitor primario, geometría en píxeles físicos

Monitor primario, recalculado si cambia la configuración de pantallas. La
franja es percepción periférica: un indicador que salta de monitor según dónde
esté el mouse deja de ser mirable. Seguir el cursor exigiría pollear la
posición del mouse y mover la ventana constantemente.

DPI — todo en físicos:

```rust
let m = app.primary_monitor()?.unwrap();
let s = m.scale_factor();
win.set_position(PhysicalPosition::new(m.position().x, m.position().y))?;
win.set_size(PhysicalSize::new(m.size().width, (4.0 * s).round() as u32))?;
```

`Monitor` da `position()`/`size()` en físicos más `scale_factor()`. Con
`LogicalSize`, Tauri multiplica por la escala *de la ventana en ese momento*,
que puede no ser todavía la del monitor destino. El alto de 4px se multiplica
a mano para que sean 4 px visuales al 100% y al 150%.

Config de la ventana: `transparent`, `decorations: false`, `shadow: false`,
`skipTaskbar: true`, `alwaysOnTop: true`, `focus: false`, `resizable: false`,
y en runtime `set_ignore_cursor_events(true)`.

Limitación conocida: una app en fullscreen exclusivo (juego, video) tapa la
franja. No hay solución sin un overlay a nivel driver.

### D7 — Foco de ventana en Windows: Tauri ya lo resuelve

Windows bloquea `SetForegroundWindow` desde procesos que no son el de primer
plano. `set_focus` de tao trae el workaround:

```rust
unsafe fn force_window_active(handle: HWND) {
  if SetForegroundWindow(handle).as_bool() { return; }
  SendInput(&inputs, ...);          // ALT izquierdo sintético
  let _ = SetForegroundWindow(handle);
}
```

Dos consecuencias:

1. No hay que escribir Win32 propio. `set_focus()` alcanza, tanto para el
   vencimiento como para el plugin de instancia única.
2. **El orden importa.** `set_focus` en tao arranca con
   `if is_visible && !is_minimized && !is_foreground` — es un no-op si la
   ventana está oculta o minimizada. Siempre:
   `show()` → `unminimize()` → `set_focus()`.

### D8 — Almacenamiento de la rutina

`%APPDATA%\<app>\notes\routine.md`: un `.md` real dentro de un **directorio**
de notas, no un archivo suelto ni una cadena en la config. La etapa 2 (espacio
tipo Notion mínimo) es "más archivos en `notes/`" más, si hace falta, un
índice. Cero migración.

`store.json` guarda solo ajustes: `interval_min`, `default_mode`,
`quick_snooze_min`, `widget_pos`, `autostart`, `theme`.

## Estructura de archivos

```
Cairn/
├─ index.html
├─ package.json  vite.config.ts  tsconfig.json
├─ src/                                # un bundle para las 3 ventanas
│  ├─ main.tsx                         # lee ?view= y monta la vista
│  ├─ index.css                        # tailwind
│  ├─ useTimer.ts                      # eventos de Rust → restante derivado
│  ├─ useSettings.ts
│  └─ views/
│     ├─ Foco.tsx  Widget.tsx  Ambient.tsx  Settings.tsx
│     └─ Routine.tsx                   # etapa 5
└─ src-tauri/
   ├─ tauri.conf.json                  # las 3 ventanas declaradas
   ├─ Cargo.toml
   ├─ capabilities/default.json
   └─ src/
      ├─ main.rs                       # shim generado
      ├─ lib.rs                        # builder, plugins, setup, bandeja
      ├─ timer.rs                      # máquina de estados + hilo 1 Hz
      ├─ modes.rs                      # show/hide, geometría, monitor
      ├─ settings.rs                   # envoltorio de tauri-plugin-store
      └─ routine.rs                    # etapa 5
```

## Dependencias

Rust: `tauri` (feature `tray-icon`), `tauri-plugin-store`,
`tauri-plugin-notification`, `tauri-plugin-single-instance`,
`tauri-plugin-autostart`, `serde`, `serde_json`.
Explícitamente NO: `chrono` (epoch-ms de stdlib alcanza), `once_cell`
(`app.manage()` + `Mutex` de stdlib).

JS: react, react-dom, vite, typescript, tailwind v4 (`@tailwindcss/vite`),
`@tauri-apps/api` + los paquetes JS de los plugins que se llamen desde el
frontend.

Etapa 5: `react-markdown` + `remark-gfm`. `remark-gfm` da las listas con
casillas (`- [ ]` / `- [x]`). Edición con `<textarea>` pelado; marcar una
casilla en la vista renderizada es voltear `[ ]`↔`[x]` en el fuente por
índice. Sin editor WYSIWYG.

## Etapas

1. Proyecto andando: Tauri v2 + React + TS + Tailwind, una ventana, hola
   mundo, compila un `.exe`.
2. Lógica del temporizador con UI mínima. Ciclo completo: cuenta, vence,
   confirmo, reinicia. Incluye posponer (rápido y arbitrario).
3. Bandeja, instancia única, persistencia de ajustes, autostart.
4. Los tres modos y la conmutación. Foco → Widget → Ambiente, en ese orden.
5. Rutina en markdown: leer, renderizar, editar, guardar.
6. Diseño real (lo trae el usuario aparte).

## Fuera de alcance (etapa 2, no bloquear)

La rutina crece hacia un espacio de notas/tareas/recordatorios en markdown,
estilo Notion mínimo. D8 lo deja abierto sin migración.
