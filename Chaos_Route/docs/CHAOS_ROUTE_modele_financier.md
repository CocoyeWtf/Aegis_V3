# CHAOS Route — Modèle financier, infra & scalabilité

> Compagnon de l'offre commerciale. Chiffres **indicatifs HTVA (EUR)**, à calibrer.
> Hypothèses explicites — change-les selon ton périmètre réel. v0.1 (juin 2026)

---

## 1. Dimensionnement serveur actuel (relevé prod)

| Ressource | Valeur | Constat |
|-----------|--------|---------|
| CPU | 4 vCPU (AMD EPYC 9354P) | charge **0.15** → quasi inactif |
| RAM | 15 Gi (2,1 utilisés) | **13 Gi libres** |
| Disque | 193 Go (41 % utilisés) | **114 Go libres** |
| Taille BD | **249 Mo** | minuscule |
| Conteneurs | app 174 Mo, db 132 Mo, caddy 309 Mo | **< 1 Go** total |

➡️ **Le serveur est très largement surdimensionné** pour la charge actuelle. Pour la
**Belgique (pilote + montée en charge raisonnable), AUCUN changement d'offre n'est nécessaire**.
Un **serveur miroir identique** + sauvegarde = surcoût **marginal** (voir §3).

---

## 2. Compte de résultat — scénario BELGIQUE (année pleine)

### Hypothèses (scénario de base, à ajuster)
- **4 bases logistiques**, **20 utilisateurs bureau**, **40 appareils mobiles** (chauffeurs + tablettes).
- Modèle de licence : **par base** (tout-inclus users bureau) **+ par appareil mobile**.
  - 700 €/base/mois × 4 = 2 800 €/mois
  - 12 €/mobile/mois × 40 = 480 €/mois
  - **Licence = 3 280 €/mois ≈ 39 360 €/an**
- **Infra** facturée en **pass-through + gestion** (Bloc B) ; **dev** = enveloppe 1,5 j/mois.

### Produits (revenus)
| Poste | Mensuel | Annuel |
|-------|--------:|-------:|
| A — Licence logicielle | 3 280 € | **39 360 €** |
| B — Infogérance (refacturation infra + gestion) | 800 € | **9 600 €** |
| C — Développements (1,5 j/mois @ 600 €) | 900 € | **10 800 €** |
| **Total récurrent** | **4 980 €** | **59 760 €** |
| D — Mise en service (one-shot, **année 1 seulement**) | — | **10 000 €** |

### Charges (coûts)
| Poste | Annuel |
|-------|-------:|
| Infra réelle (serveur principal + **miroir** + backup, UE) | ~1 800 € |
| Outils (EAS build, monitoring, domaine, e-mails, SMS…) | ~1 200 € |
| Assurances (RC pro + cyber) | ~1 500 € |
| Comptable / juridique (CGV, DPA, compta) — *année courante* | ~1 800 € |
| Frais société (BCE, banque, divers) | ~800 € |
| **Total charges** | **~7 100 €** |
*(Année 1 : + ~2 000–3 000 € de frais de création société/juridique.)*

