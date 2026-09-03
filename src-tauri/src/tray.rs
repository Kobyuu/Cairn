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

use tauri::menu::{
    CheckMenuItem, CheckMenuItemBuilder, Menu, MenuEvent, MenuItem, MenuItemBuilder,
    PredefinedMenuItem,
};
use tauri::tray::TrayIconBuilder;
use tauri::{AppHandle, Manager, Wry};

use crate::modes::{self, Mode};
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

/// Lo unico que la bandeja necesita conservar: los handles de los items que
/// cambian solos. Va en `app.manage()`, el mismo mecanismo por el que viaja el
/// estado del temporizador, para poder recuperarlo desde cualquier lado con el
/// tipo.
struct TrayHandles {
    toggle: MenuItem<Wry>,
    /// Los tres modos, emparejados con el modo que representan. Son
    /// `CheckMenuItem` y no items comunes porque en Ambiente **no se ve ninguna
    /// ventana**: sin la marca, la bandeja es el unico lugar donde se puede
    /// saber en que modo esta la app, y no lo diria.
    modes: Vec<(Mode, CheckMenuItem<Wry>)>,
}

/// Arma el icono y el menu. Se llama una vez, desde `setup()`.
pub fn init(app: &AppHandle, state: TimerState, mode: Mode) -> Result<(), Box<dyn std::error::Error>> {
    let focus = mode_item(app, Mode::Focus, ID_MODE_FOCUS, "Foco", mode)?;
    let widget = mode_item(app, Mode::Widget, ID_MODE_WIDGET, "Widget", mode)?;
    let ambient = mode_item(app, Mode::Ambient, ID_MODE_AMBIENT, "Ambiente", mode)?;

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

    app.manage(TrayHandles {
        toggle,
        modes: vec![
            (Mode::Focus, focus),
            (Mode::Widget, widget),
            (Mode::Ambient, ambient),
        ],
    });
    sync(app, state);
    Ok(())
}

fn mode_item(
    app: &AppHandle,
    mode: Mode,
    id: &str,
    text: &str,
    current: Mode,
) -> tauri::Result<CheckMenuItem<Wry>> {
    CheckMenuItemBuilder::new(text)
        .id(id)
        .checked(mode == current)
        .build(app)
}

fn on_menu_event(app: &AppHandle, event: MenuEvent) {
    match event.id.as_ref() {
        ID_MODE_FOCUS => modes::set_mode(app, Mode::Focus),
        ID_MODE_WIDGET => modes::set_mode(app, Mode::Widget),
        ID_MODE_AMBIENT => modes::set_mode(app, Mode::Ambient),
        ID_TOGGLE => toggle_pause(app),
        // Los ajustes viven adentro de la pantalla de Foco, asi que "Ajustes"
        // es "traeme Foco". Va por `show_mode` y NO por `set_mode`: abrir los
        // ajustes es un pedido de una vez, no elegir el modo con el que la app
        // tiene que arrancar. Cuando pasaba por `set_mode`, elegir Widget como
        // modo por defecto y despues abrir Ajustes reescribia el archivo con
        // "foco", y la app volvia a arrancar en Foco sin que nadie se lo pida.
        ID_SETTINGS => modes::show_mode(app, Mode::Focus),
        // La UNICA salida real de la app. Todo lo demas esconde ventanas.
        ID_QUIT => app.exit(0),
        _ => {}
    }
}

/// Pausa o reanuda leyendo la fase real del core, no un estado propio.
fn toggle_pause(app: &AppHandle) {
    let paused = matches!(timer::current_phase(app), Some(Phase::Paused { .. }));
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

/// Mueve la marca del menu al modo activo.
///
/// La llama `modes::set_mode`, que es el unico lugar donde el modo elegido
/// cambia. Igual que `sync`, salta al hilo principal antes de tocar los items:
/// `muda` entra en panico si se los toca desde otro lado.
pub fn sync_mode(app: &AppHandle, mode: Mode) {
    let handle = app.clone();
    let dispatched = app.run_on_main_thread(move || {
        let Some(handles) = handle.try_state::<TrayHandles>() else {
            eprintln!("[cairn] la bandeja todavia no esta registrada");
            return;
        };
        for (item_mode, item) in &handles.modes {
            log_step("set_checked de un modo", item.set_checked(*item_mode == mode));
        }
    });
    if let Err(error) = dispatched {
        eprintln!("[cairn] no se pudo despachar la marca del modo: {error}");
    }
}
