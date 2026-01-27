# 00_PROJECT_STATUS - AEGIS V10.14 STABLE

Ce document reflète l'état immédiat du projet en version **V10.14 FINAL**.

## ✅ Fonctionnalités "DONE" et Stables

1.  **Architecture Hybride** : Rust (Backend) + React (Frontend).
2.  **Moteur de Recherche (V10.13)** :
    * Recherche Full-Text instantanée.
    * Interface Sidebar dynamique (Arbre vs Résultats).
3.  **Scan & Indexation (V10.14)** :
    * **Récursif** : Le scan descend désormais dans tous les sous-dossiers (`flattenNodes`).
    * **Robuste** : Insensible à la casse (`.MD` = `.md`).
    * **Master Plan** : Se remplit correctement avec toutes les tâches du Vault.
4.  **UX & Gestion de Fichiers (V10.12)** :
    * **Viewer** : Délégation à l'OS pour PDF/Excel/Images.
    * **Drag & Drop** : Fiabilisé (Seuil 5px, Sécurité anti-boucle).
    * **Rename** : Contextuel et Bouton.
    * **Layout** : Double redimensionnement (Gauche/Droite).

## 🛠 Correctifs Récents

### 1. Scan Master Plan (V10.14)
**État : CORRIGÉ**
* Problème : Le Master Plan était vide car le scan ne lisait que la racine.
* Solution : Ajout de `flattenNodes` dans `App.tsx` pour aplatir l'arborescence avant l'analyse.
* Ajout de la gestion `to_lowercase()` pour les extensions de fichiers.

### 2. Search Engine & UX (V10.13)
**État : DÉPLOYÉ**
* Intégration de la barre de recherche dans la Sidebar.
* Optimisation des capteurs souris/tactile pour éviter les conflits de clic.

## ⚠️ Points d'Attention
* **Base de Données** : Reconstruite à chaque démarrage/scan.
* **Prochaine étape logique** : Export Word/Excel (Tâche 1.2 de la Roadmap) ou Amélioration du Parsing (Support des tâches `- [ ]` hors tableau).