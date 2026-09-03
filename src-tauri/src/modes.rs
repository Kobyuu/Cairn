//! Los tres modos de presencia: Foco, Widget y Ambiente.
//!
//! La idea que ordena el archivo: **el modo elegido y la ventana visible son
//! dos cosas distintas**. `Mode` es lo que eligio el usuario y lo que se guarda
//! en `store.json`; la ventana que se ve se DERIVA de el y de la fase del
//! temporizador, con una sola regla: vencido siempre muestra Foco. Asi "al
//! vencer aparece Foco, al confirmar vuelve a Ambiente" no necesita recordar
//! nada extra, y un vencimiento no puede pisar la preferencia guardada.
//!
//! Las tres ventanas se crean al arrancar y **nunca se recrean**: conmutar es
//! `show()` de una y `hide()` de las otras dos. La razon es D4: `transparent`
//! no se puede cambiar en caliente porque es un atributo de creacion del
//! `HWND`, y Ambiente lo necesita mientras Foco necesita lo contrario.
//!
//! ## Dos reglas de concurrencia que no son negociables
//!
//! 1. **Orden de los candados: primero el del temporizador, despues el de
//!    acá.** `sync` se llama desde `timer::announce`, que corre con el candado
//!    del temporizador TOMADO. Cualquier funcion de este archivo que necesite
//!    la fase tiene que leerla y soltar ese candado ANTES de tomar el de los
//!    modos (es lo que hace `set_mode`), o los dos ordenes se cruzan y se traba.
//!
//! 2. **Nada de getters de ventana con el candado del temporizador tomado.**
//!    Los setters de Tauri (`show`, `hide`, `set_position`, ...) mandan un
//!    mensaje al hilo principal y siguen de largo; los getters
//!    (`primary_monitor`, `outer_position`, `is_visible`) mandan el mensaje y
//!    **esperan la respuesta**. Si el ticker esperara al hilo principal con el
//!    candado tomado, y el hilo principal estuviera atendiendo un click que
//!    quiere ese mismo candado, los dos se quedan esperando para siempre.
//!    Por eso `sync` solo muestra y esconde, y toda la geometria vive en
//!    `align`, que se llama desde el hilo principal o desde el ticker sin
//!    ningun candado en la mano.
//!    (Verificado contra la fuente de `tauri-runtime-wry` 2.11.4: los setters
//!    son `send_user_message` a secas, los getters son la macro `window_getter`
//!    con un canal de vuelta.)

use std::sync::Mutex;

use tauri::{AppHandle, Manager, PhysicalPosition, PhysicalSize, WebviewWindow};

use crate::settings::{self, Settings, WidgetPos};
use crate::timer::Phase;

/// Alto **reservado** de la ventana de Ambiente, en px CSS.
///
/// La franja mide 3 px casi todo el ciclo y 5 px en el ultimo 10 %, pero la
/// ventana se crea directamente de 5 y el cambio de grosor lo hace el CSS
/// adentro. Es la diferencia entre redimensionar una ventana always-on-top a
/// mitad del ciclo -que parpadea y hay que sincronizar con el frontend- y
/// cambiar una altura en un div. Los 2 px de sobra son transparentes y la
/// ventana no recibe clicks, asi que no molestan a nada.
const AMBIENT_HEIGHT_CSS: f64 = 5.0;

/// Margen del widget contra el borde del monitor la primera vez, en px CSS.
const WIDGET_MARGIN_CSS: f64 = 24.0;

const POISONED: &str = "el estado de los modos quedo envenenado";

/// Los tres modos. El valor de `label` es a la vez el label de la ventana de
/// Tauri, el `?view=` del bundle y lo que se guarda en `default_mode`: un solo
/// string para las tres cosas, para que no haya tres tablas que sincronizar.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Mode {
    Focus,
    Widget,
    Ambient,
}

impl Mode {
    pub const ALL: [Mode; 3] = [Mode::Focus, Mode::Widget, Mode::Ambient];

