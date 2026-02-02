// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::fs;
use std::path::Path;
use std::process::Command;
use tauri::{Emitter, Manager};

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

#[tauri::command]
fn open_file(path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        Command::new("cmd")
            .args(["/C", "start", "", &path])
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg(&path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "linux")]
    {
        Command::new("xdg-open")
            .arg(&path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

// NOUVEAU V10.17 : Ecriture binaire pour Excel
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
fn update_links_on_move(
    _vault_path: String,
    _old_path_rel: String,
    _new_path_rel: String,
) -> Result<String, String> {
    Ok("TODO_RUST_SEARCH_REPLACE".to_string())
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
            update_links_on_move,
            open_file,
            save_binary_file // <--- AJOUTE ICI
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
