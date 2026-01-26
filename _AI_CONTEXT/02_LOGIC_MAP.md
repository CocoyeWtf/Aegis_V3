# 02_LOGIC_MAP - AEGIS V10.4

Ce document détaille les mécanismes critiques pour la compréhension du système par une IA.

## 🔄 1. Le Cycle de Scan (`handleScan` dans `App.tsx`)

Le cœur d'AEGIS est la fonction `handleScan`. Elle assure la synchronisation entre le disque et la BDD.

1.  **Appel Rust** : `invoke("scan_vault_recursive")` récupère tous les fichiers.
2.  **Nettoyage BDD** : `DELETE FROM actions` (Full reset des actions pour éviter les doublons/orphelins).
3.  **Itération Synchrone** : Boucle `for (const node of nodes)` :
    *   Lit le contenu.
    *   Extrait les métadonnées (ID, STATUS...).
    *   Vérifie/Génère l'UUID (si absent, il est écrit dans le fichier via `save_note` + ajout du bloc Metadata).
    *   **INSERT/UPDATE Note** : Met à jour la table `notes`.
    *   **Parsing Actions** : Analyse le texte pour trouver `## PLAN D'ACTION`.
    *   **INSERT Actions** : Insère chaque ligne d'action trouvée dans la table `actions`.
4.  **Chargement Master Plan** : Une fois la boucle terminée (garanti par `await`), charge les actions globales.

## 📝 2. Logique des Métadonnées

Pour rendre les fichiers `.md` portables tout en ayant des fonctionnalités de pro (statut, tags, UUID stable), AEGIS utilise un bloc "Footer" standardisé.

*   **Marqueur** : `--- AEGIS METADATA ---`
*   **Format** : Clé: Valeur
*   **Exemple** :
    ```markdown
    # Mon Contenu
    Bla bla

    --- AEGIS METADATA ---
    ID: 123e4567-e89b-12d3-a456-426614174000
    TYPE: NOTE
    STATUS: ACTIVE
    TAGS: dev;doc
    ```
*   **Gestion** : `parseFullFile` (lecture) sépare le body du footer. `constructFullFile` (écriture) réassemble le tout avant sauvegarde.

## ✅ 3. Parsing des Actions (`Plan d'Action`)

AEGIS traite les listes de tâches Markdown comme des objets structurés.

*   **Indicateur** : Header `## PLAN D'ACTION`.
*   **Format Table** : Les lignes suivantes doivent être des lignes de tableau Markdown (`| Col1 | Col2 | ...`).
*   **Détection** :
    *   La ligne doit commencer par `|`.
    *   Colonne 1 (`c[1]`) = **Code WBS** (ex: `1`, `1.1`). C'est la clé unique locale.
    *   Colonne 2 (`c[2]`) = **État** (`[ ]` ou `[x]`).
*   **Agrégation** : Le Master Plan aggrège ces lignes en utilisant l'UUID de la note (via `note_path` FK) pour savoir à qui appartient l'action.

## 🔑 4. Gestion des UUIDs

*   **Origine** : Générés par le Frontend (`crypto.randomUUID()`) lors de la création (`create_note`) ou du premier scan d'un fichier externe.
*   **Stockage** :
    1.  **Fichier** : Dans le bloc Metadata (`ID: ...`).
    2.  **BDD** : PRIMARY KEY de la table `notes`.
*   **Usage** : Permet de renommage robuste et de lier les actions à leur note parente même si le fichier bouge (bien que pour l'instant la FK soit `path`, l'ID assure l'identité logique).
