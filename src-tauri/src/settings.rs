//! Ajustes persistidos en `store.json`.
//!
//! Igual que `timer.rs`, el archivo se parte en dos: arriba la parte pura
//! -leer y escribir el JSON- que se testea con `cargo test`, y abajo la
//! plomeria que habla con el plugin del store, que se verifica a mano.
//!
//! La regla que manda todo el diseno: **un `store.json` ausente, vacio,
//! corrupto o editado a mano no puede romper el arranque** (SPEC §Ajustes).
//! Por eso no hay un `#[derive(Deserialize)]` sobre el struct entero: serde
//! falla la estructura completa si un solo campo tiene el tipo equivocado, y
//! una `theme: 3` tirada por un editor de texto se llevaria puestos los otros
//! cinco ajustes. Se lee campo por campo, y cada uno cae a SU default.

use serde::{de::DeserializeOwned, Serialize};
use serde_json::{Map, Value};
use tauri::{AppHandle, Emitter};
use tauri_plugin_autostart::ManagerExt;
use tauri_plugin_store::StoreExt;

const DEFAULT_INTERVAL_MIN: u64 = 45;
const DEFAULT_QUICK_SNOOZE_MIN: u64 = 5;
const DEFAULT_MODE: &str = "foco";
const DEFAULT_THEME: &str = "dark";

/// Los valores que `default_mode` puede tomar. Se validan porque `store.json`
/// es un archivo que el usuario puede abrir con el Bloc de Notas (CLAUDE.md §3):
/// un modo inventado tiene que morir aca y no llegar a la etapa 4.
const MODES: [&str; 3] = ["foco", "widget", "ambient"];
/// `"system"` sigue a `prefers-color-scheme` del webview; lo traduce el
/// frontend (`src/theme.ts`), no el core. El default sigue siendo `"dark"`
/// -es el default del producto (docs/DESIGN.md §2)- aunque el prototipo del
/// handoff arranque en Sistema: cambiarlo mandaria al tema claro a quien nunca
/// lo pidio.
const THEMES: [&str; 3] = ["system", "dark", "light"];

/// Posicion del widget, en pixeles fisicos (D6).
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, serde::Deserialize)]
pub struct WidgetPos {
    pub x: i32,
    pub y: i32,
}

/// Los seis ajustes del spec. **Solo ajustes**: ningun contenido vive aca
/// (CLAUDE.md §3), la rutina es un `.md` de verdad en `notes/`.
///
/// Sale al frontend en camelCase, igual que `TimerState`; en `store.json` las
/// claves van en snake_case, que es como las fija el spec. Los dos formatos
/// conviven porque el JSON del store se arma a mano en `to_json`, no con serde.
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Settings {
    pub interval_min: u64,
    pub default_mode: String,
    pub quick_snooze_min: u64,
    /// `None` = todavia nadie la movio. No se inventa una posicion en la etapa
    /// 3: una coordenada valida depende del monitor, y eso lo resuelve la
    /// etapa 4 en pixeles fisicos (D6). Escribir un x/y de fantasia ahora
    /// obligaria a la etapa 4 a distinguir "lo puso el usuario" de "lo invento
    /// el default", que es justo lo que `None` dice gratis.
    pub widget_pos: Option<WidgetPos>,
    pub autostart: bool,
    pub theme: String,
    /// Un tono corto y grave al vencer el ciclo. Apagado por defecto: la app
    /// esta encendida ocho horas y un sonido que no pediste es peor que uno
    /// que falta.
    pub sound_on_alert: bool,
    /// En que monitor aparecen Foco y Ambiente. Es el NOMBRE que reporta
    /// Windows (`\\.\DISPLAY1`), que es lo unico estable: el orden de la lista
    /// y las coordenadas cambian al enchufar o desenchufar una pantalla.
    ///
    /// `None` = el primario. No se guarda un nombre por default a proposito:
    /// "el primario, el que sea" sobrevive a cambiar el monitor principal
    /// desde Windows, y un nombre clavado no.
    pub monitor: Option<String>,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            interval_min: DEFAULT_INTERVAL_MIN,
            default_mode: DEFAULT_MODE.to_string(),
            quick_snooze_min: DEFAULT_QUICK_SNOOZE_MIN,
            widget_pos: None,
            autostart: false,
            theme: DEFAULT_THEME.to_string(),
            sound_on_alert: false,
            monitor: None,
        }
    }
}

