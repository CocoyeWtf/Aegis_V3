use tauri_plugin_fs::FsExt;
use tauri_plugin_sql::{Builder, Migration, MigrationKind};
use walkdir::WalkDir;
use std::path::Path;

fn get_migrations() -> Vec<Migration> {
    vec![
        Migration {
            version: 1,
            description: "create_structure",
            sql: "
            CREATE TABLE IF NOT EXISTS notes (id TEXT PRIMARY KEY, path TEXT UNIQUE NOT NULL, content_hash TEXT, last_synced INTEGER, type TEXT, status TEXT, tags TEXT, content TEXT);
            CREATE TABLE IF NOT EXISTS actions (
                id TEXT PRIMARY KEY, 
                note_path TEXT NOT NULL, 
                code TEXT,           -- Pour 1, 1.1, 1.2
                status TEXT,         -- TODO / DONE
                task TEXT, 
                owner TEXT, 
                created_at TEXT,
                deadline TEXT, 
                comment TEXT,
                FOREIGN KEY(note_path) REFERENCES notes(path) ON DELETE CASCADE
            );",
            kind: MigrationKind::Up,
        }
    ]
}

// --- STRUCTURES & COMMANDES (Inchangées mais nécessaires pour le fichier complet) ---
#[derive(serde::Serialize)]
struct FileNode {
    path: String, name: String, is_dir: bool, extension: String, content: String,
}

#[tauri::command]
fn check_system_status() -> String { "AEGIS KERNEL: ONLINE".to_string() }

#[tauri::command]
fn scan_vault_recursive(root: String) -> Result<Vec<FileNode>, String> {
    let mut nodes = Vec::new();
    for entry in WalkDir::new(&root).into_iter().filter_map(|e| e.ok()) {
        let path = entry.path();
        if path.to_string_lossy() == root { continue; }
        if path.to_string_lossy().contains(".git") { continue; }

        let root_path = Path::new(&root);
        let relative_path = path.strip_prefix(root_path).unwrap_or(path).to_string_lossy().replace("\\", "/");
        let name = path.file_name().unwrap_or_default().to_string_lossy().to_string();
        let is_dir = path.is_dir();
        let extension = path.extension().unwrap_or_default().to_string_lossy().to_string();
        
        let content = if !is_dir && extension == "md" {
             match std::fs::read(path) {
                Ok(bytes) => String::from_utf8_lossy(&bytes).to_string(),
                Err(_) => String::new()
             }
        } else { String::new() };

        nodes.push(FileNode { path: relative_path, name, is_dir, extension, content });
    }
    Ok(nodes)
}

#[tauri::command]
fn read_note(path: String) -> Result<String, String> {
    match std::fs::read(&path) { Ok(bytes) => Ok(String::from_utf8_lossy(&bytes).to_string()), Err(e) => Err(e.to_string()) }
}
#[tauri::command]
fn save_note(path: String, content: String) -> Result<(), String> { std::fs::write(path, content).map_err(|e| e.to_string()) }
#[tauri::command]
fn create_note(path: String, content: String) -> Result<(), String> {
    if let Some(parent) = std::path::Path::new(&path).parent() { std::fs::create_dir_all(parent).map_err(|e| e.to_string())?; }
    std::fs::write(path, content).map_err(|e| e.to_string())
}
#[tauri::command]
fn delete_note(path: String) -> Result<(), String> { std::fs::remove_file(path).map_err(|e| e.to_string()) }
#[tauri::command]
fn delete_folder(path: String) -> Result<(), String> {
    std::fs::remove_dir_all(path).map_err(|e| e.to_string())
}
#[tauri::command]
fn open_external_file(path: String) -> Result<(), String> { open::that(path).map_err(|e| e.to_string()) }
#[tauri::command]
fn read_all_files(_path: String) -> Result<Vec<(String, String)>, String> { Ok(Vec::new()) }
#[tauri::command]
fn create_folder(path: String) -> Result<(), String> {
    std::fs::create_dir_all(path).map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_sql::Builder::default().add_migrations("sqlite:aegis_v4.db", get_migrations()).build())
        .invoke_handler(tauri::generate_handler![
            check_system_status, scan_vault_recursive, read_note, save_note, create_note, delete_note, delete_folder, read_all_files, open_external_file, create_folder
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}