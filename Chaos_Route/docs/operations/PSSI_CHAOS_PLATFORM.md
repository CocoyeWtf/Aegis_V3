# Politique de Sécurité des Systèmes d'Information (PSSI) — CHAOS Platform

**Réf. STIME :** C3 (Q7/11/29/169) · **Version : 1.0 PROJET — à approuver par Dominic Verleyen**
**Champ :** plateforme CHAOS Route (web, API, mobile, VPS de production) et ses opérateurs.
Chaque règle ci-dessous renvoie à son implémentation effective — ce document décrit ce qui EST en place, pas des intentions.

## 1. Gouvernance

- **Responsable sécurité :** Dominic Verleyen (responsable plateforme).
- **Référent protection des données :** cf. `DPO_ANALYSE_DESIGNATION.md`.
- Revue de la PSSI : annuelle, et à chaque évolution majeure (nouveau tenant, nouveau sous-traitant).
- Documents liés : registre Art. 30, DPIA géolocalisation, `RUNBOOK_INCIDENT.md`, `PROCEDURE_NOTIFICATION_BREACH.md`, `PLAN_REPRISE_ACTIVITE.md`, plan de remédiation STIME.

## 2. Classification des données

| Niveau | Exemples | Règles |
|---|---|---|
| **C3 — Données personnelles** | Comptes, positions GPS, photos opérationnelles, n° de téléphone/SMS, plaques | Accès par permission RBAC, cloisonnement tenant, rétention définie + purge auto (`/api/retention`), chiffrement en transit (TLS) et sauvegardes chiffrées (age), droits RGPD outillés |
| **C2 — Confidentiel métier** | Volumes, contrats transporteurs, coûts, pré-facturation | Accès RBAC, cloisonnement tenant, pas de diffusion hors plateforme |
| **C1 — Interne** | Paramétrage, référentiels (PDV, bases), documentation | Accès authentifié |
| **C0 — Public** | Page d'installation mobile, notice GPS | Libre |

Secrets techniques (clés, mots de passe d'infrastructure) : **jamais en clair au repos**
(SOPS+age sur le VPS, coffre de mots de passe pour les clés privées), jamais dans Git, jamais dans les journaux (champs exclus de l'audit).

## 3. Contrôle d'accès

- Comptes **nominatifs** ; permissions par rôle (RBAC ressource:action), cloisonnement multi-société (tenant) appliqué en couche données (impossible à omettre par endpoint).
- **Mots de passe** : ≥ 12 caractères (≥ 14 comptes privilégiés), 3 classes, liste noire, appliqués par le serveur sur tous les flux ; stockage bcrypt.
- **MFA TOTP** pour les comptes privilégiés (obligatoire dès l'enrôlement des superadmins terminé — `REQUIRE_MFA_SUPERADMIN`).
- Sessions : jetons courts (30 min) + refresh rotatif à usage unique ; cookies HttpOnly côté web (aucun jeton exposé au JS) ; **révocation serveur au logout**.
- Comptes : création/suspension par les administrateurs ; **revue des comptes et des rôles : semestrielle** (action récurrente) ; départ = désactivation immédiate.
- Appareils mobiles : enregistrement individuel (UUID), désactivables à distance, fonctionnalités limitées par profil, mode kiosque sur tablettes magasin.

## 4. Protection des données et des échanges

- **En transit** : TLS partout (HSTS) ; l'accès HTTP direct par IP est une redirection 308.
- **Au repos** : sauvegardes chiffrées age (clé privée hors serveur) ; secrets SOPS ; chiffrement du volume base (LUKS) planifié — cf. `ops/secrets/README.md`.
- **Rétention & purge** : durées centralisées et purge quotidienne automatique (audit 12 mois — plancher 6 mois, GPS 60 j, SMS/photos 12 mois), journalisées.
- **Consentement géolocalisation** : notice versionnée + choix chauffeur, opt-out effectif côté serveur.

## 5. Journalisation et supervision

- Journal d'audit applicatif : **toute mutation** (acteur, diff, horodatage, tenant), connexions/échecs/déconnexions, consultable par les admins ; rétention 12 mois.
- Logs techniques : centralisés (Loki), 180 jours, accès Grafana authentifié.
- Alerte < 5 min si indisponibilité (watchdog → push) + sonde externe.

## 6. Développement et exploitation sécurisés

- CI bloquante : tests (isolation multi-tenant adverse incluse), SAST (bandit, semgrep), audit des dépendances (pip-audit, npm audit), veille Dependabot hebdomadaire.
- Déploiement : depuis Git uniquement (aucune modification manuelle sur le serveur), configuration versionnée.
- Sauvegarde quotidienne testée (exercice de restauration consigné) ; PRA documenté avec RTO/RPO.
- Postes d'administration : accès VPS par clé SSH uniquement, coffre de mots de passe personnel obligatoire.

## 7. Incidents

Détection (alerting, audit) → qualification et traitement : `RUNBOOK_INCIDENT.md` ;
violation de données personnelles : `PROCEDURE_NOTIFICATION_BREACH.md` (72 h).
Tout incident de sécurité est consigné (date, impact, actions, leçons).

## 8. Tiers et sous-traitants

Registre des sous-traitants + DPA : `REGISTRE_SOUS_TRAITANTS_DPA.md`. Tout
nouveau fournisseur passe par : analyse (données concernées, localisation UE),
DPA, inscription au registre.

---
**Approbation** — Nom/date/signature : ______________