/// Lee una clave del JSON, cayendo a `fallback` si falta o si el tipo no es el
/// esperado. Es el unico lugar donde se decide "esto no se entiende, uso el
/// default", y por eso no hay ni un `?` ni un `unwrap` en todo `from_json`.
fn field<T: DeserializeOwned>(json: &Value, key: &str, fallback: T) -> T {
    json.get(key)
        .and_then(|value| serde_json::from_value(value.clone()).ok())
        .unwrap_or(fallback)
}

/// Acota un string a un conjunto conocido. Tipo correcto pero valor invalido
/// tambien cae al default.
fn one_of(value: String, allowed: &[&str], fallback: &str) -> String {
    if allowed.contains(&value.as_str()) {
        value
    } else {
        fallback.to_string()
    }
}

impl Settings {
    /// Reconstruye los ajustes desde lo que haya en el disco.
    ///
    /// `json` puede ser cualquier cosa: un objeto completo, un objeto a medias,
    /// un array, un numero suelto o `null` (que es lo que se pasa cuando el
    /// archivo no existe o no parsea). Todos esos casos dan defaults sin panic.
    pub fn from_json(json: &Value) -> Self {
        let defaults = Self::default();
        Self {
            interval_min: field(json, "interval_min", defaults.interval_min),
            default_mode: one_of(
                field(json, "default_mode", defaults.default_mode),
                &MODES,
                DEFAULT_MODE,
            ),
            quick_snooze_min: field(json, "quick_snooze_min", defaults.quick_snooze_min),
            widget_pos: field(json, "widget_pos", defaults.widget_pos),
            autostart: field(json, "autostart", defaults.autostart),
            theme: one_of(field(json, "theme", defaults.theme), &THEMES, DEFAULT_THEME),
            sound_on_alert: field(json, "sound_on_alert", defaults.sound_on_alert),
            monitor: field(json, "monitor", defaults.monitor),
        }
    }

    /// Serializa a las claves snake_case que fija el spec.
    ///
    /// Se arma a mano en vez de derivarlo porque `widget_pos` en `None` se
    /// omite: un `null` en un archivo que el usuario puede abrir a mano es
    /// ruido, y la ausencia de la clave ya significa exactamente lo mismo.
    pub fn to_json(&self) -> Value {
        let mut map = Map::new();
        map.insert("interval_min".into(), self.interval_min.into());
        map.insert("default_mode".into(), self.default_mode.clone().into());
        map.insert("quick_snooze_min".into(), self.quick_snooze_min.into());
        if let Some(pos) = self.widget_pos {
            map.insert(
                "widget_pos".into(),
                serde_json::json!({ "x": pos.x, "y": pos.y }),
            );
        }
        map.insert("autostart".into(), self.autostart.into());
        map.insert("theme".into(), self.theme.clone().into());
        map.insert("sound_on_alert".into(), self.sound_on_alert.into());
        // Igual que `widget_pos`: en `None` se omite. La ausencia de la clave ya
        // significa "el primario", y un `null` en un archivo que el usuario
        // abre a mano es ruido.
        if let Some(name) = &self.monitor {
            map.insert("monitor".into(), name.clone().into());
        }
        Value::Object(map)
    }
}

// ---------------------------------------------------------------------------
// Plomeria: el puente con `tauri-plugin-store`.
//
// Nada de aca abajo se testea con `cargo test` -habria que levantar una app de
// Tauri entera-, y por eso nada de aca abajo decide nada: toda la interpretacion
// del JSON vive arriba, en `from_json`.
// ---------------------------------------------------------------------------

/// Nombre del archivo dentro del directorio de datos de la app. El plugin
/// resuelve la ruta completa (`%APPDATA%\com.kobyuu.cairn\store.json`).
const STORE_FILE: &str = "store.json";

/// Lee los ajustes del disco.
///
/// **Nunca falla.** Verificado contra la fuente del plugin (store.rs, `build()`):
/// el resultado de cargar el archivo se descarta con `let _ = store_inner.load()`,
/// asi que un `store.json` ausente, vacio o corrupto devuelve un store **vacio**
/// en vez de un error. Sumado a que `from_json` tolera cualquier JSON, borrar el
/// archivo a mano arranca con defaults y sin un solo mensaje de error.
pub fn load(app: &AppHandle) -> Settings {
    let Ok(store) = app.store(STORE_FILE) else {
        eprintln!("[cairn] no se pudo abrir {STORE_FILE}; sigo con los ajustes por defecto");
        return Settings::default();
    };
    Settings::from_json(&Value::Object(store.entries().into_iter().collect()))
}

