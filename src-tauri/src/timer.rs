//! Maquina de estados del temporizador.
//!
//! Todo lo de este archivo es aritmetica pura sobre `u64` de epoch Unix en
//! milisegundos, con el "ahora" **inyectado como parametro**. Es a proposito:
//! asi se puede testear el vencimiento, el despertar de la suspension y un
//! salto de reloj sin dormir el hilo ni tocar el reloj real.

use serde::Serialize;
use std::sync::Mutex;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter, Manager, State};

/// Nombre del evento que el core emite hacia las ventanas en cada transicion.
/// Nunca lleva el countdown: cada ventana deriva su contador restando
/// `deadline_ms - Date.now()`, asi que no hay IPC por segundo (D2).
pub const EVENT_CHANGED: &str = "timer-changed";

const MS_PER_MIN: u64 = 60_000;
const DEFAULT_INTERVAL_MIN: u64 = 45;
const DEFAULT_QUICK_SNOOZE_MIN: u64 = 5;
/// Tope de 24 h: acota lo que puede mandar el frontend y de paso evita que la
/// multiplicacion a milisegundos desborde.
const MAX_MIN: u64 = 24 * 60;

const POISONED: &str = "el estado del temporizador quedo envenenado";

/// Fase del ciclo. Es un `enum` con datos adentro y no un puñado de flags
/// sueltos (`is_running`, `is_paused`, ...) porque cada fase necesita un dato
/// distinto y ninguna combinacion invalida deberia poder existir: no hay forma
/// de estar `Paused` y tener un `deadline_ms` al mismo tiempo.
///
/// Sale al frontend como una union discriminada, `{"kind":"running","deadlineMs":N}`.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(tag = "kind", rename_all = "camelCase", rename_all_fields = "camelCase")]
pub enum Phase {
    /// Sin ciclo en curso. Es el estado con el que nace el proceso, antes de
    /// que `setup()` pueda leer el reloj real.
    Idle,
    /// Contando hacia `deadline_ms` (epoch Unix en ms, hora de pared).
    ///
    /// `cycle_ms` es cuanto dura ESTE ciclo, que no siempre es el intervalo
    /// configurado: posponer 5 min con un intervalo de 45 abre un ciclo de 5.
    /// Se guarda porque es la unica cota legitima contra la que se puede medir
    /// un salto de reloj hacia atras; medir contra el intervalo se comia los
    /// posponer mas largos que el. No sale al frontend porque todavia nadie lo
    /// usa — la etapa 6 lo va a querer para el ultimo 10% del ciclo (D6).
    Running {
        deadline_ms: u64,
        #[serde(skip)]
        cycle_ms: u64,
    },
    /// Congelado: al reanudar el deadline se recalcula desde el "ahora".
    Paused { remaining_ms: u64 },
    /// Vencido. `since_ms` es el instante del vencimiento, no el del aviso:
    /// el cronometro ascendente mide el atraso real (D3).
    Elapsed { since_ms: u64 },
}

