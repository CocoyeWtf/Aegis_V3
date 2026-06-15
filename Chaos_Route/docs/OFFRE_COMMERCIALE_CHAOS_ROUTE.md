# CHAOS Route — Offre de service & proposition commerciale

> Plateforme de gestion et d'optimisation du transport (TMS) — édition Belgique.
> Document de travail à personnaliser (chiffres indicatifs à calibrer). v0.1

---

## 1. Synthèse (executive summary)

**CHAOS Route** est une plateforme web + mobile de **planification, optimisation et
suivi des tournées de transport et de logistique**, avec un module dédié aux
**points de vente (reprise de contenants/consignes)** et l'**intégration au WMS**.

Proposition de valeur :
- **Réduire les coûts de transport** (optimisation des tournées, taux de remplissage, km).
- **Fiabiliser l'exécution** (suivi temps réel, preuves de livraison, traçabilité contenants).
- **Gagner du temps administratif** (pré-facturation, export WMS, eCMR).
- **Maîtriser la donnée** : hébergement UE, conformité RGPD, sécurité et sauvegardes.

Modèle proposé : **SaaS** (logiciel en service) avec hébergement haute disponibilité,
support, maintenance et développements évolutifs au forfait.

---

## 2. Périmètre fonctionnel

### 2.1 Planification & optimisation
- **Construction des tournées** : livraison, reprise vide, mouvements (déplacement base,
  garage, **transfert PDV à PDV**), multi-températures (sec / frais / gel / bi-/tri-temp).
- **Ordonnancement** : affectation contrats transporteurs (presté / propre / mixte),
  parc propre (véhicules, tracteurs, remorques), chauffeurs base, priorités, créneaux.
- **Aide à la décision (optimiseur OR-Tools)** : 2 niveaux (heuristique rapide /
  optimisation) avec critères paramétrables (coût, ponctualité, taux de remplissage,
  nb de tournées). Simulation sans impact sur les données.
- **Distancier, matrice de temps, taxe km, prix carburant** → **calcul de coût** automatique.

### 2.2 Exploitation & suivi
- **Application mobile chauffeur** : suivi GPS de tournée, scan PDV (QR/code-barres),
  preuves de livraison (photos, signatures), déclarations, inspections véhicule, eCMR.
- **Application tablette magasin (PDV, sans login)** : déclaration de contenants,
  impression d'étiquettes Bluetooth, reprise de consignes/combis.
- **Suivi des contenants & consignes** : mouvements, soldes par PDV, stock par base.
- **Réception base, booking approvisionneur, gestion des anomalies**.

### 2.3 Administration & pilotage
- **Référentiels** : pays / régions / bases / PDV / fournisseurs / transporteurs / contrats / véhicules / chauffeurs.
- **Pré-facturation & synthèse transporteur** ; **export WMS (Infolog)**.
- **KPI & tableaux de bord** ; **alertes opérationnelles**, notifications SMS.
- **Multi-pays / multi-régions / multi-bases**, **multilingue** (FR / EN / PT / NL).
- **Gestion fine des rôles et permissions (RBAC)**, **journal d'audit** complet.

---

## 3. Avantages / bénéfices

| Bénéfice | Mécanisme |
|----------|-----------|
| Baisse du coût/tournée | Optimisation OR-Tools, mutualisation, taux de remplissage |
| Moins d'erreurs & litiges | Preuves de livraison, traçabilité contenants, eCMR |
| Productivité bureau | Pré-facturation, export WMS, ré-ordonnancement en 1 clic |
| Pilotage | KPI temps réel, coûts par tournée/contrat/base |
| Conformité & sérénité | Hébergement UE, RGPD, audit, sauvegardes testées |
| Évolutivité | Plateforme modulaire, développements au forfait |

---

## 4. Architecture & hébergement

- **Back-end** : API (FastAPI) + base de données **PostgreSQL**.
- **Front-end** : application web (React) ; **mobile** Android (chauffeurs & tablettes PDV).
- **Conteneurisation Docker** + reverse-proxy/TLS (HTTPS de bout en bout).
- **Hébergement dans l'Union européenne** (souveraineté de la donnée — voir §6).

### 4.1 Haute disponibilité — double serveur (à développer)
- **Serveur principal + serveur miroir** : réplication de la base de données
  (streaming replication PostgreSQL) et bascule (**failover**) en cas de panne.
- Objectif : **continuité de service** ; bascule manuelle assistée (court terme) puis
  automatique (cible). Surveillance (monitoring) et alertes en cas d'incident.
- *À cadrer : RTO/RPO cible, bascule auto vs assistée, répartiteur de charge.*

---

## 5. Sécurité des données