/// Escribe los ajustes al disco, pisando el archivo entero.
///
/// El `clear()` previo no es paranoia: sin el, una clave que dejo de existir
/// -por ejemplo `widget_pos` cuando vuelve a `None`- quedaria en el archivo para
/// siempre, y la proxima lectura la resucitaria.
pub fn save(app: &AppHandle, settings: &Settings) {
    let Ok(store) = app.store(STORE_FILE) else {
        eprintln!("[cairn] no se pudo abrir {STORE_FILE}; los ajustes no se guardaron");
        return;
    };
    // El orden importa: primero se arma lo que se va a escribir, y RECIEN
    // despues se borra lo que hay. Al reves -clear y despues intentar armar- un
    // `to_json` que no devolviera un objeto dejaria el archivo vacio y guardado.
    // Hoy es inalcanzable, pero es la forma que convierte un bug futuro en
    // perdida de datos en vez de en un no-op.
    let Value::Object(map) = settings.to_json() else {
        eprintln!("[cairn] los ajustes no serializaron a un objeto; no se guardo nada");
        return;
    };
    store.clear();
    for (key, value) in map {
        store.set(key, value);
    }
    // El plugin no persiste solo salvo que se configure `auto_save`; el guardado
    // es explicito a proposito, para que la escritura ocurra cuando cambia un
    // ajuste y no en un debounce que puede quedar a mitad al salir.
    if let Err(error) = store.save() {
        eprintln!("[cairn] no se pudo guardar {STORE_FILE}: {error}");
    }
}

/// Lee, modifica y vuelve a escribir. Es la unica forma de tocar un ajuste
/// desde el resto del core.
pub fn update<F: FnOnce(&mut Settings)>(app: &AppHandle, apply: F) {
    let mut settings = load(app);
    apply(&mut settings);
    save(app, &settings);
}

/// Los ajustes tal como los ve el frontend.
///
/// `autostart` **no** sale del JSON: se le pregunta al plugin, que lee la
/// entrada real del registro de Windows. Si el usuario la borro a mano desde el
/// Administrador de tareas, el JSON quedo mintiendo, y entonces se corrige el
/// JSON -manda el sistema operativo, no nuestro archivo-.
#[tauri::command]
pub fn settings_snapshot(app: AppHandle) -> Settings {
    let mut settings = load(&app);
    match app.autolaunch().is_enabled() {
        Ok(enabled) => {
            if enabled != settings.autostart {
                settings.autostart = enabled;
                save(&app, &settings);
            }
        }
        Err(error) => {
            eprintln!("[cairn] no se pudo leer el inicio con Windows: {error}");
        }
    }
    settings
}

/// Aplica el toggle al registro **y** al JSON, en ese orden.
///
/// Si el registro falla, el JSON no se toca: mejor un toggle que no se movio
/// que un archivo que dice "si" mientras Windows dice "no".
#[tauri::command]
pub fn settings_set_autostart(app: AppHandle, enabled: bool) -> Result<Settings, String> {
    {
        let manager = app.autolaunch();
        let applied = if enabled {
            manager.enable()
        } else {
            manager.disable()
        };
        applied.map_err(|error| format!("no se pudo cambiar el inicio con Windows: {error}"))?;
    }
    update(&app, |settings| settings.autostart = enabled);
    // `broadcast` y no `settings_snapshot`: el registro se acaba de aplicar y el
    // JSON se acaba de escribir, asi que volver a preguntarle al plugin solo
    // agrega una segunda escritura del archivo por cada toggle. Y emite, como
    // todos los demas setters: que un solo ajuste sea la excepcion a "todo
    // cambio avisa" es la clase de detalle con la que tropieza la feature que
    // venga despues.
    Ok(broadcast(&app))
}

/// Nombre del evento con el que el core avisa que los ajustes cambiaron.
///
/// Existe por el tema: las tres ventanas estan vivas a la vez -aunque dos
/// esten escondidas- y el tema tiene que cambiar en las tres. Sin el evento,
/// el Widget seguiria en oscuro hasta que alguien lo reabra.
const EVENT_CHANGED: &str = "settings-changed";

