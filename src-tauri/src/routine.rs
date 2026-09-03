//! La rutina: un `.md` de verdad en `<app_data_dir>/notes/routine.md`.
//!
//! Igual que `settings.rs`, el archivo se parte en dos: arriba lo que toca el
//! disco a traves de un `&Path` -que `cargo test` puede ejercitar con un
//! directorio temporal-, y abajo los dos comandos, que lo unico que agregan es
//! resolver la ruta a partir del `AppHandle`.
//!
//! Por que un archivo y no una clave en `store.json` (D9, CLAUDE.md §3): la
//! rutina es CONTENIDO que el usuario escribio a mano, no un ajuste. Vive en un
//! directorio -`notes/`- para que la etapa 2 del producto sea "mas archivos ahi
//! adentro" y no una migracion.

use std::fs::{self, File};
use std::io::{self, Write};
use std::path::{Path, PathBuf};

use tauri::{AppHandle, Manager};

const NOTES_DIR: &str = "notes";
const ROUTINE_FILE: &str = "routine.md";

/// Lo que se escribe la primera vez: la rutina de correccion de postura de Manu.
///
/// Es solo el contenido inicial, no una constante de comportamiento: en cuanto
/// el archivo existe, nadie lo vuelve a mirar (`read_at` solo lo usa cuando NO
/// hay archivo). Cambiarlo no afecta a una instalacion que ya lo tenga.
const DEFAULT_ROUTINE: &str = "# Corrección de postura

- [ ] Retracción cervical (chin tuck) — 10 x 3 segundos
- [ ] Extensión torácica sobre toalla enrollada — 8-10 respiraciones
- [ ] Estiramiento de pectoral en el marco de la puerta — 2 x 30 s por lado
- [ ] Y-T-W en el piso — 2 x 8 de cada letra
- [ ] Retracción escapular — 15 x 3 segundos
- [ ] Estiramiento de flexores de cadera — 2 x 30 s por lado

> Si duele, pará. No es una rutina de fuerza.
";

/// El temporal de la escritura atomica: `routine.md` → `routine.md.tmp`.
///
/// Se arma pegando la extension al nombre completo y no con `with_extension`,
/// que reemplaza la extension existente en vez de agregar una.
fn tmp_path(path: &Path) -> PathBuf {
    let mut name = path.as_os_str().to_os_string();
    name.push(".tmp");
    PathBuf::from(name)
}

/// Lee la rutina. Si el archivo no existe, lo crea con el ejemplo y lo devuelve.
///
/// El `NotFound` se distingue del resto de los errores a proposito: "todavia no
/// hay rutina" es el arranque normal, y "el disco esta lleno" o "no tengo
/// permiso" no se pueden disimular devolviendo el ejemplo -el usuario creeria
/// que perdio la rutina y la reescribiria encima-.
///
/// **Se le saca el BOM de UTF-8 si lo trae.** El Bloc de Notas ofrece
/// "UTF-8 con BOM" en su desplegable de codificacion, y `read_to_string` deja
/// ese `\u{feff}` como primer caracter del texto. Cualquier cosa que mire el
/// principio del documento -el `#` del titulo, una casilla en la linea 1- deja
/// de reconocerlo, y sin un solo error: la etiqueta de Foco se queda vacia y
/// nadie sabe por que. Se limpia ACA, en la unica puerta por la que entra el
/// archivo, y no en cada funcion que lo parsea. Al guardar se escribe sin BOM,
/// asi que el archivo queda normalizado en la primera edicion.
pub fn read_at(path: &Path) -> io::Result<String> {
    match fs::read_to_string(path) {
        Ok(text) => Ok(text.strip_prefix('\u{feff}').unwrap_or(&text).to_string()),
        Err(error) if error.kind() == io::ErrorKind::NotFound => {
            write_at(path, DEFAULT_ROUTINE)?;
            Ok(DEFAULT_ROUTINE.to_string())
        }
        Err(error) => Err(error),
    }
}