/// El tick de 1 Hz. Devuelve la fase que corresponde a `now_ms`.
///
/// Es la unica funcion que reacciona al paso del tiempo, y por eso concentra
/// las guardas del reloj. Es idempotente: llamarla mil veces con el mismo
/// `now_ms` da el mismo resultado, asi que el hilo puede llamarla sin miedo.
///
/// Ojo con los dos parametros de duracion: el vencimiento tardio se mide contra
/// `interval_ms` (D3 habla de "mas de un **intervalo**" ausente), pero el salto
/// de reloj se mide contra el `cycle_ms` del ciclo en curso, que puede ser mas
/// largo si el usuario pospuso.
pub fn advance(phase: Phase, interval_ms: u64, now_ms: u64) -> Phase {
    match phase {
        Phase::Running { deadline_ms, .. } if now_ms >= deadline_ms => {
            if now_ms - deadline_ms > interval_ms {
                // Estuvo ausente mas de un ciclo entero: suspender la PC ya fue
                // una pausa. Se reinicia en silencio, sin aviso (D3, rama larga).
                restart(interval_ms, now_ms)
            } else {
                // El cronometro ascendente arranca en el vencimiento, no en el
                // despertar, para que mida el atraso real (D3, rama corta).
                Phase::Elapsed { since_ms: deadline_ms }
            }
        }
        // Llegar aca implica `now_ms < deadline_ms` (lo garantiza la guarda de
        // arriba), asi que la resta no puede desbordar por abajo. Aun asi va
        // `saturating_sub`: la invariante depende del ORDEN de los brazos, y
        // eso no lo protege ningun compilador si alguien mete uno en el medio.
        Phase::Running { deadline_ms, cycle_ms }
            if deadline_ms.saturating_sub(now_ms) > cycle_ms =>
        {
            // El reloj salto para atras (NTP o cambio manual) y quedo un
            // restante mas largo que el ciclo entero. Se recorta rebasando el
            // deadline, es decir corrigiendo el ESTADO y no una vista: las
            // ventanas derivan su contador de `deadline_ms`, asi que un clamp
            // que viviera solo en un getter de Rust no las protegeria (D2).
            Phase::Running { deadline_ms: now_ms + cycle_ms, cycle_ms }
        }
        // `Elapsed` cae aca a proposito: vencido se queda vencido hasta que el
        // usuario confirme o posponga. Es la regla de producto de CLAUDE.md §2.
        other => other,
    }
}

/// Congela el restante. No hace nada si la fase no estaba corriendo.
pub fn pause(phase: Phase, now_ms: u64) -> Phase {
    match phase {
        Phase::Running { deadline_ms, .. } => Phase::Paused {
            remaining_ms: deadline_ms.saturating_sub(now_ms),
        },
        other => other,
    }
}

/// Reanuda rebasando el deadline desde `now_ms`.
///
/// El ciclo que se reanuda vale lo que le quedaba: si se pospuso 60 min y se
/// pauso con 50 por delante, el ciclo reanudado dura 50. Alcanza para que el
/// clamp de `advance` siga teniendo una cota honesta y evita arrastrar el largo
/// original a traves de `Paused`.
pub fn resume(phase: Phase, now_ms: u64) -> Phase {
    match phase {
        Phase::Paused { remaining_ms } => Phase::Running {
            deadline_ms: now_ms + remaining_ms,
            cycle_ms: remaining_ms,
        },
        other => other,
    }
}

/// Arranca un ciclo entero desde cero. Es a la vez "Listo" y "Reiniciar".
pub fn restart(interval_ms: u64, now_ms: u64) -> Phase {
    Phase::Running {
        deadline_ms: now_ms + interval_ms,
        cycle_ms: interval_ms,
    }
}

/// Pospone: un ciclo nuevo, mas corto o mas largo, contado desde `now_ms`.
///
/// Sumar desde el "ahora" y no restar contra el vencimiento viejo es lo que
/// hace que posponer sea trivialmente correcto: no hay resta inversa que
/// pueda dar negativo (SPEC-timer-core, conflicto resuelto con el handoff).
pub fn snooze(snooze_ms: u64, now_ms: u64) -> Phase {
    Phase::Running {
        deadline_ms: now_ms + snooze_ms,
        cycle_ms: snooze_ms,
    }
}

// ---------------------------------------------------------------------------
// Estado compartido, comandos y el hilo de 1 Hz.
//
// Todo lo de arriba es puro y testeable; todo lo de aca abajo es plomeria que
// le pasa el reloj real a esas funciones. La division es a proposito: la
// aritmetica se testea, la plomeria se verifica a mano.
// ---------------------------------------------------------------------------

/// El estado completo del ciclo. Es lo que viaja al frontend en cada evento.
#[derive(Clone, Copy, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TimerState {
    pub phase: Phase,
    pub interval_ms: u64,
    pub quick_snooze_ms: u64,
}

impl Default for TimerState {
    fn default() -> Self {
        Self {
            phase: Phase::Idle,
            interval_ms: DEFAULT_INTERVAL_MIN * MS_PER_MIN,
            quick_snooze_ms: DEFAULT_QUICK_SNOOZE_MIN * MS_PER_MIN,
        }
    }
}

