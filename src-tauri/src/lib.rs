use reqwest::blocking::Client;
use std::fs;
use std::path::Path;
use std::process::Command;

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

// --- UTILITAIRES ---

// Fonction de scan récursif (version native fs, pas besoin de WalkDir)
fn visit_dirs(dir: &Path, root_str: &str) -> Vec<FileNode> {
    let mut nodes = Vec::new();
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries {
            if let Ok(entry) = entry {
                let path = entry.path();
                let name = entry.file_name().to_string_lossy().to_string();

                // Ignorer les fichiers cachés et dossiers système
                if name.starts_with('.') || name == "System Volume Information" {
                    continue;
                }

                let is_dir = path.is_dir();
                let full_path_str = path.to_string_lossy().to_string();

                // Calcul du chemin relatif propre pour le frontend
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
                        // Lecture du contenu seulement pour les fichiers .md pour la performance
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
    // Tri alphabétique pour un affichage propre (Dossiers puis Fichiers ou Mixte)
    nodes.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    nodes
}

// --- NOUVELLE FONCTION V11.5 : IMPORT DRAG & DROP ---
#[tauri::command]
fn import_file(
    vault_path: String,
    target_folder: String,
    source_path: String,
) -> Result<String, String> {
    let source = Path::new(&source_path);

    // Récupération sécurisée du nom de fichier
    let file_name = source
        .file_name()
        .ok_or("Impossible de lire le nom du fichier")?
        .to_string_lossy()
        .to_string();

    // Construction du chemin cible
    let target_dir = Path::new(&vault_path).join(&target_folder);

    // Création dossier si inexistant (sécurité)
    if !target_dir.exists() {
        fs::create_dir_all(&target_dir).map_err(|e| e.to_string())?;
    }

    let mut final_path = target_dir.join(&file_name);

    // Gestion des doublons (ajout timestamp)
    if final_path.exists() {
        let timestamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();

        let name_stem = source.file_stem().unwrap_or_default().to_string_lossy();
        let ext = source.extension().unwrap_or_default().to_string_lossy();

        let new_name = if ext.is_empty() {
            format!("{}_{}", name_stem, timestamp)
        } else {
            format!("{}_{}.{}", name_stem, timestamp, ext)
        };
        final_path = target_dir.join(new_name);
    }

    // Copie physique
    fs::copy(&source, &final_path).map_err(|e| e.to_string())?;

    Ok("Import réussi".to_string())
}

// --- COMMANDES EXISTANTES ---

#[tauri::command]
fn update_links_on_move(
    vault_path: String,
    old_path_rel: String,
    new_path_rel: String,
) -> Result<String, String> {
    // Placeholder fonctionnel pour éviter les erreurs de compilation si WalkDir manque
    // La logique frontend mettra à jour l'interface, le backend suivra dans une prochaine maj
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
    // Création du dossier parent si nécessaire
    if let Some(parent) = Path::new(&path).parent() {
        if !parent.exists() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
    }
    fs::write(&path, content).map_err(|e| e.to_string())?;
    Ok("OK".to_string())
}

#[tauri::command]
fn read_note(path: String) -> Result<String, String> {
    let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    Ok(content)
}

#[tauri::command]
fn save_note(path: String, content: String) -> Result<String, String> {
    fs::write(&path, content).map_err(|e| e.to_string())?;
    Ok("OK".to_string())
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
    // Gestion intelligente des chemins absolus/relatifs
    let old_full = if old_path.contains(&vault_path) {
        old_path.clone()
    } else {
        Path::new(&vault_path)
            .join(&old_path)
            .to_string_lossy()
            .to_string()
    };

    let source = Path::new(&old_full);
    let parent = source.parent().ok_or("No parent")?;
    let new_full = parent.join(&new_name);

    fs::rename(source, new_full).map_err(|e| e.to_string())?;
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

#[tauri::command]
fn scan_vault_recursive(root: String) -> Vec<FileNode> {
    let root_path = Path::new(&root);
    visit_dirs(root_path, &root)
}

// --- POINT D'ENTRÉE PRINCIPAL (BUILDER) ---
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // PLUGIN OPENER SUPPRIMÉ car non installé/utilisé
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_store::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            // Système
            check_system_status,
            check_microsoft_connection,
            // Fichiers Base
            create_folder,
            create_note,
            read_note,
            save_note,
            delete_note,
            delete_folder,
            rename_item,
            move_file_system_entry,
            scan_vault_recursive,
            save_binary_file,
            // Externes
            open_file,
            open_outlook_window,
            // Logic
            update_links_on_move,
            // NOUVEAUTÉ V11.5
            import_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