/// Lee los ajustes del disco y se los emite a todas las ventanas.
///
/// La llaman los comandos de aca abajo y tambien `modes::set_mode`, para que
/// cambiar de modo desde la bandeja actualice la tarjeta de MODOS que puede
/// estar abierta en Ajustes.
///
/// El `emit` falla como mucho por un webview que ya no esta; se loguea y no se
/// propaga, porque el ajuste YA quedo en disco y devolver error haria que el
/// frontend creyera que no se guardo.
pub fn broadcast(app: &AppHandle) -> Settings {
    let settings = load(app);
    if let Err(error) = app.emit(EVENT_CHANGED, &settings) {
        eprintln!("[cairn] no se pudo emitir {EVENT_CHANGED}: {error}");
    }
    settings
}

/// Escribe el ajuste, lo emite y lo devuelve.
fn apply<F: FnOnce(&mut Settings)>(app: &AppHandle, change: F) -> Settings {
    update(app, change);
    broadcast(app)
}

/// Cambia el tema. `theme` se acota a la lista conocida antes de guardarse: el
/// valor entra por IPC y un string arbitrario no puede llegar a `store.json`.
///
/// Quien traduce `"system"` a claro u oscuro es el frontend (`src/theme.ts`):
/// `prefers-color-scheme` solo existe adentro del webview.
#[tauri::command]
pub fn settings_set_theme(app: AppHandle, theme: String) -> Settings {
    let theme = one_of(theme, &THEMES, DEFAULT_THEME);
    apply(&app, |settings| settings.theme = theme)
}

