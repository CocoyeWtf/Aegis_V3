# Spec — Déclaration de contenants & impression d'étiquettes (app mobile PDV)

> Source : retours exploitation (juin 2026). À implémenter dans le **lot Impression**
> (après le build 13 session/UX). Ne PAS confondre avec le build 13.

## 1. Consignes bières (type « Consignes » / CONSIGNMENT)
Ne proposer QUE les codes longs **PL** (au lieu de la source actuelle, préfixe `SF`).
Codes concernés (PL 00801 → PL 00820) :

```
PL00801 PL00802 PL00803 PL00804 PL00805 PL00806 PL00807 PL00808 PL00809 PL00810
PL00811 PL00812 PL00813 PL00814 PL00815 PL00816 PL00817 PL00818 PL00819 PL00820
```
*(format exact en base à vérifier : « PL00801 » vs « PL 00801 »)*

## 2. Règle d'étiquettes (par PRÉFIXE de code — généralisé)
Règle générale :
- **unités = quantité encodée ÷ `unit_quantity`** (`unit_quantity` = conversion en base)
- **nb étiquettes = unités × labels_per_unit**

`labels_per_unit` selon le préfixe / cas :
| Préfixe / code | labels_per_unit |
|----------------|-----------------|
| **RE** (toutes balles plastique + carton) | **2** (2 étiquettes par balle) |
| **CO 10012** (EVAC) et **CO 10014** (EBR) | **0** (pas d'étiquette — voir §3) |
| **CO** (autres combis) | 1 |
| **PA** (toutes palettes) | 1 |

Bug actuel : l'app sort 1 étiquette par **quantité** au lieu d'1 par **unité**.

### Tableau unit_quantity (1 unité = N quantité) — fourni par l'exploitation
| Code | unit_quantity | étiquettes / unité |
|------|---------------|--------------------|
| PA 28010 | 40 | 1 |
| PA 22010 | 10 | 1 |
| PA 24010 | 10 | 1 |
| PA 22000 | 10 | 1 |
| PA 22020 | 10 | 1 |
| PA 23020 | 20 | 1 |
| PA 24020 | 10 | 1 |
| PA 25020 | 20 | 1 |
| PA 28020 | 20 | 1 |
| PA 22004 | 1  | 1 |
| CO 00470 | 5  | 1 |
| CO 10005 | 1  | 1 |
| CO 10010 | 1  | 1 |
| CO 10002 | 5  | 1 |
| CO 00412 | 5  | 1 |
| RE 52010 | 1  | **2** |
| RE 52020 | 1  | **2** |

Le tableau ci-dessus liste les `unit_quantity` connus, mais la **règle s'applique
par préfixe** (tout nouveau code PA/CO/RE est couvert automatiquement) :
- **PA** = toutes les palettes → 1 étiquette/unité
- **CO** = tous les combis **sauf EVAC (CO 10012) et EBR (CO 10014)** → 1 étiquette/unité
- **RE** = toutes les balles (plastique + carton) → **2** étiquettes/unité

Exemples : encode 40 sur PA 28010 → 40/40 = 1 unité → 1 étiquette. Encode 1 sur
RE 52010 → 1 unité → **2** étiquettes.

## 3. Combis Evac / EBR (CO 10012, CO 10014)
**Pas d'étiquette.** Mettre uniquement à jour le nombre de combis disponibles au PDV
pour reprise ; le chauffeur scanne les codes-barres des combis (pas d'étiquette CMRO).

## 4. Format d'étiquette
Reprendre le modèle **Zebra A5** (paysage) de la version web, au lieu de l'étiquette
mal cadrée actuelle.

## Points à clarifier
- Quantité non multiple de `unit_quantity` (ex. encode 50 sur PA 28010 = 40) → arrondi ? refus ? bloquer la saisie aux multiples ?
- Les valeurs `unit_quantity` ci-dessus doivent-elles être **corrigées en base** (support_types) ou y sont-elles déjà ?
