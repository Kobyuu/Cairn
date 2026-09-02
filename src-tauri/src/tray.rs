//! El icono y el menu de la bandeja del sistema.
//!
//! La idea que ordena todo el archivo: **la bandeja es una vista mas, igual que
//! una ventana**. No guarda ningun booleano propio de "esta pausado". Cuando el
//! usuario aprieta "Pausar", le pregunta al `Mutex<TimerState>` del core cual es
//! la fase de verdad y recien ahi decide que comando llamar; y cuando la fase
//! cambia por cualquier motivo -un boton de la ventana, el hilo de 1 Hz-, el
//! core la re-pinta por el mismo lugar por el que le avisa a los webviews.
//!
//! Duplicar ese booleano seria el bug clasico: pausas desde la ventana, la
//! bandeja sigue diciendo "Pausar", la apretas y reanudas sin querer.

use std::sync::Mutex;

use tauri::menu::{Menu, MenuEvent, MenuItem, MenuItemBuilder, PredefinedMenuItem};
use tauri::tray::TrayIconBuilder;
use tauri::{AppHandle, Manager, Wry};

use crate::timer::{self, Phase, TimerState};

/// Los ids con los que vuelve el click en `on_menu_event`. Son strings porque
/// asi los modela Tauri; las constantes evitan que un typo entre un `build` y
/// un `match` deje un item que no hace nada y no rompe la compilacion.
const ID_MODE_FOCUS: &str = "mode_focus";
const ID_MODE_WIDGET: &str = "mode_widget";
const ID_MODE_AMBIENT: &str = "mode_ambient";
const ID_TOGGLE: &str = "toggle";
const ID_SETTINGS: &str = "settings";
const ID_QUIT: &str = "quit";

const LABEL_MAIN: &str = "main";

/// Lo unico que la bandeja necesita conservar: el handle del item que cambia de
/// texto. Va en `app.manage()`, el mismo mecanismo por el que viaja el estado
/// del temporizador, para poder recuperarlo desde cualquier lado con el tipo.
struct TrayHandles {
    toggle: MenuItem<Wry>,
}

/// Arma el icono y el menu. Se llama una vez, desde `setup()`.
pub fn init(app: &AppHandle, state: TimerState) -> Result<(), Box<dyn std::error::Error>> {
    // Los tres modos existen ya para fijar la forma del menu, pero llegan
    // deshabilitados: las ventanas que conmutan son la etapa 4.
    let focus = MenuItemBuilder::new("Foco").id(ID_MODE_FOCUS).enabled(false).build(app)?;
    let widget = MenuItemBuilder::new("Widget").id(ID_MODE_WIDGET).enabled(false).build(app)?;
    let ambient = MenuItemBuilder::new("Ambiente").id(ID_MODE_AMBIENT).enabled(false).build(app)?;

    // El texto real lo pone `sync` al final de esta funcion, contra el estado
    // que ya existe. Aca solo se reserva el ancho.
    let toggle = MenuItemBuilder::new("Pausar").id(ID_TOGGLE).build(app)?;
    let settings = MenuItemBuilder::new("Ajustes").id(ID_SETTINGS).build(app)?;
    let quit = MenuItemBuilder::new("Salir").id(ID_QUIT).build(app)?;

    let menu = Menu::with_items(
        app,
        &[
            &focus,
            &widget,
            &ambient,
            &PredefinedMenuItem::separator(app)?,
            &toggle,
            &PredefinedMenuItem::separator(app)?,
            &settings,
            &quit,
        ],
    )?;

    let icon = app
        .default_window_icon()
        .cloned()
        .ok_or("la app no tiene icono por defecto")?;

    TrayIconBuilder::new()
        .icon(icon)
        .tooltip("Cairn")
        .menu(&menu)
        // Sin esto, en Windows el click izquierdo no abre el menu y el unico
        // acceso queda en el boton derecho.
        .show_menu_on_left_click(true)
        .on_menu_event(on_menu_event)
        .build(app)?;

    app.manage(TrayHandles { toggle });
    sync(app, state);
    Ok(())
}