/// Enciende o apaga el tono del aviso.
#[tauri::command]
pub fn settings_set_sound(app: AppHandle, enabled: bool) -> Settings {
    apply(&app, |settings| settings.sound_on_alert = enabled)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    /// Un nombre de monitor real de Windows. Va como cadena CRUDA (`r"..."`)
    /// una sola vez: escrito con escapes, `"\\.\DISPLAY2"` ni compila -`\D` no
    /// es un escape valido en Rust- y con los escapes correctos
    /// (`"\\\\.\\DISPLAY2"`) nadie puede leer de un vistazo cuantas barras hay.
    const DISPLAY_2: &str = r"\\.\DISPLAY2";

    fn populated() -> Settings {
        Settings {
            interval_min: 30,
            default_mode: "widget".into(),
            quick_snooze_min: 7,
            widget_pos: Some(WidgetPos { x: 1200, y: 80 }),
            autostart: true,
            theme: "light".into(),
            sound_on_alert: true,
            monitor: Some(DISPLAY_2.into()),
        }
    }

    #[test]
    fn reads_a_complete_file() {
        let json = json!({
            "interval_min": 30,
            "default_mode": "widget",
            "quick_snooze_min": 7,
            "widget_pos": { "x": 1200, "y": 80 },
            "autostart": true,
            "theme": "light",
            "sound_on_alert": true,
            "monitor": DISPLAY_2,
        });
        assert_eq!(Settings::from_json(&json), populated());
    }

    #[test]
    fn missing_keys_fall_back_to_defaults() {
        // Un archivo escrito por una version vieja, o uno recortado a mano.
        let json = json!({ "interval_min": 30 });
        let expected = Settings {
            interval_min: 30,
            ..Settings::default()
        };
        assert_eq!(Settings::from_json(&json), expected);
    }

    #[test]
    fn an_empty_object_is_all_defaults() {
        assert_eq!(Settings::from_json(&json!({})), Settings::default());
    }

    #[test]
    fn wrong_types_fall_back_field_by_field() {
        // Este es el test que justifica no usar `#[derive(Deserialize)]`: con
        // el struct entero, estos tres campos podridos se llevarian puestos a
        // los otros tres, que estan perfectos.
        let json = json!({
            "interval_min": "treinta",
            "default_mode": 7,
            "quick_snooze_min": 7,
            "widget_pos": "1200,80",
            "autostart": true,
            "theme": "light",
            "sound_on_alert": "si",
            "monitor": 2,
        });
        let expected = Settings {
            interval_min: DEFAULT_INTERVAL_MIN,
            default_mode: DEFAULT_MODE.into(),
            quick_snooze_min: 7,
            widget_pos: None,
            autostart: true,
            theme: "light".into(),
            sound_on_alert: false,
            monitor: None,
        };
        assert_eq!(Settings::from_json(&json), expected);
    }

    #[test]
    fn a_negative_interval_is_a_wrong_type_too() {
        // `interval_min` es u64: un negativo no deserializa y cae al default.
        // Vale la pena clavarlo porque es la unica forma de meter un numero
        // invalido sin escribir un string.
        let json = json!({ "interval_min": -5 });
        assert_eq!(
            Settings::from_json(&json).interval_min,
            DEFAULT_INTERVAL_MIN
        );
    }

    #[test]
    fn junk_that_is_not_an_object_is_all_defaults() {
        // Lo que se pasa cuando el archivo esta vacio, truncado o no parsea.
        for junk in [Value::Null, json!([1, 2, 3]), json!("nada"), json!(42)] {
            assert_eq!(Settings::from_json(&junk), Settings::default(), "{junk}");
        }
    }

    #[test]
    fn an_invalid_mode_or_theme_falls_back() {
        // Tipo correcto, valor inventado: `store.json` es editable a mano.
        let json = json!({ "default_mode": "zen", "theme": "neon" });
        let settings = Settings::from_json(&json);
        assert_eq!(settings.default_mode, DEFAULT_MODE);
        assert_eq!(settings.theme, DEFAULT_THEME);
    }

    #[test]
    fn the_three_themes_of_the_handoff_are_accepted() {
        // El chip "Sistema" es una opcion del handoff, no un invento del
        // frontend: si `one_of` no la reconociera, elegirla escribiria "dark"
        // en el archivo y el chip volveria solo a Oscuro al reabrir.
        for theme in ["system", "dark", "light"] {
            let settings = Settings::from_json(&json!({ "theme": theme }));
            assert_eq!(settings.theme, theme);
        }
    }

    #[test]
    fn unknown_keys_are_ignored() {
        let json = json!({ "interval_min": 30, "algo_que_no_existe": true });
        assert_eq!(Settings::from_json(&json).interval_min, 30);
    }

    #[test]
    fn roundtrip_is_idempotent() {
        for settings in [Settings::default(), populated()] {
            let once = Settings::from_json(&settings.to_json());
            assert_eq!(once, settings);
            // Dos vueltas: si `to_json` perdiera una clave, la primera vuelta
            // podria disimularlo cayendo justo al default.
            assert_eq!(Settings::from_json(&once.to_json()), settings);
        }
    }

    #[test]
    fn the_optional_fields_are_omitted_not_nulled() {
        let json = Settings::default().to_json();
        assert!(json.get("widget_pos").is_none());
        assert!(json.get("monitor").is_none());
        assert_eq!(json.get("interval_min"), Some(&json!(DEFAULT_INTERVAL_MIN)));
    }

    #[test]
    fn the_stored_keys_are_snake_case() {
        // El spec fija las claves de `store.json`. Si alguien pone
        // `rename_all = "camelCase"` de mas, el archivo del usuario se rompe en
        // silencio y arranca con defaults sin explicacion.
        let json = populated().to_json();
        let object = json.as_object().expect("to_json devuelve un objeto");
        let mut keys: Vec<&str> = object.keys().map(String::as_str).collect();
        keys.sort_unstable();
        assert_eq!(
            keys,
            [
                "autostart",
                "default_mode",
                "interval_min",
                "monitor",
                "quick_snooze_min",
                "sound_on_alert",
                "theme",
                "widget_pos"
            ]
        );
    }

    #[test]
    fn the_wire_format_to_the_frontend_is_camel_case() {
        // El otro contrato, el que no puede chequear ningun compilador: lo que
        // ve React. Si serde renombra un campo, el toggle de autostart deja de
        // reflejar el estado real y el build sigue verde.
        let json = serde_json::to_value(populated()).expect("Settings serializa");
        assert_eq!(
            json,
            json!({
                "intervalMin": 30,
                "defaultMode": "widget",
                "quickSnoozeMin": 7,
                "widgetPos": { "x": 1200, "y": 80 },
                "autostart": true,
                "theme": "light",
                "soundOnAlert": true,
                "monitor": DISPLAY_2,
            })
        );
    }
}
