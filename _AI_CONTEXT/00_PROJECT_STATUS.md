# 00_PROJECT_STATUS - AEGIS V11.60 (PERPETUAL CALENDAR)

Dernière mise à jour : 06/02/2026
Branche active : `main`

## 🎯 État Actuel : SYSTÈME DE TEMPS CORRIGÉ
Le module Calendrier est désormais fiable et perpétuel. Les bugs de rendu (jours manquants) et de calcul (décalage UTC sur les fériés) sont résolus.

## ✅ Session du 06/02/2026 - Calendar & Timezone Fix
1.  **Calendrier Perpétuel (V11.60)** :
    * **Timezone Fix** : Utilisation de dates locales strictes (`toLocalISOString`) pour éviter le décalage UTC qui faussait les fériés (ex: 1er mai devenant 30 avril).
    * **Fêtes Mobiles** : Algorithme de Gauss pour Pâques + calcul dynamique pour Ascension (+39j) et Pentecôte (+50j).
    * **UI** : Remplacement des flèches par des triangles Gold (`◀` `▶`) pour l'uniformité.
2.  **Rappel Fix Précédents** :
    * Grille de 8 colonnes (Semaine + 7 jours) pour éviter le décalage visuel.
    * Textareas auto-extensibles dans le Cockpit.

## 🛠 Technique
* **Frontend** : Gestion manuelle des objets `Date` pour contourner les comportements par défaut de JS.

## ⚠️ Point de Reprise
* Core System : **STABLE**.
* Prochaine étape : Dashboard ou IA.