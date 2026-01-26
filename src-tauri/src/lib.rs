use tauri_plugin_fs::FsExt;
use tauri_plugin_sql::{Builder, Migration, MigrationKind};
use walkdir::WalkDir;
use std::path::Path;
use std::fs;

// --- UTILITY FUNCTIONS ---

// Helper function for recursive scanning
fn get_all_md_files(dir: &Path) -> std::io::Result<Vec<std::path::PathBuf>> {
    let mut files = Vec::new();
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries {
            if let Ok(entry) = entry {
                let path = entry.path();
                if path.is_dir() {
                    files.extend(get_all_md_files(&path)?);
                } else if let Some(ext) = path.extension() {
                    if ext == "md" {
                        files.push(path);
                    }
                }
            }
        }
    }
    Ok(files)
}

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
                code TEXT,          -- Pour 1, 1.1, 1.2
                status TEXT,        -- TODO / DONE
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

// --- DATA STRUCTURES ---

#[derive(serde::Serialize)]
struct FileNode {
    path: String, name: String, is_dir: bool, extension: String, content: String,
}

// --- TAURI COMMANDS ---

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
    Err("Not implemented correctly yet - need direct store".to_string()) 
}

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

#[tauri::command]
fn rename_item(vault_path: String, old_path: String, new_name: String) -> Result<(), String> {
    let root = std::path::Path::new(&vault_path);
    let source = root.join(&old_path);
    
    if !source.exists() {
        return Err("L'élément n'existe pas".to_string());
    }

    let parent = source.parent().ok_or("Erreur parent")?;
    let new_path = parent.join(&new_name);

    if new_path.exists() {
        return Err("Un élément porte déjà ce nom".to_string());
    }

    std::fs::rename(source, new_path).map_err(|e| e.to_string())
}

#[tauri::command]
fn update_links_on_move(vault_path: String, old_path_rel: String, new_path_rel: String) -> Result<String, String> {
    let old_slash = old_path_rel.replace("\\", "/");
    let new_slash = new_path_rel.replace("\\", "/");
    
    let old_path = Path::new(&old_path_rel);
    let file_stem = old_path.file_stem().unwrap_or_default().to_string_lossy().to_string();
    
    // Formats de liens possibles
    let old_link_full = format!("[[{}]]", old_slash); // [[dossier/fichier.md]]
    let new_link_full = format!("[[{}]]", new_slash);
    
    let old_slash_no_ext = if old_slash.ends_with(".md") { old_slash.trim_end_matches(".md").to_string() } else { old_slash.clone() };
    let new_slash_no_ext = if new_slash.ends_with(".md") { new_slash.trim_end_matches(".md").to_string() } else { new_slash.clone() };
    
    let old_link_no_ext = format!("[[{}]]", old_slash_no_ext); // [[dossier/fichier]]
    let new_link_no_ext = format!("[[{}]]", new_slash_no_ext);
 
    let old_link_base = format!("[[{}]]", file_stem); // [[fichier]]
    
    let mut count = 0;
 
    for entry in WalkDir::new(&vault_path).into_iter().filter_map(|e| e.ok()) {
        let path = entry.path();
        if path.extension().map_or(false, |ext| ext == "md") {
             match std::fs::read(path) {
                 Ok(bytes) => {
                     let content = String::from_utf8_lossy(&bytes).to_string();
                     let mut new_content = content.clone();
                     let mut modified = false;
 
                     // Remplacement Lien Complet
                     if new_content.contains(&old_link_full) {
                         new_content = new_content.replace(&old_link_full, &new_link_full);
                         modified = true;
                     }
                     
                     // Remplacement Lien Sans Extension
                     if old_link_no_ext != old_link_full && new_content.contains(&old_link_no_ext) {
                          new_content = new_content.replace(&old_link_no_ext, &new_link_no_ext);
                          modified = true;
                     }
 
                     // Remplacement Lien Nom Seul (si unique ou simple)
                     if new_content.contains(&old_link_base) {
                          new_content = new_content.replace(&old_link_base, &new_link_no_ext);
                          modified = true;
                     }
                      
                     if modified {
                         if let Err(e) = std::fs::write(path, new_content) {
                             return Err(format!("Failed to write {}: {}", path.display(), e));
                         }
                         count += 1;
                     }
                 },
                 Err(_) => continue,
             }
        }
    }
    Ok(format!("Updated links in {} files", count))
}

// --- APPLICATION ENTRY POINT ---

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_sql::Builder::default().add_migrations("sqlite:aegis_v7.db", get_migrations()).build())
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
            move_file_system_entry,
            update_links_on_move,
            rename_item // <--- La nouvelle commande
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}