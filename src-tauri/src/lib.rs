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

// --- DYNAMIC VAULT MANAGEMENT COMMANDS ---

#[tauri::command]
fn get_active_vault(app: tauri::AppHandle) -> Result<String, String> {
    use tauri_plugin_store::StoreExt;
    let store = app.store("aegis_config.json").map_err(|e| e.to_string())?;
    let val = store.get("vault_path").ok_or("No vault configured")?;
    Err("Not implemented correctly yet - need direct store".to_string()) // Placeholder fix below
}

// SIMPLER APPROACH: Let Frontend handle Store logic, Backend just provides FS access.
// We only need create_vault here.

#[tauri::command]
fn create_vault_directory(path: String) -> Result<(), String> {
    if !std::path::Path::new(&path).exists() {
        std::fs::create_dir_all(&path).map_err(|e| e.to_string())?;
    }
    // Create basic structure
    let inbox = std::path::Path::new(&path).join("01_Inbox");
    let projects = std::path::Path::new(&path).join("10_Projects");
    if !inbox.exists() { std::fs::create_dir_all(inbox).map_err(|e| e.to_string())?; }
    if !projects.exists() { std::fs::create_dir_all(projects).map_err(|e| e.to_string())?; }
    Ok(())
}

#[tauri::command]
fn move_file_system_entry(source_path: String, destination_folder: String) -> Result<(), String> {
    let source = std::path::Path::new(&source_path);
    let file_name = source.file_name().ok_or("Invalid source path")?;
    
    // SECURITY 1: Prevent moving critical folders
    let source_str = source_path.replace("\\", "/");
    if source_str.ends_with("/01_Inbox") || source_str.ends_with("/10_Projects") {
        return Err("This system folder cannot be moved.".to_string());
    }

    let dest_folder = std::path::Path::new(&destination_folder);
    if !dest_folder.is_dir() {
        return Err("Target is not a directory".to_string());
    }

    // SECURITY 2: Recursion Check (Prevent moving folder into its own child)
    // We compare canonical paths to be safe
    if let (Ok(src_canon), Ok(dest_canon)) = (std::fs::canonicalize(source), std::fs::canonicalize(dest_folder)) {
        if dest_canon.starts_with(src_canon) {
             return Err("Recursion Error: Cannot move a folder into itself.".to_string());
        }
    }

    let mut dest_path = dest_folder.join(file_name);
    
    // COLLISION HANDLING
    if dest_path.exists() {
        let name_str = file_name.to_string_lossy();
        let timestamp = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_secs();
        let new_name = if name_str.contains('.') {
            let parts: Vec<&str> = name_str.rsplitn(2, '.').collect();
            format!("{} ({}).{}", parts[1], timestamp, parts[0])
        } else {
             format!("{} ({})", name_str, timestamp)
        };
        dest_path = dest_folder.join(new_name);
    }

    if source == dest_path { return Ok(()); }

    std::fs::rename(source, dest_path).map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_sql::Builder::default().add_migrations("sqlite:aegis_v4.db", get_migrations()).build())
        .invoke_handler(tauri::generate_handler![
            check_system_status, 
            scan_vault_recursive, 
            read_note, 
            save_note, 
            create_note, 
            delete_note, 
            delete_folder, 
            read_all_files, 
            open_external_file, 
            create_folder,
            create_vault_directory,
            move_file_system_entry
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}