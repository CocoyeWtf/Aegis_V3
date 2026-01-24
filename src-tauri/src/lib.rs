use tauri_plugin_fs::FsExt;

#[tauri::command]
fn check_system_status() -> String {
    "AEGIS KERNEL: ONLINE".to_string()
}

#[tauri::command]
fn scan_vault(path: String) -> Result<Vec<String>, String> {
    let mut files = Vec::new();
    match std::fs::read_dir(path) {
        Ok(entries) => {
            for entry in entries {
                if let Ok(entry) = entry {
                    let path = entry.path();
                    if path.is_file() && path.extension().and_then(|s| s.to_str()) == Some("md") {
                        if let Some(name) = path.file_name().and_then(|s| s.to_str()) {
                            files.push(name.to_string());
                        }
                    }
                }
            }
            Ok(files)
        }
        Err(e) => Err(format!("Erreur scan: {}", e)),
    }
}

#[tauri::command]
fn read_note(path: String) -> Result<String, String> {
    match std::fs::read(&path) {
        Ok(bytes) => Ok(String::from_utf8_lossy(&bytes).to_string()),
        Err(e) => Err(e.to_string()),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            check_system_status, 
            scan_vault, 
            read_note
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