fn on_menu_event(app: &AppHandle, event: MenuEvent) {
    match event.id.as_ref() {
        ID_TOGGLE => toggle_pause(app),
        ID_SETTINGS => show_main(app),
        // La UNICA salida real de la app. Todo lo demas esconde ventanas.
        ID_QUIT => app.exit(0),
        // Los tres modos estan deshabilitados hasta la etapa 4, asi que este
        // brazo no deberia recibir nada; que exista evita el panico si algun
        // dia se habilitan sin tocar este match.
        _ => {}
    }
}

/// Pausa o reanuda leyendo la fase real del core, no un estado propio.
fn toggle_pause(app: &AppHandle) {
    let paused = matches!(current_phase(app), Some(Phase::Paused { .. }));
    // Los comandos de `timer.rs` son funciones de Rust comunes con un atributo
    // encima: se pueden llamar directo desde acá. Emiten y sincronizan solos, asi
    // que la bandeja no tiene que refrescarse a mano despues.
    let result = if paused {
        timer::timer_resume(app.clone())
    } else {
        timer::timer_pause(app.clone())
    };
    if let Err(error) = result {
        eprintln!("[cairn] la bandeja no pudo cambiar la pausa: {error}");
    }
}

fn current_phase(app: &AppHandle) -> Option<Phase> {
    let state = app.try_state::<Mutex<TimerState>>()?;
    let guard = state.lock().ok()?;
    Some(guard.phase)
}

/// Trae la ventana principal al frente.
///
/// El orden `show` -> `unminimize` -> `set_focus` no es negociable (D7): el
/// `set_focus` de tao arranca con `if is_visible && !is_minimized`, asi que
/// llamarlo sobre una ventana escondida es un no-op silencioso. Es el bug
/// clasico de "el .exe se ejecuta de nuevo y no pasa nada".
///
/// Nada de Win32 ni `unsafe`: tao ya trae adentro el workaround del ALT
/// sintetico que Windows necesita para permitir `SetForegroundWindow`.
pub fn show_main(app: &AppHandle) {
    let Some(window) = app.get_webview_window(LABEL_MAIN) else {
        eprintln!("[cairn] no existe la ventana '{LABEL_MAIN}'");
        return;
    };
    log_step("show", window.show());
    log_step("unminimize", window.unminimize());
    log_step("set_focus", window.set_focus());
}

fn log_step(step: &str, result: tauri::Result<()>) {
    if let Err(error) = result {
        eprintln!("[cairn] {step} de la ventana fallo: {error}");
    }
}

/// Re-pinta el item de pausa desde el snapshot del core.
///
/// Lo llama `timer.rs` en el mismo punto por el que le avisa a las ventanas, asi
/// que la bandeja y los webviews nunca pueden discrepar: los dos leen del mismo
/// `TimerState` en el mismo momento.
///
/// El salto al hilo principal no es opcional: `sync` se llama tambien desde el
/// hilo de 1 Hz, y `muda` -la libreria de menus que Tauri usa por debajo-
/// entra en panico si se tocan sus items fuera del hilo principal.
pub fn sync(app: &AppHandle, state: TimerState) {
    let (text, enabled) = match state.phase {
        Phase::Paused { .. } => ("Reanudar", true),
        Phase::Running { .. } => ("Pausar", true),
        // Vencido no se pausa: lo que corresponde es confirmar o posponer.
        Phase::Elapsed { .. } => ("Pausar", false),
    };

    let handle = app.clone();
    let dispatched = app.run_on_main_thread(move || {
        let Some(handles) = handle.try_state::<TrayHandles>() else {
            eprintln!("[cairn] la bandeja todavia no esta registrada");
            return;
        };
        log_step("set_text del item de pausa", handles.toggle.set_text(text));
        log_step("set_enabled del item de pausa", handles.toggle.set_enabled(enabled));
    });
    if let Err(error) = dispatched {
        eprintln!("[cairn] no se pudo despachar la sincronizacion de la bandeja: {error}");
    }
}