/// Escribe la rutina a un temporal y lo renombra sobre el destino.
///
/// Tres pasos, y ninguno es opcional (SPEC-routine.md §Almacenamiento):
///
/// 1. `create_dir_all`: la primera escritura tambien crea `notes/`, y borrar el
///    directorio entero a mano tiene que seguir arrancando.
/// 2. `sync_all` **antes** del rename: baja los bytes del temporal al disco. Sin
///    esto, el rename puede quedar registrado mientras el contenido sigue en el
///    cache del sistema, y un corte de luz justo ahi deja un `routine.md` de
///    cero bytes -exactamente lo que la escritura atomica venia a evitar-.
/// 3. `rename`: en Windows es `MoveFileExW` con `MOVEFILE_REPLACE_EXISTING`, asi
///    que pisa el destino. Es la unica operacion de la secuencia que el sistema
///    de archivos garantiza como atomica: o esta la rutina vieja entera, o la
///    nueva entera, nunca media.
pub fn write_at(path: &Path, content: &str) -> io::Result<()> {
    if let Some(dir) = path.parent() {
        fs::create_dir_all(dir)?;
    }
    let tmp = tmp_path(path);
    if let Err(error) = write_tmp(&tmp, content) {
        // Si la escritura fallo a mitad, el temporal queda con basura. Borrarlo
        // es cortesia, no correccion -el proximo guardado lo pisa igual-, pero
        // `notes/` es un directorio que el usuario abre, y un `routine.md.tmp`
        // ahi parece otra nota.
        let _ = fs::remove_file(&tmp);
        return Err(error);
    }
    fs::rename(&tmp, path)
}

/// Escribe el temporal completo y lo baja a disco. Separada para que el
/// `write_at` de arriba pueda limpiar en un solo lugar si algo falla.
fn write_tmp(tmp: &Path, content: &str) -> io::Result<()> {
    let mut file = File::create(tmp)?;
    file.write_all(content.as_bytes())?;
    file.sync_all()
}

// ---------------------------------------------------------------------------
// Plomeria: la ruta real y los dos comandos.
//
// Los comandos propios de la app NO necesitan permiso en `capabilities/`: el
// ACL de Tauri v2 solo gatea los `core:*` y los de plugins (CLAUDE.md §11).
// ---------------------------------------------------------------------------

/// `%APPDATA%\com.kobyuu.cairn\notes\routine.md`.
///
/// `app_data_dir` puede fallar -devuelve `Result`- porque en teoria el sistema
/// puede no tener un directorio de datos; en Windows siempre lo tiene, pero el
/// error se propaga igual en vez de un `unwrap` (CLAUDE.md §5).
fn routine_path(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map(|dir| dir.join(NOTES_DIR).join(ROUTINE_FILE))
        .map_err(|error| format!("no se pudo resolver el directorio de datos: {error}"))
}

#[tauri::command]
pub fn routine_read(app: AppHandle) -> Result<String, String> {
    let path = routine_path(&app)?;
    read_at(&path).map_err(|error| format!("no se pudo leer {}: {error}", path.display()))
}

#[tauri::command]
pub fn routine_write(app: AppHandle, content: String) -> Result<(), String> {
    let path = routine_path(&app)?;
    write_at(&path, &content)
        .map_err(|error| format!("no se pudo guardar {}: {error}", path.display()))
}

/// Cuando se toco `routine.md` por ultima vez, en epoch-ms.
///
/// `None` si el archivo todavia no existe o si el sistema no expone la fecha
/// de modificacion: es un dato de adorno de la fila RUTINA de Ajustes, y no
/// tenerlo no puede ser un error que rompa el panel.
///
/// Epoch-ms y no un texto ya formateado por la misma razon que el temporizador
/// manda `deadline_ms`: el formato es decision de la vista, y "hace 3 dias"
/// cambia con el reloj sin que el archivo se toque.
#[tauri::command]
pub fn routine_info(app: AppHandle) -> Option<u64> {
    let path = routine_path(&app).ok()?;
    let modified = fs::metadata(&path).ok()?.modified().ok()?;
    let since_epoch = modified.duration_since(std::time::UNIX_EPOCH).ok()?;
    u64::try_from(since_epoch.as_millis()).ok()
}