    pub fn label(self) -> &'static str {
        match self {
            Mode::Focus => "foco",
            Mode::Widget => "widget",
            Mode::Ambient => "ambient",
        }
    }

    /// `settings.rs` ya valida el string contra la misma lista, asi que un
    /// `None` aca significa que las dos listas se desincronizaron.
    pub fn from_label(label: &str) -> Option<Self> {
        Self::ALL.into_iter().find(|mode| mode.label() == label)
    }
}

/// Rectangulo en pixeles **fisicos**: `(x, y, ancho, alto)`.
///
/// Fisicos sin excepcion (D6). `Monitor::position()` y `size()` ya vienen en
/// fisicos y el factor de escala llega aparte; con `LogicalSize` Tauri
/// multiplica por la escala de la ventana EN ESE MOMENTO, que puede no ser
/// todavia la del monitor al que la estamos mandando.
pub type Rect = (i32, i32, u32, u32);

/// La geometria de la franja de Ambiente, como funcion pura.
///
/// El alto se multiplica a mano por la escala para que mida lo mismo en
/// pantalla al 100 % y al 150 %. El `x` puede ser negativo -un monitor a la
/// izquierda del primario tiene coordenadas negativas en Windows-, y por eso la
/// posicion viaja en `i32` de punta a punta: un `as u32` descuidado ahi manda
/// la ventana a cuatro mil millones de pixeles de distancia.
pub fn ambient_rect(
    monitor_pos: (i32, i32),
    monitor_size: (u32, u32),
    scale: f64,
    height_css: f64,
) -> Rect {
    // `f64::max` devuelve el operando que NO es NaN, asi que una escala rota
    // termina en 1 px y no en una ventana de alto cero.
    let height = (height_css * scale).round().max(1.0) as u32;
    (monitor_pos.0, monitor_pos.1, monitor_size.0, height)
}

/// La ventana que corresponde ver, dados el modo elegido y la fase.
///
/// Recibe la fase **por valor** y devuelve un `Mode`: no hay forma de que esta
/// funcion -ni ninguna otra de este archivo- toque el temporizador. Es la regla
/// inquebrantable de CLAUDE.md §2 expresada en la firma, no en un comentario.
pub fn visible_mode(mode: Mode, phase: Phase) -> Mode {
    match phase {
        // Vencido interrumpe: es el unico momento en que la app tiene derecho a
        // taparte la pantalla, y para eso existe.
        Phase::Elapsed { .. } => Mode::Focus,
        _ => mode,
    }
}

/// Lo unico que hay que recordar entre llamadas.
struct ModeState {
    /// El modo que eligio el usuario, no el que se ve.
    mode: Mode,
    /// Ultima posicion conocida del widget, en fisicos. Se actualiza en cada
    /// evento `Moved` y se baja a disco recien al esconderlo o al salir: un
    /// arrastre dispara decenas de `Moved` por segundo y cada uno seria una
    /// escritura de `store.json`.
    widget_pos: Option<WidgetPos>,
    /// Ultimo rectangulo aplicado, con el modo al que se le aplico. Es la cache
    /// que hace que el chequeo de 1 Hz no reposicione la ventana cada segundo.
    applied: Option<(Mode, Rect)>,
    /// Ultima ventana que se mando a mostrar. Sin esta cache, `apply` corre en
    /// CADA anuncio del temporizador -o sea en cada comando: pausar, posponer,
    /// tocar un ajuste-, y cada corrida esconderia el widget de nuevo, lo que
    /// significa releer y reescribir `store.json` para persistir una posicion
    /// que no cambio. La conmutacion es un evento raro; tratarla como tal.
    visible: Option<Mode>,
}