/// Estado inicial con el ciclo ya arrancado.
///
/// `Default` nace `Idle` porque no se puede leer el reloj en una constante; el
/// ciclo arranca aca, desde `setup()`, con la hora de pared real.
pub fn initial_state() -> TimerState {
    let defaults = TimerState::default();
    TimerState {
        phase: restart(defaults.interval_ms, now_ms()),
        ..defaults
    }
}

/// El "ahora" en epoch Unix ms.
///
/// Hora de pared a proposito, no `std::time::Instant`: en Windows `Instant` es
/// `QueryPerformanceCounter` y NO avanza mientras la maquina duerme, asi que
/// suspender dos horas dejaria el temporizador intacto (D2).
fn now_ms() -> u64 {
    match SystemTime::now().duration_since(UNIX_EPOCH) {
        Ok(elapsed) => elapsed.as_millis() as u64,
        Err(error) => {
            // Solo pasa con el reloj del sistema antes de 1970. Si ocurre, todo
            // lo que sigue va a estar mal; que quede en la consola y no mudo.
            eprintln!("[cairn] el reloj del sistema esta antes de 1970: {error}");
            0
        }
    }
}

/// Convierte minutos del frontend a ms, acotados a un rango sano.
fn minutes_to_ms(minutes: u64) -> u64 {
    minutes.clamp(1, MAX_MIN) * MS_PER_MIN
}

/// Aplica una mutacion al estado y avisa a todas las ventanas.
///
/// Siempre corre `advance` **antes** de la accion pedida: asi ninguna accion
/// parte de un deadline corrompido por un salto de reloj, y funciones como
/// `pause` pueden ser una resta pelada sin volver a chequear nada.
fn mutate<F>(app: &AppHandle, apply: F) -> Result<TimerState, String>
where
    F: FnOnce(&mut TimerState, u64),
{
    let now = now_ms();
    let state = app.state::<Mutex<TimerState>>();
    let snapshot = {
        let mut guard = state.lock().map_err(|_| POISONED.to_string())?;
        guard.phase = advance(guard.phase, guard.interval_ms, now);
        apply(&mut guard, now);
        *guard
    };
    // El lock ya se solto: emitir cruza al webview y no hay razon para tener el
    // candado tomado mientras tanto.
    emit_changed(app, snapshot);
    Ok(snapshot)
}

/// Avisa a las ventanas. El error se loguea y no se propaga: el `emit` es el
/// unico canal por el que se entera el frontend (no hace polling), asi que si
/// falla no puede quedar sin rastro en ningun lado.
fn emit_changed(app: &AppHandle, snapshot: TimerState) {
    if let Err(error) = app.emit(EVENT_CHANGED, snapshot) {
        eprintln!("[cairn] no se pudo emitir {EVENT_CHANGED}: {error}");
    }
}

/// Lectura pura del estado, para que una ventana recien montada se sincronice.
/// No emite nada: el hilo de 1 Hz corrige cualquier atraso dentro del segundo.
#[tauri::command]
pub fn timer_snapshot(state: State<'_, Mutex<TimerState>>) -> Result<TimerState, String> {
    let guard = state.lock().map_err(|_| POISONED.to_string())?;
    Ok(*guard)
}

#[tauri::command]
pub fn timer_pause(app: AppHandle) -> Result<TimerState, String> {
    mutate(&app, |state, now| state.phase = pause(state.phase, now))
}

#[tauri::command]
pub fn timer_resume(app: AppHandle) -> Result<TimerState, String> {
    mutate(&app, |state, now| state.phase = resume(state.phase, now))
}

/// "Listo" y "Reiniciar" son la misma operacion: un ciclo entero desde cero.
#[tauri::command]
pub fn timer_reset(app: AppHandle) -> Result<TimerState, String> {
    mutate(&app, |state, now| {
        state.phase = restart(state.interval_ms, now)
    })
}

/// `minutes` en `None` significa posponer rapido, con el valor configurado.
#[tauri::command]
pub fn timer_snooze(app: AppHandle, minutes: Option<u64>) -> Result<TimerState, String> {
    mutate(&app, |state, now| {
        let snooze_ms = minutes.map_or(state.quick_snooze_ms, minutes_to_ms);
        state.phase = snooze(snooze_ms, now);
    })
}

