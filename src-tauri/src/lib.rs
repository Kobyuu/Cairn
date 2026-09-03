mod modes;
mod routine;
mod settings;
mod timer;
mod tray;

use std::sync::Mutex;
use tauri::Manager;

/// Arranca el proceso de Tauri: registra los plugins y el estado del
/// temporizador, expone los comandos que las ventanas pueden llamar, arma la
/// bandeja, lanza el hilo de 1 Hz, y le entrega el control al loop de eventos
/// del sistema, que no vuelve hasta que la app termina de verdad.
pub fn run() {
    let app = tauri::Builder::default()
        // El de instancia unica va PRIMERO, antes que cualquier otro plugin.
        // Es un requisito documentado del propio plugin ("plugins run in the
        // order they were added in to the builder, so make sure that this
        // plugin is registered first") y falla en silencio si no se respeta:
        // la segunda instancia arranca igual y quedan dos Cairn peleandose la
        // bandeja. El callback recibe el AppHandle de la instancia que YA
        // estaba viva, mas el argv y el cwd de la que se acaba de intentar
        // abrir; nosotros solo usamos el primero.
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            // Volver a ejecutar el .exe significa "mostrame la app", y la app
            // que se puede mostrar es Foco: en Ambiente no hay ninguna ventana
            // que traer al frente, asi que sin esto el doble click no haria
            // nada visible. Es un cambio de modo de verdad, con su marca en la
            // bandeja y su escritura en `store.json`.
            modes::set_mode(app, modes::Mode::Focus);
        }))
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_autostart::Builder::new().build())
        // `invoke_handler` es la lista de funciones de Rust que el frontend
        // puede llamar con `invoke("nombre")`. Los comandos propios de la app no
        // necesitan permiso en `capabilities/`: el ACL de Tauri v2 solo gatea
        // los comandos `core:*` y los de plugins. Por eso los cuatro plugins se
        // usan solo desde Rust y hacia el webview van estos comandos nuestros.
        .invoke_handler(tauri::generate_handler![
            timer::timer_snapshot,
            timer::timer_pause,
            timer::timer_resume,
            timer::timer_reset,
            timer::timer_snooze,
            timer::timer_set_interval,
            timer::timer_set_quick_snooze,
            settings::settings_snapshot,
            settings::settings_set_autostart,
            routine::routine_read,
            routine::routine_write,
        ])
        .setup(|app| {
            let handle = app.handle().clone();

            // Los ajustes se leen ANTES de crear el estado: el ciclo tiene que
            // nacer con el intervalo guardado, no con el default de fabrica y
            // un reinicio despues.
            let saved = settings::load(&handle);
            // Se reescribe en el arranque, aunque no haya cambiado nada. Es lo
            // que pide la spec y tiene un motivo concreto: si el archivo no
            // existia o estaba corrupto, asi queda uno valido en disco que Manu
            // puede abrir con el Bloc de Notas y editar a mano (CLAUDE.md §3).
            // Sin esto, `store.json` recien aparece cuando se toca un ajuste.
            settings::save(&handle, &saved);

            let state = timer::initial_state(saved.interval_min, saved.quick_snooze_min);

            // `manage` guarda un valor en el core y se lo inyecta a cualquier
            // comando que lo pida por tipo. Va detras de un `Mutex` -el candado
            // de la stdlib- porque lo tocan a la vez el hilo de 1 Hz, la bandeja
            // y los comandos que llegan de las ventanas. El estado vive aca y no
            // en JS por D1: las ventanas son vistas intercambiables, y WebView2
            // estrangula los timers de JS en las que estan ocultas.
            app.manage(Mutex::new(state));

            // Los modos van despues del `manage` porque colocan y muestran la
            // ventana que corresponde a la FASE que acaba de quedar registrada:
            // si la app arrancara vencida, lo que tiene que aparecer es Foco y
            // no el modo guardado.
            let mode = modes::init(&handle, &saved, state.phase);

            // La bandeja se arma despues porque su item de pausa se pinta
            // contra el estado, y su marca de modo contra el modo de arranque.
            tray::init(&handle, state, mode)?;
            timer::spawn_ticker(handle);
            Ok(())
        })
        .on_window_event(|window, event| match event {
            // Cerrar una ventana NO cierra la app (D8): se cancela el cierre y
            // se esconde. La unica salida real es "Salir" en la bandeja.
            tauri::WindowEvent::CloseRequested { api, .. } => {
                api.prevent_close();
                if let Err(error) = window.hide() {
                    eprintln!("[cairn] no se pudo esconder la ventana: {error}");
                }
                if window.label() == modes::Mode::Widget.label() {
                    modes::persist_widget_pos(window.app_handle());
                }
            }
            // El widget se arrastra y tiene que recordar donde quedo. La
            // posicion se anota en memoria en cada `Moved` -que durante un
            // arrastre llegan de a decenas por segundo- y baja a disco recien
            // al esconderlo o al salir. Guardar en cada evento seria una
            // escritura de `store.json` por pixel arrastrado.
            tauri::WindowEvent::Moved(position)
                if window.label() == modes::Mode::Widget.label() =>
            {
                modes::remember_widget_move(window.app_handle(), position.x, position.y);
            }
            // Minimizar Foco es pedir la pantalla de vuelta, asi que Cairn se
            // corre solo al modo mas discreto en vez de quedarse escondido en
            // la barra de tareas sin decir nada.
            //
            // El `0x0` no es un truco: tao NO tiene un evento `Minimized` -su
            // propio codigo lo dice, "Send WindowEvent::Minimized here if we
            // decide to implement one"-, asi que lo unico que llega es el
            // WM_SIZE que Windows manda al minimizar, con el area de cliente
            // en cero. Verificado contra tao 0.35.3, no de memoria.
            tauri::WindowEvent::Resized(size)
                if size.width == 0
                    && size.height == 0
                    && window.label() == modes::Mode::Focus.label() =>
            {
                modes::set_mode(window.app_handle(), modes::Mode::Ambient);
            }
            _ => {}
        })
        // `build` + `run` en vez de `.run()` directo: es la unica forma de
        // engancharse a `RunEvent`, que es donde vive el `prevent_exit`.
        .build(tauri::generate_context!())
        .expect("no se pudo iniciar Tauri");

    app.run(|app, event| {
        if let tauri::RunEvent::ExitRequested { code, api, .. } = event {
            // La ultima oportunidad de bajar la posicion del widget a disco: si
            // el usuario lo arrastro y despues salio por la bandeja sin cambiar
            // de modo, este es el unico lugar por el que pasa el movimiento.
            if code.is_some() {
                modes::persist_widget_pos(app);
            }
            // Sin este `prevent_exit`, Tauri termina el proceso apenas se
            // esconde la ultima ventana y la bandeja queda huerfana.
            //
            // Pero NO puede ser incondicional, o "Salir" tampoco podria salir.
            // El campo `code` es exactamente lo que distingue los dos casos:
            // `None` cuando la salida la disparo la interaccion del usuario
            // (cerrar la ultima ventana), `Some` cuando la pidio el programa
            // -que es lo que hace nuestro `app.exit(0)` desde la bandeja-.
            if code.is_none() {
                api.prevent_exit();
            }
        }
    });
}
