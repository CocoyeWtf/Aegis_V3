use tauri_plugin_fs::FsExt;
use tauri_plugin_sql::{Builder, Migration, MigrationKind};

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

#[tauri::command]
fn create_note(path: String, content: String) -> Result<(), String> {
    std::fs::write(path, content).map_err(|e| e.to_string())
}

#[tauri::command]
fn save_note(path: String, content: String) -> Result<(), String> {
    std::fs::write(path, content).map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_note(path: String) -> Result<(), String> {
    std::fs::remove_file(path).map_err(|e| e.to_string())
}

#[tauri::command]
fn read_all_files(path: String) -> Result<Vec<(String, String)>, String> {
    let mut results = Vec::new();
    match std::fs::read_dir(path) {
        Ok(entries) => {
            for entry in entries.flatten() {
                let p = entry.path();
                if p.is_file() && p.extension().map_or(false, |s| s == "md") {
                    // CORRECTION ICI : On utilise and_then et Some (Option) au lieu de Ok (Result)
                    if let Some(name) = p.file_name().and_then(|n| n.to_str()).map(|s| s.to_string()) {
                        // Lecture "lossy" pour tolérer les caractères Windows
                        if let Ok(bytes) = std::fs::read(&p) {
                            let content = String::from_utf8_lossy(&bytes).to_string();
                            results.push((name, content));
                        }
                    }
                }
            }
            Ok(results)
        }
        Err(e) => Err(format!("Erreur lecture dossier: {}", e)),
    }
}

fn get_migrations() -> Vec<Migration> {
    vec![
        Migration {
            version: 1,
            description: "create_notes_table",
            sql: "CREATE TABLE IF NOT EXISTS notes (
                id TEXT PRIMARY KEY,
                path TEXT UNIQUE NOT NULL,
                content_hash TEXT,
                last_synced INTEGER
            );",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "add_metadata_columns",
            sql: "ALTER TABLE notes ADD COLUMN type TEXT DEFAULT 'NOTE'; 
                  ALTER TABLE notes ADD COLUMN status TEXT DEFAULT 'ACTIVE'; 
                  ALTER TABLE notes ADD COLUMN tags TEXT DEFAULT '';",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 3,
            description: "add_content_column",
            sql: "ALTER TABLE notes ADD COLUMN content TEXT DEFAULT '';",
            kind: MigrationKind::Up,
        }
    ]
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(
            tauri_plugin_sql::Builder::default()
            .add_migrations("sqlite:aegis.db", get_migrations())
            .build()
        )
        .invoke_handler(tauri::generate_handler![
            check_system_status, 
            scan_vault, 
            read_note,
            create_note,
            save_note,
            delete_note,
            read_all_files
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