/// Arma el estado, coloca las tres ventanas y muestra la que corresponde.
/// Devuelve el modo con el que arranco la app, que es lo que la bandeja
/// necesita para nacer con la marca en el lugar correcto.
///
/// Corre desde `setup()`, o sea en el hilo principal: aca si se pueden usar los
/// getters de ventana sin riesgo.
pub fn init(app: &AppHandle, settings: &Settings, phase: Phase) -> Mode {
    let mode = Mode::from_label(&settings.default_mode).unwrap_or(Mode::Focus);

    app.manage(Mutex::new(ModeState {
        mode,
        widget_pos: settings.widget_pos,
        applied: None,
        visible: None,
    }));

    // Ambiente no recibe clicks: el mouse la atraviesa y se puede clickear el
    // icono del escritorio que quede debajo. Es lo unico de su configuracion
    // que no se puede declarar en `tauri.conf.json`.
    if let Some(window) = window(app, Mode::Ambient) {
        if let Err(error) = window.set_ignore_cursor_events(true) {
            eprintln!("[cairn] Ambiente no quedo transparente al mouse: {error}");
        }
    }

    place_widget(app);
    let target = visible_mode(mode, phase);
    align(app, target);
    apply(app, target);
    mode
}

/// El modo elegido. `None` solo si `init` todavia no corrio.
pub fn current(app: &AppHandle) -> Option<Mode> {
    let state = app.try_state::<Mutex<ModeState>>()?;
    let guard = state.lock().ok()?;
    Some(guard.mode)
}

/// Cambia de modo. Es la entrada desde la bandeja, o sea el hilo principal.
///
/// **No toca el temporizador.** La fase se lee para saber que ventana mostrar y
/// se devuelve tal cual: cambiar de modo no reinicia, no pausa y no adelanta
/// nada (CLAUDE.md §2).
pub fn set_mode(app: &AppHandle, mode: Mode) {
    // Primero la fase, y con el candado del temporizador ya soltado, para no
    // cruzar el orden de candados que documenta la cabecera del archivo.
    let phase = crate::timer::current_phase(app);

    let changed = {
        let Some(state) = app.try_state::<Mutex<ModeState>>() else {
            eprintln!("[cairn] los modos todavia no estan registrados");
            return;
        };
        let Ok(mut guard) = state.lock() else {
            eprintln!("[cairn] {POISONED}");
            return;
        };
        let changed = guard.mode != mode;
        guard.mode = mode;
        changed
    };

    // Se sigue de largo aunque el modo ya fuera ese, y a proposito: pedir el
    // modo en el que ya estas es la forma de recuperar una ventana que se
    // cerro con la X (que la esconde, no la cierra). Lo que se saltea es la
    // escritura a disco y el repintado del menu, que no tienen nada que hacer.
    if changed {
        // El modo elegido a mano SI se persiste: es la preferencia con la que
        // la app tiene que volver a arrancar. El Foco que aparece al vencer no
        // pasa por aca, justamente para que no la pise.
        settings::update(app, |settings| settings.default_mode = mode.label().to_string());
        crate::tray::sync_mode(app, mode);
    }

    let Some(phase) = phase else { return };
    let target = visible_mode(mode, phase);
    align(app, target);
    // Un pedido explicito del usuario siempre se re-aplica, aunque la cache
    // diga que esa ventana ya se estaba mostrando. Es lo que hace que "Ajustes"
    // -o volver a elegir el modo en el que ya estas- recupere una ventana que
    // se cerro con la X, que la esconde en vez de cerrarla (D8).
    forget_visible(app);
    apply(app, target);
}

/// Olvida cual era la ventana visible, para que el proximo `apply` la muestre
/// aunque no haya cambiado nada.
fn forget_visible(app: &AppHandle) {
    let Some(state) = app.try_state::<Mutex<ModeState>>() else { return };
    let Ok(mut guard) = state.lock() else { return };
    guard.visible = None;
}

/// Reacciona a un cambio de fase. La llama `timer::announce`, **con el candado
/// del temporizador tomado**, asi que aca adentro solo puede haber setters.
pub fn sync(app: &AppHandle, phase: Phase) {
    let Some(mode) = current(app) else { return };
    apply(app, visible_mode(mode, phase));
}

