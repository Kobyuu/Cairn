// Evita que Windows abra una consola negra detras de la app en release.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    cairn_lib::run()
}