### Résultat (avant ta rémunération / impôts / cotisations)
- **Marge brute récurrente ≈ 59 760 − 7 100 = ~52 700 €/an.**
- **Année 1 : + 10 000 €** (setup) ≈ **~60 000 €**.
- Cette marge = **ton enveloppe de rémunération + bénéfice** (tu es l'éditeur/dev/support).
- ⚠️ Net en poche = après **impôt société/IPP + cotisations sociales** (Belgique) → prévoir **~30–45 %** de prélèvements selon montage (SRL vs indépendant) — à valider avec un comptable.

> **Leviers** : le résultat **scale ~linéairement** avec le nb de bases/appareils. Ex. 8 bases
> ≈ doublement de la licence. Le **dev (Bloc C)** est le poste le plus élastique (à la commande).

---

## 3. Coût infra & haute disponibilité (Belgique)

| Élément | Détail | Coût indicatif |
|---------|--------|---------------:|
| Serveur principal | VPS EU 4 vCPU/15 Go (actuel) | ~25–40 €/mois |
| **Serveur miroir** (failover) | VPS EU identique, réplication PostgreSQL | ~25–40 €/mois |
| **Sauvegarde** chiffrée hors-site UE | BD < 1 Go → quelques Go → ~0,02 €/Go | ~5–15 €/mois |
| Monitoring/alerting | UptimeRobot/Better Stack… | ~0–20 €/mois |
| **Total infra HA** | | **~60–115 €/mois** |

➡️ Donc le **double serveur + backup pour la Belgique coûte ~1 à 1,4 k€/an** : **négligeable**
face aux revenus. Tu peux **inclure la HA** sans douleur, ou la facturer en option (marge nette).

---

## 4. Scénario FRANCE — scalabilité (à anticiper MAINTENANT)

### Le changement d'échelle
**5 sociétés de transport, ~40 bases, plusieurs milliers d'utilisateurs.** Ce n'est plus le
même produit d'un point de vue technique **ni** commercial.

### 4.1 Revenus potentiels (ordre de grandeur)
- 40 bases × ~700 €/mois = **~28 000 €/mois** de licence base **+** plusieurs milliers
  d'appareils × ~10 €/mois = **+ 20–40 k€/mois** → **licence ≈ 50–70 k€/mois (~600–850 k€/an)**.
- ⚠️ À cette taille, un **groupe négocie des remises de volume** et exige des **conditions
  enterprise** (SLA, SSO, 2FA, réversibilité, hébergement dédié…). Tabler plutôt sur
  **un forfait groupe négocié** que sur le prix catalogue plein.

### 4.2 Ce que l'architecture actuelle NE supporte PAS en l'état
L'archi actuelle = **1 serveur, 1 base PostgreSQL, 1 instance applicative**. Pour des **milliers
d'utilisateurs simultanés** et **5 sociétés**, il faut **re-plateformer** :

1. **Multi-tenant** (isolation des 5 sociétés) : base par société **ou** schéma par tenant
   **ou** `tenant_id` partout. Aujourd'hui : périmètre région/base, mais **mono-tenant** → à faire.
2. **Scalabilité horizontale** : plusieurs instances app **stateless** derrière un **load balancer**.
3. **Base de données** : **PostgreSQL managé HA** (primaire + réplicas) + **pooling** (PgBouncer).
4. **Cache** (Redis), **stockage objet** (photos/étiquettes), **CDN** pour le front.
5. **Workers dédiés** pour l'**optimiseur OR-Tools** (CPU-intensif) — séparés de l'app web.
6. **Observabilité** (logs centralisés, métriques, alerting), **CI/CD**, **WAF**.
7. **Tablettes** : auto-update parc industrialisé + MDM (gestion de flotte d'appareils).

### 4.3 Coût infra France (ordre de grandeur)
- Cluster managé (DB HA + app autoscalée + cache + stockage + observabilité) : **~1 500–4 000 €/mois**
  selon charge réelle → reste **< 5–8 %** des revenus licence → **sain**.

### 4.4 Décision stratégique (à acter dès maintenant)
- ✅ **Belgique = pilote sur l'archi actuelle** (suffisante, voire surdimensionnée).
- ⚠️ **MAIS architecturer la multi-tenance dès aujourd'hui** (clé d'isolation `tenant_id`)
  pour **ne pas tout réécrire** quand la France arrive. C'est un **choix de conception à figer tôt** :
  rajouter le multi-tenant après coup sur une grosse base installée est coûteux et risqué.
- Le **modèle de prix par base reste cohérent et scalable** (revenu ~linéaire), mais **prévoir
  une grille « groupe / enterprise »** (remises de volume + SLA renforcé) pour les gros comptes.
- Au-delà d'un certain seuil (France), **ce n'est plus un one-man-show** : prévoir
  **support N1/N2, astreinte, et au moins un renfort dev/infra**.

---

## 5. Synthèse décisionnelle
| Sujet | Belgique (maintenant) | France (à anticiper) |
|-------|------------------------|----------------------|
| Serveur | Actuel **suffit largement** | Cluster managé HA + autoscaling |
| Multi-tenant | Pas urgent **mais** poser la clé `tenant_id` dès que possible | **Indispensable** |
| Modèle prix | Par base + mobile (catalogue) | Forfait groupe négocié (remise volume) |
| Marge | ~50 k€/an (base 4 bases) | 6 chiffres, **mais** avec équipe + infra |
| Risque clé | PI vs employeur (juridique) | **Re-plateformage si non anticipé** |
