# Plan de ejecución — Etapa 2 `timer-core`

Spec: [`../specs/SPEC-timer-core.md`](../specs/SPEC-timer-core.md) · Diseño: `../architecture.md` §D1–D3

## Contrato del wire (lo fija este plan, lo consumen Rust y TS)

```jsonc
// evento "timer-changed" y retorno de invoke("timer_snapshot")
{
  "phase": { "kind": "running", "deadlineMs": 1767225600000 },
  "intervalMs": 2700000,
  "quickSnoozeMs": 300000
}
```

`phase.kind` ∈ `idle` | `running` (`deadlineMs`) | `paused` (`remainingMs`) |
`elapsed` (`sinceMs`). Todos los tiempos son `u64` de epoch Unix en ms o
duraciones en ms — mismo dominio que `Date.now()`, sin conversiones.

Comandos: `timer_snapshot`, `timer_pause`, `timer_resume`, `timer_reset`,
`timer_snooze(minutes?: number)`, `timer_set_interval(minutes: number)`.

## Tareas

Agrupadas **por archivo** (CLAUDE.md §10.2), no por concepto.

### T1 — `src-tauri/src/timer.rs`: funciones puras + tests (TDD)

Primero las 10 filas de la tabla de la spec como `#[test]` **en rojo**, después
las ramas que las satisfacen.

```rust
pub enum Phase { Idle, Running { deadline_ms }, Paused { remaining_ms }, Elapsed { since_ms } }

pub fn advance(phase, interval_ms, now_ms) -> Phase   // el tick de 1 Hz
pub fn pause(phase, now_ms) -> Phase
pub fn resume(phase, now_ms) -> Phase
pub fn restart(interval_ms, now_ms) -> Phase          // "Listo" y "Reiniciar"
pub fn snooze(snooze_ms, now_ms) -> Phase
```

`advance` concentra las dos guardas del reloj:

- `now >= deadline` y `now - deadline > interval` → reinicio silencioso (D3 rama larga).
- `now >= deadline` y `now - deadline <= interval` → `Elapsed { since_ms: deadline }`
  (el cronómetro cuenta desde el vencimiento, no desde el despertar).
- `now < deadline` y `deadline - now > interval` → el reloj saltó para atrás:
  se rebasa el deadline a `now + interval` (D2). Se recorta **el estado**, no
  solo una vista: el frontend deriva su contador de `deadlineMs`, así que un
  clamp que viviera en un getter de Rust no lo protegería.

**Criterio de aceptación:** las 10 filas de la spec en verde con
`cargo test --manifest-path src-tauri/Cargo.toml`. Ningún test duerme el hilo.

### T2 — `src-tauri/src/timer.rs` (cont.) + `lib.rs`: estado, comandos, hilo

`TimerState { phase, interval_ms, quick_snooze_ms }` detrás de un
`Mutex`, registrado con `app.manage(...)`. Los comandos hacen siempre
`advance` **antes** de aplicar la acción: así ninguna acción parte de un
deadline corrompido por un salto de reloj, y `pause` puede ser una resta pelada.

Hilo de 1 Hz en `setup()`: duerme 1 s, toma el lock, corre `advance`, y **solo
si el `Phase` cambió** suelta el lock y emite el snapshot. Sin countdown por IPC.

Default: 45 min de intervalo, 5 min de posponer rápido. El estado nace `Idle` y
`setup()` lo arranca con el reloj real (no hay `SystemTime::now()` en un `const`).

Cambiar el intervalo **reinicia** el ciclo con el nuevo valor — el deadline
viejo dejó de significar algo. _(Decisión de implementación, anotada, no consultada.)_

**Criterio:** `cargo clippy -- -D warnings` limpio; la app levanta y
`invoke("timer_snapshot")` devuelve el snapshot.

### T3 — `src/timer.ts` + `src/timer.test.ts`: derivación y formateo (TDD)

Tests primero: `remainingMs` nunca negativo, `formatDuration` exacto en
`00:00` / `44:59` / `1:00:00`, y el cronómetro ascendente crece con `now`.

```ts
remainingMs(phase, now)  // running: max(0, deadlineMs - now); paused: remainingMs; resto: 0
elapsedMs(phase, now)    // elapsed: max(0, now - sinceMs); resto: 0
formatDuration(ms)       // mm:ss, y h:mm:ss a partir de la hora
```

**Criterio:** `pnpm test` verde.

### T4 — `src/useTimer.ts` + `src/App.tsx`: hook y UI fea

`useTimer` hace `invoke("timer_snapshot")` una vez, se suscribe con
`listen("timer-changed")`, y mantiene un `now` propio que se refresca cada
250 ms. Ese intervalo **no acumula**: reasigna `Date.now()`. La resta contra
`deadlineMs` es la única fuente del restante.

UI: el tiempo grande, el `kind` en texto, y botones Pausar / Reanudar /
Reiniciar / Listo / Posponer 5 / Posponer N + input de intervalo. Fea a
propósito (§5): el diseño llega en la etapa 6.

**Criterio:** el ciclo completo se maneja desde la ventana.

### T5 — Verificación completa

Los cinco comandos de §7 en verde, **una sola vez**, al final. Después la
checklist manual de la spec para Manu.

## Lo que esta etapa NO hace

Bandeja, notificación del sistema, persistencia de ajustes, los tres modos.
Al reiniciar la app el temporizador vuelve a 45 min desde cero — la
persistencia es etapa 3.
