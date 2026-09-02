/// Arranca el proceso de Tauri: crea la ventana declarada en `tauri.conf.json`
/// y le entrega el control al loop de eventos del sistema, que no vuelve hasta
/// que la app termina.
pub fn run() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("no se pudo iniciar Tauri");
}

#[cfg(test)]
mod tests {
    #[test]
    fn el_runner_de_cargo_corre() {
        assert_eq!(1 + 1, 2);
    }
}
