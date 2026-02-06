#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use reqwest::blocking::Client;
use std::fs;
use std::path::Path;
use std::process::Command;
use tauri::{Emitter, Manager, WebviewUrl, WebviewWindowBuilder};

// --- TYPES ---
#[derive(serde::Serialize, Clone)]
struct FileNode {
    name: String,
    path: String,
    is_dir: bool,
    children: Vec<FileNode>,
    extension: String,
    content: String,
}

// --- COMMANDS ---

// V10.23 FIX : Noms des arguments corrigés pour correspondre au Frontend (vaultPath -> vault_path)
#[tauri::command]
fn update_links_on_move(
    vault_path: String,
    old_path_rel: String,
    new_path_rel: String,
) -> Result<String, String> {
    // Pour l'instant, on renvoie OK pour ne pas bloquer le renommage.
    // La logique de recherche/remplacement des liens [[wikilinks]] viendra plus tard.
    println!(
        "TODO: Update links in {} from {} to {}",
        vault_path, old_path_rel, new_path_rel
    );
    Ok("LINKS_UPDATE_PENDING".to_string())
}

#[tauri::command]
fn open_outlook_window(_app: tauri::AppHandle) -> Result<(), String> {
    open::that("https://outlook.office.com/mail/").map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn check_microsoft_connection() -> Result<String, String> {
    let client = Client::new();
    let res = client
        .get("https://login.microsoftonline.com")
        .timeout(std::time::Duration::from_secs(5))
        .send()
        .map_err(|e| format!("{}", e))?;
    if res.status().is_success() {
        Ok("CONNEXION_OK".to_string())
    } else {
        Ok(format!("STATUS_{}", res.status()))
    }
}

#[tauri::command]
fn open_file(path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        Command::new("cmd")
            .args(["/C", "start", "", &path])
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}
#[tauri::command]
fn save_binary_file(path: String, content: Vec<u8>) -> Result<String, String> {
    fs::write(&path, content).map_err(|e| e.to_string())?;
    Ok("OK".to_string())
}
#[tauri::command]
fn check_system_status() -> String {
    "SYSTEM_READY".to_string()
}
#[tauri::command]
fn create_folder(path: String) -> Result<String, String> {
    fs::create_dir_all(&path).map_err(|e| e.to_string())?;
    Ok("OK".to_string())
}
#[tauri::command]
fn create_note(path: String, content: String) -> Result<String, String> {
    fs::write(&path, content).map_err(|e| e.to_string())?;
    Ok("OK".to_string())
}
#[tauri::command]
fn read_note(path: String) -> Result<String, String> {
    let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    Ok(content)
}
#[tauri::command]
fn delete_note(path: String) -> Result<String, String> {
    fs::remove_file(&path).map_err(|e| e.to_string())?;
    Ok("OK".to_string())
}
#[tauri::command]
fn delete_folder(path: String) -> Result<String, String> {
    fs::remove_dir_all(&path).map_err(|e| e.to_string())?;
    Ok("OK".to_string())
}
#[tauri::command]
fn rename_item(vault_path: String, old_path: String, new_name: String) -> Result<String, String> {
    let old_full = if old_path.contains(&vault_path) {
        old_path.clone()
    } else {
        format!("{}\\{}", vault_path, old_path)
    };
    let parent = Path::new(&old_full).parent().ok_or("No parent")?;
    let new_full = parent.join(&new_name);
    fs::rename(old_full, new_full).map_err(|e| e.to_string())?;
    Ok("OK".to_string())
}
#[tauri::command]
fn move_file_system_entry(
    source_path: String,
    destination_folder: String,
) -> Result<String, String> {
    let src = Path::new(&source_path);
    let file_name = src.file_name().ok_or("Invalid source name")?;
    let dest = Path::new(&destination_folder).join(file_name);
    fs::rename(src, dest).map_err(|e| e.to_string())?;
    Ok("OK".to_string())
}
fn visit_dirs(dir: &Path, root_str: &str) -> Vec<FileNode> {
    let mut nodes = Vec::new();
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries {
            if let Ok(entry) = entry {
                let path = entry.path();
                let name = entry.file_name().to_string_lossy().to_string();
                if name.starts_with('.') || name == "System Volume Information" {
                    continue;
                }
                let is_dir = path.is_dir();
                let full_path_str = path.to_string_lossy().to_string();
                let relative_path = full_path_str
                    .replace(root_str, "")
                    .trim_start_matches('\\')
                    .trim_start_matches('/')
                    .replace('\\', "/");
                let mut extension = "".to_string();
                let mut content = "".to_string();
                let mut children = Vec::new();
                if is_dir {
                    children = visit_dirs(&path, root_str);
                } else {
                    if let Some(ext) = path.extension() {
                        extension = ext.to_string_lossy().to_string().to_lowercase();
                        if extension == "md" {
                            if let Ok(c) = fs::read_to_string(&path) {
                                content = c;
                            }
                        }
                    }
                }
                nodes.push(FileNode {
                    name,
                    path: relative_path,
                    is_dir,
                    children,
                    extension,
                    content,
                });
            }
        }
    }
    nodes
}
#[tauri::command]
fn scan_vault_recursive(root: String) -> Vec<FileNode> {
    let root_path = Path::new(&root);
    visit_dirs(root_path, &root)
}
#[tauri::command]
fn save_note(path: String, content: String) -> Result<String, String> {
    fs::write(&path, content).map_err(|e| e.to_string())?;
    Ok("OK".to_string())
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            check_system_status,
            create_folder,
            create_note,
            read_note,
            save_note,
            delete_note,
            delete_folder,
            rename_item,
            move_file_system_entry,
            scan_vault_recursive,
            update_links_on_move, // <--- C'est ici que ça bloquait
            open_file,
            save_binary_file,
            check_microsoft_connection,
            open_outlook_window
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
