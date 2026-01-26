# 00_PROJECT_STATUS - AEGIS V10.4 STABLE

Ce document reflète l'état immédiat du projet en version **V10.4 STABLE**.

## ✅ Fonctionnalités "DONE" et Stables

Les fonctionnalités suivantes sont testées, validées et considérées comme stables :

1.  **Architecture Hybride (Rust/React)** : Le backend Rust gère le FileSystem et le SQLite, le frontend React gère l'UI et l'état.
2.  **Cockpit UI** : Interface sombre, système d'onglets (Cockpit / Master Plan), Sidebar latérale avec Drag & Drop.
3.  **Gestion des Notes (CRUD)** :
    *   Création contextuelle (dans le dossier sélectionné ou parent du fichier actif).
    *   Renommage et Suppression (avec mise à jour des liens bidirectionnels).
    *   Éditeur "Pure Text" (pas d'injection HTML dans le Markdown).
4.  **Système de Flashnote** :
    *   Bouton "FLASH NOTE" fonctionnel.
    *   Routing automatique vers le dossier `01_Inbox` (création auto si manquant).
    *   Nommage horodaté pour éviter les collisions.
5.  **Scan Récursif (`handleScan`)** :
    *   Parcourt tout le Vault (hors `.git`).
    *   Indexe les fichiers Markdown et leur contenu dans SQLite (`notes` table).
    *   Détecte et indexe les actions (`## PLAN D'ACTION`) dans SQLite (`actions` table).
6.  **Master Plan (Global)** :
    *   Vue agrégée de toutes les actions du Vault.
    *   Interaction bidirectionnelle : cocher une case ici met à jour le fichier Markdown source.

## 🛠 Correctifs Récentes (Validés)

### 1. Synchronisation Master Plan (`handleScan`)
**État : CORRIGÉ**
*   L'ancien problème de concurrence (`forEach` asynchrone) a été résolu.
*   **Solution Implémentée** : Utilisation d'une boucle `for (const node of nodes)` explicite dans `handleScan` (dans `App.tsx`) qui attend (`await`) l'exécution des requêtes SQL (`INSERT`/`UPDATE`) pour chaque note avant de passer à la suivante.
*   Cela garantit que l'étape de lecture du Master Plan (`SELECT * FROM actions`) ne se déclenche qu'une fois la base de données totalement peuplée.

### 2. Création de Note Contextuelle
**État : CORRIGÉ**
*   **Logique Actuelle** :
    1.  Si un dossier est sélectionné (`selectedFolder`) -> La note est créée dedans.
    2.  Si aucun dossier n'est sélectionné mais qu'un fichier est actif (`activeFile`) -> Le dossier parent est détecté et utilisé.
    3.  Sinon -> Création à la racine (ou comportement par défaut).
*   Plus de fallback forcé vers "Inbox" si l'utilisateur est dans un projet spécifique (sauf pour la Flashnote qui force l'Inbox).

### 3. Flashnote Routing
**État : CORRIGÉ**
*   La fonction `handleFlashNote` cible explicitement `01_Inbox` et vérifie son existence avant écriture.

## ⚠️ Points d'Attention
*   **Lucide React** : Bien que mentionné dans les specs idéales, la bibliothèque n'est PAS installée dans la V10.4. L'interface utilise actuellement des émojis standard (standardisation prévue ultérieurement).
*   **Séparateur Métadonnées** : Le système repose strictement sur le séparateur `--- AEGIS METADATA ---`. Tout contenu technique doit se trouver APRES ce marqueur pour ne pas polluer l'éditeur.
