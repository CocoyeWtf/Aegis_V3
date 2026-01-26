# 01_TECH_STACK - AEGIS V10.4

## 🧱 Core Technology Stack

*   **Runtime / Backend** : [Tauri v2](https://v2.tauri.app/) (Rust)
    *   Gère les appels Système de Fichiers (`tauri-plugin-fs`), la Base de Données (`tauri-plugin-sql`), et les dialogues.
*   **Frontend** : [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
    *   Build tool : [Vite](https://vitejs.dev/)
*   **Styling** : [TailwindCSS 3.4](https://tailwindcss.com/)
    *   Utilisation extensive pour le layout et le thème "Cockpit" (Dark Mode).
*   **Base de Données (Cache/Index)** : SQLite
    *   Fichier : `aegis_v7.db` (géré automatiquement via migrations Tauri).
    *   Sert uniquement d'index de performance. **Le fichier Markdown reste la Source de Vérité.**

## 📦 Bibliothèques Clés (Frontend)

*   **@dnd-kit/core** : Gestion du Drag & Drop dans le File Explorer (Sidebar).
*   **@tauri-apps/plugin-store** : Persistance de configuration légère (`aegis_config.json` pour le chemin du Vault).
*   **UI Icons** : *Note : Lucide React était spécifié mais n'est pas présent dans le `package.json` actuel. Des émojis natifs sont utilisés en attendant.*

## 📐 Règles Architecturales Inviolables

1.  **Souveraineté des Données (Markdown First)** :
    *   AEGIS n'utilise pas de base de données propriétaire pour le stockage de contenu.
    *   Toute modification dans l'interface (ex: cocher une case) DOIT se répercuter physiquement dans le fichier `.md`.
    *   La BDD SQLite est éphémère : elle peut être détruite et reconstruite à tout moment via un `scan_vault_recursive`.

2.  **Cohérence FileTree <-> BDD** :
    *   Le `FileTree` (État React) reflète le système de fichiers réel.
    *   La `BDD` (SQLite) reflète le contenu indexé.
    *   À chaque modification de fichier (Save), un re-scan ou une mise à jour SQL ciblée est déclenchée pour garder les deux synchronisés.

3.  **Propreté des Fichiers ("Zero Pollution")** :
    *   Les métadonnées techniques (ID, UUID, TYPE, STATUS) sont stockées en fin de fichier sous le séparateur :
        `--- AEGIS METADATA ---`
    *   L'éditeur de texte principal masque cette partie pour ne montrer que le contenu utilisateur.