#[tauri::command]
pub fn timer_set_interval(app: AppHandle, minutes: u64) -> Result<TimerState, String> {
    mutate(&app, |state, now| {
        state.interval_ms = minutes_to_ms(minutes);
        // Cambiar el intervalo reinicia el ciclo: el deadline viejo se calculo
        // con el intervalo anterior y ya no significa nada. La excepcion es
        // `Elapsed`: ahi hay una confirmacion pendiente, y confirmar es lo unico
        // que justifica la app entera (CLAUDE.md §2). Tocar un ajuste no puede
        // borrar el vencimiento por la puerta de atras.
        if !matches!(state.phase, Phase::Elapsed { .. }) {
            state.phase = restart(state.interval_ms, now);
        }
    })
}

/// Arranca el hilo que chequea el vencimiento una vez por segundo.
///
/// El hilo duerme; los tests no. Toda la logica que ejecuta esta en `advance`,
/// que es pura y se testea inyectando el "ahora". Emite **solo** cuando la fase
/// cambio de verdad, nunca el countdown.
pub fn spawn_ticker(app: AppHandle) {
    std::thread::spawn(move || loop {
        std::thread::sleep(Duration::from_secs(1));

        let now = now_ms();
        // Si el ticker muere, el temporizador se congela para siempre y nadie
        // se entera: la ventana sigue descontando sola contra `deadline_ms`,
        // llega a 00:00 y nunca pasa a `Elapsed`. Por eso ninguna salida de
        // este loop es silenciosa, y la unica recuperable usa `continue`.
        let Some(state) = app.try_state::<Mutex<TimerState>>() else {
            // No deberia pasar: `manage()` corre antes de spawnear el hilo.
            eprintln!("[cairn] el estado del temporizador no esta registrado");
            continue;
        };
        let Ok(mut guard) = state.lock() else {
            // Mutex envenenado: algun hilo entro en panico con el lock tomado.
            // El estado dejo de ser confiable, asi que el ticker se retira.
            eprintln!("[cairn] {POISONED}; el ticker se detiene");
            return;
        };

        let next = advance(guard.phase, guard.interval_ms, now);
        if next == guard.phase {
            continue;
        }
        guard.phase = next;
        let snapshot = *guard;
        drop(guard);

        emit_changed(&app, snapshot);
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    const MIN: u64 = 60_000;
    const INTERVAL: u64 = 45 * MIN;
    /// Un epoch cualquiera, lejos de cero, para que un bug de signo se note.
    const T0: u64 = 1_767_225_600_000;

    #[test]
    fn running_before_deadline() {
        let phase = Phase::Running { deadline_ms: T0, cycle_ms: INTERVAL };
        assert_eq!(advance(phase, INTERVAL, T0 - 1), phase);
    }

    #[test]
    fn expires_at_exact_deadline() {
        let phase = Phase::Running { deadline_ms: T0, cycle_ms: INTERVAL };
        assert_eq!(advance(phase, INTERVAL, T0), Phase::Elapsed { since_ms: T0 });
    }

    #[test]
    fn wake_slightly_overdue() {
        let phase = Phase::Running { deadline_ms: T0, cycle_ms: INTERVAL };
        let now = T0 + INTERVAL / 2;
        assert_eq!(advance(phase, INTERVAL, now), Phase::Elapsed { since_ms: T0 });
    }

    #[test]
    fn wake_long_overdue_resets_silent() {
        let phase = Phase::Running { deadline_ms: T0, cycle_ms: INTERVAL };
        let now = T0 + INTERVAL + 1;
        assert_eq!(
            advance(phase, INTERVAL, now),
            Phase::Running { deadline_ms: now + INTERVAL, cycle_ms: INTERVAL }
        );
    }

    #[test]
    fn wake_exactly_one_interval_overdue_still_warns() {
        // El limite exacto entre las dos ramas de D3, y el caso mas facil de
        // disparar en la vida real. La condicion es `> interval`, estrictamente:
        // dormir exactamente un intervalo cae del lado corto y AVISA. Si alguien
        // cambia el `>` por `>=` en un refactor, D3 se invierte en silencio.
        let phase = Phase::Running { deadline_ms: T0, cycle_ms: INTERVAL };
        let now = T0 + INTERVAL;
        assert_eq!(advance(phase, INTERVAL, now), Phase::Elapsed { since_ms: T0 });

        // Un milisegundo mas y recien ahi reinicia en silencio.
        let now = T0 + INTERVAL + 1;
        assert_eq!(
            advance(phase, INTERVAL, now),
            Phase::Running { deadline_ms: now + INTERVAL, cycle_ms: INTERVAL }
        );
    }

    #[test]
    fn a_snooze_longer_than_the_interval_survives_the_tick() {
        // Regresion. El clamp anti-salto-de-reloj recortaba contra `interval_ms`,
        // asi que un posponer mas largo que el intervalo se comia solo al primer
        // tick. Con el intervalo en 1 min -el primer paso de la checklist
        // manual- "Posponer 5" duraba 1 minuto.
        let interval = MIN;
        let phase = snooze(5 * MIN, T0);
        assert_eq!(advance(phase, interval, T0), phase);
        assert_eq!(advance(phase, interval, T0 + 4 * MIN), phase);

        // Y con los defaults: posponer 60 min con un intervalo de 45.
        let phase = snooze(60 * MIN, T0);
        assert_eq!(advance(phase, INTERVAL, T0), phase);
    }

    #[test]
    fn a_resumed_long_cycle_survives_the_tick() {
        // Mismo agujero por la otra puerta: pausar y reanudar dentro de un
        // posponer largo no puede recortar el ciclo tampoco.
        let paused = pause(snooze(60 * MIN, T0), T0 + 5 * MIN);
        let phase = resume(paused, T0);
        assert_eq!(advance(phase, INTERVAL, T0), phase);
    }

    #[test]
    fn clock_jump_back_still_clamps_a_long_cycle() {
        // El clamp no desaparece: sigue protegiendo, ahora contra el largo del
        // ciclo EN CURSO en vez del intervalo nominal.
        let phase = snooze(60 * MIN, T0);
        let now = T0 - 30 * MIN;
        assert_eq!(advance(phase, INTERVAL, now), snooze(60 * MIN, now));
    }

    #[test]
    fn clock_jump_back_leaves_exactly_one_interval_alone() {
        // El otro lado del mismo filo: un restante de exactamente un intervalo
        // es legitimo (es un ciclo recien arrancado) y NO se toca.
        let phase = Phase::Running { deadline_ms: T0 + INTERVAL, cycle_ms: INTERVAL };
        assert_eq!(advance(phase, INTERVAL, T0), phase);
    }

    #[test]
    fn pause_freezes_remaining() {
        let phase = Phase::Running { deadline_ms: T0 + INTERVAL, cycle_ms: INTERVAL };
        assert_eq!(
            pause(phase, T0 + 10 * MIN),
            Phase::Paused { remaining_ms: 35 * MIN }
        );
    }

    #[test]
    fn resume_rebases_deadline() {
        let phase = Phase::Paused { remaining_ms: 35 * MIN };
        assert_eq!(
            resume(phase, T0),
            Phase::Running { deadline_ms: T0 + 35 * MIN, cycle_ms: 35 * MIN }
        );
    }

    #[test]
    fn snooze_extends_from_now() {
        assert_eq!(
            snooze(5 * MIN, T0),
            Phase::Running { deadline_ms: T0 + 5 * MIN, cycle_ms: 5 * MIN }
        );
    }

    #[test]
    fn snooze_arbitrary_minutes() {
        assert_eq!(
            snooze(17 * MIN, T0),
            Phase::Running { deadline_ms: T0 + 17 * MIN, cycle_ms: 17 * MIN }
        );
    }

    #[test]
    fn done_restarts_full_interval() {
        assert_eq!(
            restart(INTERVAL, T0),
            Phase::Running { deadline_ms: T0 + INTERVAL, cycle_ms: INTERVAL }
        );
    }

    #[test]
    fn clock_jump_back_clamps() {
        // El reloj retrocedio una hora (NTP o cambio manual): el deadline queda
        // a 1h45m, mas de un intervalo entero. El restante se recorta rebasando
        // el deadline, para que la ventana -que deriva de `deadline_ms`- vea el
        // valor corregido y no el podrido (D2).
        let phase = Phase::Running { deadline_ms: T0 + INTERVAL, cycle_ms: INTERVAL };
        let now = T0 - 60 * MIN;
        assert_eq!(
            advance(phase, INTERVAL, now),
            Phase::Running { deadline_ms: now + INTERVAL, cycle_ms: INTERVAL }
        );
    }

    // --- Casos que la tabla de la spec no lista pero que la maquina promete ---

    #[test]
    fn elapsed_never_restarts_by_itself() {
        // La regla de producto que justifica la app entera: vencido se queda
        // vencido hasta que el usuario confirme.
        let phase = Phase::Elapsed { since_ms: T0 };
        assert_eq!(advance(phase, INTERVAL, T0 + 10 * INTERVAL), phase);
    }

    #[test]
    fn paused_does_not_expire() {
        let phase = Phase::Paused { remaining_ms: 35 * MIN };
        assert_eq!(advance(phase, INTERVAL, T0 + 10 * INTERVAL), phase);
    }

    #[test]
    fn idle_stays_idle() {
        assert_eq!(advance(Phase::Idle, INTERVAL, T0), Phase::Idle);
    }

    #[test]
    fn pause_is_a_noop_off_running() {
        assert_eq!(pause(Phase::Idle, T0), Phase::Idle);
        let elapsed = Phase::Elapsed { since_ms: T0 };
        assert_eq!(pause(elapsed, T0), elapsed);
    }

    #[test]
    fn resume_is_a_noop_off_paused() {
        let running = Phase::Running { deadline_ms: T0, cycle_ms: INTERVAL };
        assert_eq!(resume(running, T0 + 1), running);
    }

    #[test]
    fn wire_format_matches_the_frontend_contract() {
        // El unico punto donde Rust y TypeScript pueden desincronizarse sin que
        // ningun compilador se queje: si serde renombra un campo, la ventana
        // muestra NaN y el build sigue verde. Este test clava el contrato.
        let state = TimerState {
            phase: Phase::Running { deadline_ms: T0, cycle_ms: INTERVAL },
            interval_ms: INTERVAL,
            quick_snooze_ms: 5 * MIN,
        };
        let json = serde_json::to_value(state).expect("el snapshot tiene que serializar");
        assert_eq!(
            json,
            serde_json::json!({
                "phase": { "kind": "running", "deadlineMs": T0 },
                "intervalMs": INTERVAL,
                "quickSnoozeMs": 5 * MIN,
            })
        );

        let idle = serde_json::to_value(Phase::Idle).expect("idle tiene que serializar");
        assert_eq!(idle, serde_json::json!({ "kind": "idle" }));

        let paused = serde_json::to_value(Phase::Paused { remaining_ms: MIN })
            .expect("paused tiene que serializar");
        assert_eq!(paused, serde_json::json!({ "kind": "paused", "remainingMs": MIN }));

        let elapsed =
            serde_json::to_value(Phase::Elapsed { since_ms: T0 }).expect("elapsed serializa");
        assert_eq!(elapsed, serde_json::json!({ "kind": "elapsed", "sinceMs": T0 }));
    }

    #[test]
    fn minutes_are_clamped_to_a_sane_range() {
        // El frontend es una entrada no confiable: un 0 dejaria un ciclo que
        // vence al instante, y un numero enorme desbordaria la multiplicacion.
        assert_eq!(minutes_to_ms(0), MIN);
        assert_eq!(minutes_to_ms(1), MIN);
        assert_eq!(minutes_to_ms(45), INTERVAL);
        // Los dos lados del tope, para que un off-by-one en el clamp se note.
        assert_eq!(minutes_to_ms(MAX_MIN), MAX_MIN * MIN);
        assert_eq!(minutes_to_ms(MAX_MIN + 1), MAX_MIN * MIN);
        assert_eq!(minutes_to_ms(u64::MAX), MAX_MIN * MIN);
    }
}