/// Muestra la ventana que toca y esconde las otras dos.
///
/// No hace nada si esa ventana ya es la que se estaba mostrando: la llama cada
/// anuncio del temporizador y conmutar de verdad es raro.
fn apply(app: &AppHandle, target: Mode) {
    {
        let Some(state) = app.try_state::<Mutex<ModeState>>() else { return };
        let Ok(mut guard) = state.lock() else { return };
        if guard.visible == Some(target) {
            return;
        }
        guard.visible = Some(target);
    }

    for mode in Mode::ALL {
        let Some(window) = window(app, mode) else { continue };
        if mode == target {
            // El orden `show` -> `unminimize` -> `set_focus` no es negociable
            // (D7): el `set_focus` de tao arranca con `if is_visible &&
            // !is_minimized`, asi que sobre una ventana escondida es un no-op.
            log_step("show", window.show());
            log_step("unminimize", window.unminimize());
            // Solo Foco se lleva el foco del teclado. El widget flota y
            // Ambiente ni siquiera es enfocable: robarle el foco a lo que el
            // usuario esta escribiendo, para mostrarle una caja de 176 px que
            // no tiene nada que tipear, es un defecto y no una feature.
            if mode == Mode::Focus {
                log_step("set_focus", window.set_focus());
            }
        } else {
            if mode == Mode::Widget {
                persist_widget_pos(app);
            }
            log_step("hide", window.hide());
        }
    }
}

/// Recalcula y aplica la geometria de la ventana visible.
///
/// **Nunca con un candado tomado**: usa `primary_monitor()`, que espera al hilo
/// principal. Solo la llaman `init` y `set_mode` (que corren en el hilo
/// principal) y el chequeo de 1 Hz del ticker (que no tiene nada tomado).
///
/// El widget queda afuera a proposito: su posicion la decide el usuario
/// arrastrandolo, no el monitor.
fn align(app: &AppHandle, target: Mode) {
    if target == Mode::Widget {
        return;
    }
    let Some(window) = window(app, target) else { return };
    let monitor = match window.primary_monitor() {
        Ok(Some(monitor)) => monitor,
        Ok(None) => {
            eprintln!("[cairn] Windows no reporta un monitor primario");
            return;
        }
        Err(error) => {
            eprintln!("[cairn] no se pudo leer el monitor primario: {error}");
            return;
        }
    };

    let pos = (monitor.position().x, monitor.position().y);
    let size = (monitor.size().width, monitor.size().height);
    let rect = match target {
        // Foco cubre el monitor entero, barra de tareas incluida, pero SIN
        // `set_fullscreen(true)` (D5): el fullscreen del sistema reordena las
        // demas ventanas y tarda en entrar y salir.
        Mode::Focus => (pos.0, pos.1, size.0, size.1),
        Mode::Ambient => ambient_rect(pos, size, monitor.scale_factor(), AMBIENT_HEIGHT_CSS),
        Mode::Widget => return,
    };

    let Some(state) = app.try_state::<Mutex<ModeState>>() else { return };
    let Ok(mut guard) = state.lock() else { return };
    if guard.applied == Some((target, rect)) {
        return;
    }
    guard.applied = Some((target, rect));
    drop(guard);

    let (x, y, width, height) = rect;
    log_step("set_position", window.set_position(PhysicalPosition::new(x, y)));
    log_step("set_size", window.set_size(PhysicalSize::new(width, height)));
}

/// El chequeo de 1 Hz que engancha el ticker.
///
/// Tauri no expone un evento de "cambio la configuracion de pantallas", asi que
/// la unica forma de que la franja siga al monitor primario cuando se enchufa,
/// se desenchufa o se cambia la resolucion o la escala es preguntar. Es una
/// llamada por segundo y solo mientras se ve Foco o Ambiente; la cache de
/// `align` hace que no se reposicione nada si nada cambio.
pub fn keep_aligned(app: &AppHandle) {
    let (Some(mode), Some(phase)) = (current(app), crate::timer::current_phase(app)) else {
        return;
    };
    align(app, visible_mode(mode, phase));
}

