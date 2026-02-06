# 00_PROJECT_STATUS - AEGIS V11.50 (DRAG & DROP MASTER)

Dernière mise à jour : 06/02/2026
Branche active : `main`

## 🎯 État Actuel : IMPORT FLUIDE & SOUVERAINETÉ
L'application permet désormais d'importer n'importe quel fichier depuis Windows (Explorateur, Outlook via Bureau) par simple glisser-déposer. L'architecture Rust a été nettoyée et standardisée.

## ✅ Session du 06/02/2026 - Drag & Drop & Refactoring
1.  **Drag & Drop (V11.5)** :
    * Import de fichiers externes vers le dossier actif (ou Inbox par défaut).
    * Overlay visuel (Voile Noir & Or) lors du survol avec un fichier.
    * Contournement des restrictions UIPI Windows (User vs Admin).
2.  **Architecture (Rust)** :
    * Refactoring complet : `main.rs` minimaliste, tout le cerveau déplacé dans `lib.rs`.
    * Nettoyage des dépendances inutilisées (`walkdir`, `opener`).
3.  **Rituels (V11.4)** :
    * Sync automatique vers `00_PROTOCOLS.md` pour la pérennité des données.

## 🛠 Technique
* **Stack** : Tauri v2 (Events `tauri://drag-drop`).
* **Backend** : `std::fs` pour la copie, gestion intelligente des doublons (timestamp).

## ⚠️ Point de Reprise
* Système prêt pour usage intensif.
* Prochaine étape : Exploitation des données (Dashboard ou IA).