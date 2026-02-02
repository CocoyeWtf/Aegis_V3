# 00_PROJECT_STATUS - AEGIS V10.18 EXCEL & UX COMPLETE

Ce document reflète l'état immédiat du projet en version **V10.18 STABLE**.

## ✅ Fonctionnalités "DONE" et Stables

1.  **Architecture Hybride** : Rust (Backend) + React (Frontend).
2.  **Moteur de Recherche (V10.13)** : Full-Text, intégré sidebar.
3.  **Scan & Indexation (V10.16)** :
    * **Récursif** : Lit tous les sous-dossiers.
    * **Robuste** : Insensible à la casse (`.md`/`.MD`).
4.  **UX & Gestion de Fichiers (V10.15)** :
    * **Dossiers** : Renommage et Suppression via panneau dédié.
    * **Drag & Drop** : Fiabilisé.
    * **Viewer** : Délégation OS pour fichiers externes.
5.  **Export Excel (V10.18)** :
    * **Natif** : Utilise l'API Rust binaire pour écrire sur le disque.
    * **Destination** : Dossier système `Downloads` automatique.
    * **Format** : `.xlsx` avec conservation de la hiérarchie (Groupes +/-).

## 🛠 Correctifs Récents

### 1. Export Excel (V10.17 - V10.18)
**État : DÉPLOYÉ**
* Passage d'une logique "Téléchargement Web" à une écriture "Fichier Natif" (`save_binary_file`).
* Ciblage automatique du dossier `Downloads` via `@tauri-apps/api/path`.

### 2. Scan & Master Plan (V10.14 - V10.16)
**État : CORRIGÉ**
* Correction de l'algorithme de scan pour inclure les sous-dossiers (`flattenNodes`).
* Sécurisation des boucles pour éviter qu'un fichier corrompu ne vide le Master Plan.

## ⚠️ Points d'Attention
* **Git** : Penser à utiliser `git push --set-upstream origin <branch>` lors de la création d'une nouvelle feature.