/// Anota que el usuario movio el widget. Solo memoria: el disco espera.
pub fn remember_widget_move(app: &AppHandle, x: i32, y: i32) {
    let Some(state) = app.try_state::<Mutex<ModeState>>() else { return };
    let Ok(mut guard) = state.lock() else { return };
    guard.widget_pos = Some(WidgetPos { x, y });
}

/// Baja al disco la ultima posicion conocida del widget.
///
/// Se llama al esconderlo y al salir de la app, que son los dos momentos en que
/// la posicion puede haber cambiado y no vamos a tener otra oportunidad. No lee
/// la ventana: usa lo que anotaron los eventos `Moved`, y por eso es seguro
/// llamarla con el candado del temporizador tomado.
pub fn persist_widget_pos(app: &AppHandle) {
    let Some(state) = app.try_state::<Mutex<ModeState>>() else { return };
    let Ok(guard) = state.lock() else { return };
    let Some(pos) = guard.widget_pos else { return };
    drop(guard);
    settings::update(app, |settings| settings.widget_pos = Some(pos));
}

/// Coloca el widget donde estaba, o en la esquina superior derecha si es la
/// primera vez.
///
/// La posicion guardada se descarta si no cae dentro de ningun monitor
/// conectado. Sin esa guarda, arrastrar el widget al segundo monitor y despues
/// desconectarlo lo deja fuera de la pantalla para siempre, y la unica forma de
/// recuperarlo seria editar `store.json` a mano.
fn place_widget(app: &AppHandle) {
    let Some(window) = window(app, Mode::Widget) else { return };

    let saved = app
        .try_state::<Mutex<ModeState>>()
        .and_then(|state| state.lock().ok().and_then(|guard| guard.widget_pos));

    let monitors = window.available_monitors().unwrap_or_default();
    let on_screen = |pos: WidgetPos| {
        monitors.iter().any(|monitor| {
            let origin = monitor.position();
            let size = monitor.size();
            pos.x >= origin.x
                && pos.y >= origin.y
                && pos.x < origin.x + size.width as i32
                && pos.y < origin.y + size.height as i32
        })
    };

    let pos = match saved {
        Some(pos) if on_screen(pos) => pos,
        _ => {
            let Ok(Some(monitor)) = window.primary_monitor() else { return };
            let Ok(size) = window.outer_size() else { return };
            let margin = (WIDGET_MARGIN_CSS * monitor.scale_factor()).round() as i32;
            WidgetPos {
                x: monitor.position().x + monitor.size().width as i32
                    - size.width as i32
                    - margin,
                y: monitor.position().y + margin,
            }
        }
    };

    log_step("set_position del widget", window.set_position(PhysicalPosition::new(pos.x, pos.y)));
}

fn window(app: &AppHandle, mode: Mode) -> Option<WebviewWindow> {
    let window = app.get_webview_window(mode.label());
    if window.is_none() {
        eprintln!("[cairn] no existe la ventana '{}'", mode.label());
    }
    window
}