/// Abre el Explorador con `routine.md` seleccionado.
///
/// `explorer.exe /select,<ruta>` en vez de una dependencia (`tauri-plugin-opener`,
/// `opener`) para abrir una carpeta: Windows es el unico target (CLAUDE.md §1) y
/// esto son cuatro lineas de `std`.
///
/// **Va por `raw_arg` y no por `arg`, y no es capricho.** `explorer.exe` no
/// parsea su linea de comandos con `CommandLineToArgvW`: la unica forma que
/// entiende es `/select,"<ruta>"`, con las comillas **alrededor de la ruta**.
/// `Command::arg` entrecomilla el argumento ENTERO en cuanto tiene un espacio
/// -`"/select,C:\Users\Juan Manuel\..."`- y con la comilla adelante del
/// `/select` el Explorador ignora el pedido y abre Documentos. No se nota en un
/// usuario sin espacios en el nombre, que es como se cuela hasta produccion.
/// `raw_arg` es seguro (no es `unsafe`) y la ruta la arma `app_data_dir`, no
/// llega por IPC, asi que no hay superficie de inyeccion.
///
/// **El codigo de salida no se mira**: `explorer.exe` devuelve 1 aunque haya
/// abierto la ventana perfectamente, asi que chequearlo reportaria un error que
/// no existe. Lo unico que se propaga es no haber podido lanzar el proceso.
#[tauri::command]
pub fn routine_reveal(app: AppHandle) -> Result<(), String> {
    use std::os::windows::process::CommandExt;

    let path = routine_path(&app)?;
    // La carpeta puede no existir todavia si nunca se abrio la rutina; leerla
    // la crea con el ejemplo, y asi el Explorador no abre en la nada.
    read_at(&path).map_err(|error| format!("no se pudo leer {}: {error}", path.display()))?;
    std::process::Command::new("explorer.exe")
        .raw_arg(format!("/select,\"{}\"", path.display()))
        .spawn()
        .map_err(|error| format!("no se pudo abrir el Explorador: {error}"))?;

    // Y Cairn se saca de encima. Foco es pantalla completa y always-on-top:
    // sin esto el Explorador se abre DETRAS y hay que minimizar a mano, que es
    // justo el paso que este comando venia a ahorrar. Se aparta despues de
    // lanzarlo, para no esconder nada si el proceso no arranco.
    crate::modes::dismiss_focus(&app);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Un directorio propio por test, sin dependencias nuevas: `tempfile` seria
    /// un crate mas para lo que resuelven tres lineas (CLAUDE.md §5).
    fn temp_dir(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("cairn-routine-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).expect("se puede crear el temporal del test");
        dir
    }

    #[test]
    fn reading_a_missing_file_creates_it_with_the_example() {
        // El directorio `notes/` tampoco existe: es el caso de "borre notes/
        // entero" de la checklist manual.
        let path = temp_dir("missing").join(NOTES_DIR).join(ROUTINE_FILE);
        assert!(!path.exists());

        let text = read_at(&path).expect("leer crea el archivo");

        assert_eq!(text, DEFAULT_ROUTINE);
        assert!(
            path.exists(),
            "el ejemplo quedo en disco, no solo en memoria"
        );
        assert_eq!(fs::read_to_string(&path).unwrap(), DEFAULT_ROUTINE);
    }

    #[test]
    fn a_second_read_does_not_overwrite_what_the_user_wrote() {
        let path = temp_dir("second-read").join(ROUTINE_FILE);
        read_at(&path).expect("primera lectura");
        write_at(&path, "# La mia\n").expect("el usuario la edita");

        assert_eq!(read_at(&path).expect("segunda lectura"), "# La mia\n");
    }

    #[test]
    fn a_bom_left_by_notepad_is_stripped_on_read() {
        // El Bloc de Notas ofrece "UTF-8 con BOM" en su desplegable de
        // codificacion. Sin esta limpieza el `#` deja de ser el primer caracter
        // de la linea, el titulo no matchea, y la etiqueta de Foco queda vacia
        // sin un solo error a la vista.
        let path = temp_dir("bom").join(ROUTINE_FILE);
        fs::write(&path, "\u{feff}# La mia\n").expect("escribir con BOM");

        let text = read_at(&path).expect("leer");

        assert_eq!(text, "# La mia\n");
        assert!(!text.starts_with('\u{feff}'));
    }

    #[test]
    fn roundtrip_preserves_utf8_and_the_trailing_newline() {
        let path = temp_dir("utf8").join(ROUTINE_FILE);
        let content = "# Corrección · pausá 🌿\n\n- [x] Mirá el árbol 🌳\n";

        write_at(&path, content).expect("escribir");

        assert_eq!(read_at(&path).expect("leer"), content);
    }

    #[test]
    fn an_empty_routine_is_a_valid_routine() {
        // Borrar todo en el textarea y guardar no puede resucitar el ejemplo:
        // el archivo existe, aunque este vacio, y el ejemplo solo aparece
        // cuando NO hay archivo.
        let path = temp_dir("empty").join(ROUTINE_FILE);
        write_at(&path, "").expect("escribir vacio");

        assert_eq!(read_at(&path).expect("leer"), "");
    }

    #[test]
    fn a_successful_write_leaves_only_the_routine_in_the_directory() {
        // Se lista el directorio en vez de preguntarle a `tmp_path` por su
        // propio resultado: asi el test sigue sirviendo aunque el nombre del
        // temporal cambie, que es justo cuando un `.tmp` colgado pasa
        // desapercibido.
        let dir = temp_dir("only-routine");
        write_at(&dir.join(ROUTINE_FILE), "# Hola\n").expect("escribir");

        let names: Vec<String> = fs::read_dir(&dir)
            .expect("el directorio existe")
            .map(|entry| {
                entry
                    .expect("entrada legible")
                    .file_name()
                    .to_string_lossy()
                    .into_owned()
            })
            .collect();

        assert_eq!(
            names,
            vec![ROUTINE_FILE.to_string()],
            "sobra basura: {names:?}"
        );
    }

    #[test]
    fn a_read_error_that_is_not_missing_never_returns_the_example() {
        // Un error de lectura que NO es "no existe" jamas puede devolver el
        // ejemplo: el usuario creeria que perdio la rutina y la reescribiria
        // encima. Si alguien alguna vez "simplifica" `read_at` a un
        // `read_to_string(path).unwrap_or_else(|_| DEFAULT)`, esto se pone rojo.
        let path = temp_dir("unreadable").join(ROUTINE_FILE);
        fs::create_dir_all(&path).expect("el destino es un directorio, no un archivo");

        let error = read_at(&path).expect_err("leer un directorio no puede salir bien");

        assert_ne!(error.kind(), io::ErrorKind::NotFound, "kind: {error:?}");
        assert!(path.is_dir(), "read_at no puede haber escrito nada encima");
    }

    #[test]
    fn a_failed_write_leaves_the_previous_routine_intact() {
        // El unico motivo por el que la escritura es atomica. Se simula el fallo
        // ocupando el `.tmp` con un directorio -que es tambien lo que quedaria
        // si un guardado anterior hubiera muerto de la peor manera-.
        let path = temp_dir("failed-write").join(ROUTINE_FILE);
        write_at(&path, "# La rutina de Manu\n").expect("la buena");
        fs::create_dir_all(tmp_path(&path)).expect("el .tmp queda ocupado");

        write_at(&path, "# basura\n").expect_err("el temporal no se puede crear");

        assert_eq!(
            fs::read_to_string(&path).unwrap(),
            "# La rutina de Manu\n",
            "un guardado fallido se comio la rutina"
        );
    }

    #[test]
    fn writing_over_an_existing_file_replaces_it() {
        // En Windows el rename es `MoveFileExW`. Sin `MOVEFILE_REPLACE_EXISTING`
        // fallaria con el destino ocupado, y cada guardado despues del primero
        // seria un error silencioso.
        let path = temp_dir("replace").join(ROUTINE_FILE);
        write_at(&path, "# Vieja\n").expect("primera");
        write_at(&path, "# Nueva\n").expect("segunda");

        assert_eq!(fs::read_to_string(&path).unwrap(), "# Nueva\n");
    }

    #[test]
    fn the_tmp_sits_next_to_the_file_and_keeps_the_md_name() {
        // La spec fija `routine.md.tmp`. `with_extension` habria dado
        // `routine.tmp`, que en un directorio de notas parece otra nota.
        let tmp = tmp_path(Path::new("C:\\notes\\routine.md"));
        assert_eq!(tmp.file_name().unwrap(), "routine.md.tmp");
    }

    #[test]
    fn the_example_ends_with_a_newline() {
        // El unico invariante de verdad del ejemplo: todo `.md` termina en un
        // salto de linea. El resto -que tenga titulo, casillas o una cita- es
        // texto que Manu puede reescribir cuando quiera, y clavarlo en un test
        // seria un detector de cambios, no de regresiones.
        assert!(DEFAULT_ROUTINE.ends_with('\n'));
    }
}
