# 00_PROJECT_STATUS - AEGIS V10.19 MAILBOX FOUNDATION

Ce document reflète l'état du projet en cours de développement sur la branche `feature/email-ingestion`.

## 🎯 État Actuel : Transition vers Mode Portail (V10.21)
L'utilisateur a arrêté la session juste avant d'implémenter la logique "WebView Outlook".
* **Dernière action réussie** : Compilation stable avec la stack réseau (`reqwest`, `rustls`) + Interface UI Messagerie + Test de connexion Microsoft OK ("ONLINE").
* **Prochaine action** : Appliquer le code V10.21 (Backend `open_outlook_window` + Frontend Capture).

## ✅ Fonctionnalités "DONE" et Stables

1.  **Architecture Hybride** : Rust (Backend) + React (Frontend).
2.  **Moteur de Recherche (V10.13)** : Full-Text sidebar.
3.  **Scan & Indexation (V10.16)** : Récursif & Robuste.
4.  **Export Excel (V10.18)** : Natif vers dossier Downloads.
5.  **Messagerie (V10.19 - WIP)** :
    * Onglet dédié créé.
    * Stack technique Windows-Safe (`rustls-tls`) opérationnelle.
    * Test de connectivité réussi.

## 🛠 Stack Technique Ajoutée (Branche Mails)
* **Network** : `reqwest` (HTTP Client), `tauri-plugin-dialog`, `walkdir`, `open`.
* **Fix Windows** : Utilisation forcée de `rustls` pour contourner les erreurs OpenSSL.

## ⚠️ Point de Reprise
* **Branche** : `feature/email-ingestion`.
* **Contexte** : Impossible d'utiliser l'API Graph (Pas d'admin Azure). Pivot validé vers une solution "WebView Portail" + "Presse-papier".
* **Instruction** : Reprendre à **"Étape 1 : Nettoyage du Backend (main.rs)"** de la proposition V10.21.