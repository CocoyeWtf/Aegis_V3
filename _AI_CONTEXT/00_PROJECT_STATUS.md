# 00_PROJECT_STATUS - AEGIS V10.12 FULL-FIX

Ce document reflète l'état immédiat du projet en version **V10.12 STABLE**.

## ✅ Fonctionnalités "DONE" et Stables

1.  **Architecture Hybride** : Rust (Backend) + React (Frontend).
2.  **Cockpit & Gestion Notes** :
    * **Viewer Hybride** : Éditeur pour `.md`, Bouton "Ouvrir" système pour `.pdf/.xlsx`.
    * **Rename** : Via Clic-Droit dans la Sidebar ou Bouton dédié en haut.
    * **Drag & Drop** : Fichiers ET Dossiers déplaçables.
3.  **Master Plan** : Vue groupée, Tri, Filtre, Commentaires.
4.  **UX Avancée** :
    * **Double Resize** : Sidebar Gauche (Navigation) et Droite (Métadonnées) redimensionnables à la souris.
    * **Sensibilité Souris** : Utilisation de `MouseSensor` (seuil 5px) pour distinguer nettement le Clic du Drag.

## 🛠 Correctifs Récents (V10.12)

### 1. Conflit Clic vs Drag (Sidebar)
**État : CORRIGÉ**
* Passage aux capteurs explicites (`MouseSensor` + `TouchSensor`) au lieu de `PointerSensor`.
* Le "Drag" ne s'active qu'après un mouvement de 5 pixels, rendant le clic simple instantané et fiable.

### 2. Fonctionnalités Restaurées
**État : CORRIGÉ**
* **Rename** : Réintégration du menu contextuel (Clic-Droit) sur la Sidebar.
* **Folder Drag** : Les dossiers sont de nouveau déplaçables.

## ⚠️ Points d'Attention
* **Fichiers Externes** : Aegis ne tente plus d'afficher les binaires (PDF/Excel) pour éviter les erreurs, il délègue à l'OS (`open_file`).
* **Sécurité** : Le Drag & Drop inclut une sécurité pour empêcher de déposer un fichier sur lui-même (Error 32).