fn log_step(step: &str, result: tauri::Result<()>) {
    if let Err(error) = result {
        eprintln!("[cairn] {step} fallo: {error}");
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Un monitor 1920x1080 en el origen.
    const POS: (i32, i32) = (0, 0);
    const SIZE: (u32, u32) = (1920, 1080);

    #[test]
    fn ambient_is_three_visual_pixels_at_every_scale() {
        // El punto entero de multiplicar a mano: la franja tiene que MEDIR lo
        // mismo en pantalla al 100 % y al 150 %, y eso significa medir distinto
        // en pixeles fisicos.
        assert_eq!(ambient_rect(POS, SIZE, 1.0, 3.0).3, 3);
        assert_eq!(ambient_rect(POS, SIZE, 1.25, 3.0).3, 4); // 3.75 -> 4
        assert_eq!(ambient_rect(POS, SIZE, 1.5, 3.0).3, 5); // 4.5 -> 5
        assert_eq!(ambient_rect(POS, SIZE, 2.0, 3.0).3, 6);
    }

    #[test]
    fn ambient_spans_the_whole_monitor_width() {
        // Lo que crece con el avance del ciclo es el relleno pintado adentro,
        // nunca la ventana: la ventana siempre ocupa el ancho completo.
        assert_eq!(ambient_rect(POS, SIZE, 1.0, 5.0).2, 1920);
        assert_eq!(ambient_rect(POS, (3840, 2160), 2.0, 5.0).2, 3840);
    }

    #[test]
    fn ambient_follows_a_monitor_with_negative_coordinates() {
        // Un monitor a la izquierda del primario tiene x negativo en Windows.
        // Es el caso donde un `as u32` descuidado manda la ventana al infinito.
        let rect = ambient_rect((-1920, -200), SIZE, 1.0, 3.0);
        assert_eq!(rect.0, -1920);
        assert_eq!(rect.1, -200);
    }

    #[test]
    fn ambient_never_collapses_to_zero_height() {
        // Una escala rota (o un alto absurdo) no puede dejar una ventana de
        // alto cero, que Windows trata distinto y no se ve nunca mas.
        assert_eq!(ambient_rect(POS, SIZE, 0.01, 3.0).3, 1);
        assert_eq!(ambient_rect(POS, SIZE, f64::NAN, 3.0).3, 1);
    }

    #[test]
    fn switching_mode_never_touches_the_phase() {
        // La regla inquebrantable de CLAUDE.md §2. `visible_mode` recibe la
        // fase por valor y devuelve un `Mode`, asi que no hay ninguna firma en
        // este archivo capaz de mutar el temporizador; el test recorre igual
        // las nueve combinaciones y comprueba que la fase sale intacta, porque
        // el dia que alguien cambie la firma a `&mut Phase` esto deja de
        // compilar y esa es exactamente la alarma que se busca.
        let phases = [
            Phase::Running { deadline_ms: 1_767_225_600_000, cycle_ms: 45 * 60_000 },
            Phase::Paused { remaining_ms: 10 * 60_000, cycle_ms: 45 * 60_000 },
            Phase::Elapsed { since_ms: 1_767_225_600_000 },
        ];

        for phase in phases {
            for mode in Mode::ALL {
                let before = phase;
                let _ = visible_mode(mode, phase);
                assert_eq!(before, phase, "cambiar de modo no puede tocar la fase");
            }
        }
    }

    #[test]
    fn elapsed_always_shows_focus_without_forgetting_the_chosen_mode() {
        let elapsed = Phase::Elapsed { since_ms: 0 };
        let running = Phase::Running { deadline_ms: 1_000, cycle_ms: 1_000 };

        // Vencido interrumpe desde cualquier modo...
        for mode in Mode::ALL {
            assert_eq!(visible_mode(mode, elapsed), Mode::Focus);
        }
        // ...y al confirmar se vuelve al modo elegido, que nunca se piso.
        assert_eq!(visible_mode(Mode::Ambient, running), Mode::Ambient);
        assert_eq!(visible_mode(Mode::Widget, running), Mode::Widget);
    }

    #[test]
    fn paused_stays_in_the_chosen_mode() {
        // Pausar no es vencer: no tiene por que taparle la pantalla a nadie.
        let paused = Phase::Paused { remaining_ms: 60_000, cycle_ms: 60_000 };
        assert_eq!(visible_mode(Mode::Ambient, paused), Mode::Ambient);
    }

    #[test]
    fn the_labels_are_the_ones_settings_validates() {
        // Los tres strings son a la vez el label de la ventana, el `?view=` y
        // el valor de `default_mode`. Si alguien renombra uno, la app arranca
        // en Foco sin decir nada; este test lo hace fallar antes.
        assert_eq!(Mode::from_label("foco"), Some(Mode::Focus));
        assert_eq!(Mode::from_label("widget"), Some(Mode::Widget));
        assert_eq!(Mode::from_label("ambient"), Some(Mode::Ambient));
        assert_eq!(Mode::from_label("Foco"), None);
        assert_eq!(Mode::from_label(""), None);
    }
}
