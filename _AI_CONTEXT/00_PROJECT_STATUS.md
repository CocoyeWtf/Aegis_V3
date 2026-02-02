# 00_PROJECT_STATUS - AEGIS V10.21 OUTLOOK PORTAL

Ce document reflète l'état du projet arrêté le 02/02/2026.

## 🎯 État Actuel : Messagerie "Mode Portail"
Suite à des blocages de sécurité stricts (Admin Approval Required sur API Graph), la stratégie "Native" a été abandonnée au profit de la stratégie "Portail".

* **Lecture / Rédaction** : Se fait via le navigateur par défaut (Edge/Chrome) lancé depuis Aegis. Cela garantit le fonctionnement du SSO/MFA et l'accès à toutes les fonctionnalités Outlook.
* **Ingestion (Capture)** : Se fait via le bouton "Coller & Créer Note" qui analyse le presse-papier pour créer une note Markdown formatée.

## ✅ Fonctionnalités "DONE" et Stables

1.  **Architecture** : Rust (Backend) + React (Frontend).
2.  **Moteur de Recherche** : Full-Text, sidebar.
3.  **Scan & Indexation** : Récursif.
4.  **Export Excel** : Natif.
5.  **Messagerie (V10.21)** :
    * Bouton "OPEN OUTLOOK" : Lance le navigateur système (Fiable 100%).
    * Bouton "COLLER & CRÉER" : Transforme un mail copié en Note Aegis structurée.

## ❌ Tentatives Échouées (Documentation Technique)
* **IMAP/SMTP** : Ports bloqués par le pare-feu entreprise.
* **Graph API (Device Code)** : Bloqué par politique Azure "Admin Consent Required" (Erreur AADSTS65002), même en utilisant des Client ID publics (PowerShell/Office).

## ⚠️ Point de Reprise
* **Branche** : `feature/email-ingestion`
* **Prochaine étape possible** :
    * Améliorer le "Parsing" du collage (détecter mieux l'expéditeur/date).
    * Ou passer à la tâche suivante (Export Word ou Finalisation UI).