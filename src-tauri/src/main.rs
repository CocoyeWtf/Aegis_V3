// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // CORRECTION : On utilise le nom réel du projet 'aegis_v3'
    aegis_v3::run();
}
