mod timer;

use std::sync::Mutex;
use tauri::Manager;

/// Arranca el proceso de Tauri: registra el estado del temporizador, expone los
/// comandos que las ventanas pueden llamar, lanza el hilo de 1 Hz, y le entrega
/// el control al loop de eventos del sistema, que no vuelve hasta que la app
/// termina.
pub fn run() {
    tauri::Builder::default()
        // `invoke_handler` es la lista de funciones de Rust que el frontend
        // puede llamar con `invoke("nombre")`. Los comandos propios de la app no
        // necesitan permiso en `capabilities/`: el ACL de Tauri v2 solo gatea
        // los comandos `core:*` y los de plugins.
        .invoke_handler(tauri::generate_handler![
            timer::timer_snapshot,
            timer::timer_pause,
            timer::timer_resume,
            timer::timer_reset,
            timer::timer_snooze,
            timer::timer_set_interval,
        ])
        .setup(|app| {
            // `manage` guarda un valor en el core y se lo inyecta a cualquier
            // comando que lo pida por tipo. Va detras de un `Mutex` -el candado
            // de la stdlib- porque lo tocan a la vez el hilo de 1 Hz y los
            // comandos que llegan de las ventanas. El estado vive aca y no en
            // JS por D1: las ventanas son vistas intercambiables, y WebView2
            // estrangula los timers de JS en las que estan ocultas.
            app.manage(Mutex::new(timer::initial_state()));
            timer::spawn_ticker(app.handle().clone());
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("no se pudo iniciar Tauri");
}