- **Chiffrement en transit** (TLS/HTTPS) ; secrets et mots de passe **hachés**.
- **Authentification** (JWT) + **rôles/permissions (RBAC)** granulaires par module.
- **Journal d'audit** (qui fait quoi, quand) et traçabilité des modifications.
- **Cloisonnement par périmètre** (région/base) selon le profil utilisateur.
- **Mobile** : auth par appareil pour les tablettes, mode kiosque, sessions sécurisées.
- **Durcissement (roadmap)** : pare-feu applicatif (**WAF**), limitation de débit
  (rate-limiting — déjà en place sur l'API), revue de dépendances, tests d'intrusion.
- **Sauvegardes chiffrées** (voir §7).

> Note : les mesures ci-dessus décrivent une architecture *alignée sur l'état de l'art*.
> Une certification (ex. ISO 27001) n'est pas requise mais peut être visée ultérieurement.

---

## 6. RGPD / conformité

- **Hébergement et traitement dans l'UE** (pas de transfert hors UE sans encadrement).
- **Rôles RGPD** : le **client est responsable de traitement**, l'éditeur **sous-traitant**
  → **contrat de sous-traitance (DPA)** annexé au contrat (art. 28 RGPD).
- **Registre des traitements**, **minimisation** des données, **durées de conservation**
  paramétrables, **droits des personnes** (accès, rectification, effacement).
- **Données personnelles concernées** : essentiellement **données salariés/chauffeurs**
  (identité, géolocalisation pendant la tournée) et contacts professionnels — base légale
  **intérêt légitime / exécution du contrat de travail**, information des personnes.
- **Géolocalisation** : limitée à la tournée en cours, finalité explicite, information préalable.
- **Sécurité & violations** : procédure de notification (72 h) ; module RGPD intégré.
- Possibilité de **DPIA (analyse d'impact)** pour la géolocalisation des chauffeurs.

---

## 7. Sauvegarde & reprise d'activité (backup / recovery — à développer)

- **Sauvegardes automatiques** de la base : quotidiennes (rétention 30 j) +
  hebdomadaires (rétention 3 mois) — chiffrées, stockées **hors du serveur principal** (UE).
- **PITR (Point-In-Time Recovery)** PostgreSQL pour restaurer à un instant précis.
- **Tests de restauration périodiques** (trimestriels) — *« une sauvegarde non testée
  n'est pas une sauvegarde »*.
- **Objectifs cibles à valider** : **RPO** (perte de données max) ≈ 15 min à 24 h selon
  formule ; **RTO** (temps de remise en service) ≈ < 1 h à 4 h.
- **Plan de reprise (PRA)** documenté, couplé au serveur miroir (§4.1).

---

## 8. Support & maintenance

### 8.1 Système de tickets (à intégrer dans l'app)
- **Création de tickets depuis l'application** (incident / demande / évolution),
  avec catégorie, priorité, captures, et **suivi de statut** côté utilisateur.
- Centralisation, historique, et reporting (délais de traitement).

### 8.2 Maintenance
- **Corrective** : correction des anomalies (incluse).
- **Évolutive mineure** : ajustements, paramétrages (incluse selon formule).
- **Adaptative** : mises à jour techniques (sécurité, dépendances, OS) — incluse.

### 8.3 Niveaux de service (SLA) — indicatif
| Niveau | Heures | Prise en compte | Résolution incident bloquant |
|--------|--------|-----------------|------------------------------|
| Standard | 8h–18h, j. ouvrés | < 1 j ouvré | meilleur effort, < 3 j |
| Premium | 7h–20h, j. ouvrés | < 4 h | < 1 j ouvré, astreinte option |

---

## 9. Modèle tarifaire (indicatif — à calibrer)

> Tous les montants sont **indicatifs HTVA** et à ajuster selon l'échelle réelle
> (nombre de bases, d'utilisateurs, de tablettes, volume de tournées) et la
> politique commerciale interne. Devise : EUR.

### 9.0 Structure de l'offre — 3 blocs séparés (recommandé)
Pour de la **transparence** et limiter ton **risque financier**, on dissocie nettement
ce qui relève de **ton actif logiciel** de ce qui relève de l'**infrastructure** :

| Bloc | Nature | Récurrence | Qui porte le coût/risque |
|------|--------|-----------|--------------------------|
| **A — Licence logicielle** | Droit d'usage de la plateforme (ton IP) | Abonnement | Toi (marge élevée) |
| **B — Infrastructure & infogérance** | Serveurs (principal + miroir), hébergement, sauvegarde, supervision | Abonnement, **séparé** | Voir 3 modèles ci-dessous |
| **C — Développement / évolutions** | Nouvelles features, à l'acte | Au devis / TJM | Le client commande au besoin |
| (D — Mise en service) | Paramétrage, reprise données, formation | One-shot | — |

**3 modèles possibles pour le Bloc B (infra) :**
- **(b1) Refacturation « pass-through »** *(recommandé au lancement)* : le client paie
  le **coût réel** de l'infra (facture hébergeur) **+ frais de gestion/infogérance**
  (ex. +15–25 %). Très transparent, **quasi aucun risque financier** pour toi.
- **(b2) Forfait infogérance clé en main** : tu fournis l'infra à **prix fixe**
  (tu prends la marge **et** le risque de dépassement). Plus simple pour le client.
- **(b3) Infra fournie par le client** : le client achète/héberge les serveurs ;
  tu ne factures que la **supervision/infogérance** (forfait mensuel).

> Intérêt de la séparation : la **licence** (Bloc A) reste ton revenu récurrent à forte
> marge et **indépendant** des coûts serveurs ; l'**infra** (Bloc B) est neutre/transparente ;
> le **dev** (Bloc C) se budgète à part sans diluer la licence. Cela facilite aussi la
> comptabilité (licence vs prestation vs refacturation) et les futures négociations.

### 9.1 Frais de mise en service (one-shot)
- Paramétrage, reprise des référentiels, intégration WMS, formation : **5 000 – 15 000 €**.

### 9.2 Abonnement plateforme (récurrent)
Au choix (ou combiné) :
- **Par base logistique** : ~**400 – 900 € / base / mois**, **ou**
- **Par utilisateur actif** (bureau) : ~**25 – 60 € / utilisateur / mois**, **et/ou**
- **Par tablette/app mobile** : ~**10 – 25 € / appareil / mois**.

### 9.3 Hébergement & infogérance (haute dispo + sauvegardes)
- Socle mono-serveur : ~**150 – 400 € / mois**.
- **Option haute disponibilité (double serveur + miroir + PRA)** : **+ 250 – 600 € / mois**.

### 9.4 Support & maintenance
- **Inclus** dans l'abonnement (niveau Standard) ; **Premium** : **+ 10 – 20 %** de l'abonnement.

### 9.5 Développements de nouvelles fonctionnalités
- **Au forfait** par projet (devis), **ou**
- **Enveloppe d'évolution mensuelle** (ex. *X jours/mois réservés*), **ou**
- **Tarif journalier (TJM)** : ~**450 – 750 € / jour** selon profil.

### 9.6 Exemple de package « clé en main » (illustratif)
> 2 bases, 8 utilisateurs bureau, 10 tablettes, haute dispo + support Premium :
> - Mise en service : ~10 000 € (one-shot)
> - Abonnement : ~2 000 – 3 000 € / mois (plateforme + héberg. HA + Premium)
> - Évolutions : enveloppe 2 j/mois (~1 000 – 1 500 €/mois) **ou** au devis.

---

## 10. Éléments à développer / roadmap technique (chiffrables)

1. **Double serveur + bascule miroir (failover)** + monitoring. *(HA §4.1)*
2. **Sauvegarde automatisée + PITR + tests de restauration**. *(§7)*
3. **Système de tickets intégré à l'app**. *(§8.1)*
4. **Durcissement sécurité** : WAF, alerting, CI/CD (intégration/déploiement continus).
5. (Selon besoins) **SSO**, **2FA**, **API d'intégration** ERP/comptabilité, **rétention RGPD** automatisée.

---

## 11. Mise en place côté éditeur (création de la structure)

- **Société** : créer l'entité (Belgique — inscription **BCE/Banque-Carrefour des
  Entreprises**, forme **SRL** ou indépendant, **numéro TVA**, compte bancaire pro).
- **Nom commercial / marque** : vérifier la disponibilité, éventuel dépôt de marque (BOIP).
- **Domaine & DNS** : réserver le domaine, e-mails pro, certificats TLS.
- **Hébergement UE** : contrat avec un hébergeur **localisé UE** (conformité RGPD).
- **Documents contractuels** : **CGV/CGU**, **contrat de service (SLA)**,
  **DPA (sous-traitance RGPD)**, politique de confidentialité, mentions légales.
- **Assurances** : **RC professionnelle** + **cyber-risque** recommandées.
- **Comptabilité / facturation récurrente** (abonnements), gestion TVA.
- **PI / licence** : clarifier la **propriété intellectuelle** du code (cession/licence)
  vis-à-vis de ton employeur si développé en partie sur temps/poste — **point juridique à sécuriser en priorité**.

---

## 12. Étapes proposées

1. **Cadrage** : périmètre exact, nombre de bases/users/tablettes, cible RTO/RPO.
2. **Devis ferme** (mise en service + abonnement + HA + support).
3. **Pilote** (la base actuelle) → validation terrain.
4. **Déploiement progressif** Belgique (multi-bases) + formation.
5. **Roadmap évolutions** (tickets, HA, backup/PRA, sécurité).

---

*Document indicatif — les montants et niveaux de service sont à arrêter contractuellement.*
