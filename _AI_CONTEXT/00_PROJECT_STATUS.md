# 00_PROJECT_STATUS - AEGIS V10.15 PREPARATION

Ce document définit les priorités immédiates pour le cycle de développement V10.15.

## 🎯 Objectifs de la Session (V10.15)

1.  **Export Excel (Master Plan & Note)** :
    * Format `.xlsx`.
    * Conservation de la hiérarchie (WBS 1 -> 1.1 -> 1.1.1).
    * Utilisation des "Outline Levels" Excel (Groupes +/-) pour plier/déplier.
2.  **UX Fix : Gestion des Dossiers** :
    * Problème actuel : Impossible de supprimer un dossier car la barre d'outils disparaît si aucun fichier n'est actif.
    * Solution : Afficher un header contextuel "Dossier" avec boutons Rename/Trash quand un dossier est sélectionné.

## ✅ Fonctionnalités "DONE" (V10.14)

1.  **Architecture Hybride** : Rust/React + SQLite.
2.  **Moteur de Recherche** : Full-text sidebar.
3.  **Scan Récursif** : Analyse complète des sous-dossiers.
4.  **UX Avancée** : Drag&Drop, Viewer externe, Resize double.

## 🛠 Stack Technique Ajoutée
* **Librairie Excel** : Nous allons utiliser `xlsx` (SheetJS) pour le frontend.

## ⚠️ Règles de Développement
* **Sauvegarde** : Toujours vérifier le `handleScan` après modif.
* **Git** : Travailler sur `feature/excel-export-fix`.