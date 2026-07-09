# Désignation d'un DPO — analyse et trame (STIME C1)

**Réf. :** Q6/160/164 · **Statut : PROJET — décision et signature Dominic** · 2026-07-09

## 1. Y a-t-il obligation légale (Art. 37 RGPD) ?

| Critère Art. 37(1) | Situation CHAOS Platform | Obligation ? |
|---|---|---|
| a) Autorité/organisme public | Non (société privée) | Non |
| b) Suivi régulier et systématique **à grande échelle** | Géolocalisation des chauffeurs pendant les tournées (~30 appareils, ~200 utilisateurs). Suivi régulier et systématique, mais l'échelle (centaines de personnes, périmètre employés/partenaires) reste en deçà des seuils « grande échelle » des lignes directrices WP243 | **Non, à la limite** |
| c) Catégories particulières (Art. 9/10) à grande échelle | Aucune donnée sensible traitée | Non |

**Conclusion proposée :** pas d'obligation stricte de désigner un DPO. **MAIS** :
le client final (groupement Les Mousquetaires / STIME) attend un interlocuteur
protection des données identifié, et la géolocalisation est un traitement à
risque. → **Désigner un référent RGPD** (option A) ou un **DPO externe
mutualisé** (option B) et le documenter.

## 2. Options

- **Option A — Référent RGPD interne (recommandée à ce stade)** : Dominic
  Verleyen, responsable plateforme. Coût nul, connaissance du système ; limite :
  cumul avec la fonction de responsable technique (conflit d'intérêts potentiel
  si l'entreprise grossit — à réévaluer au 1er client groupe).
- **Option B — DPO externe mutualisé** : cabinet spécialisé (~150-400 €/mois).
  Indépendance et crédibilité audit maximales ; à envisager si STIME l'exige
  contractuellement.

## 3. Trame de désignation (à compléter et archiver)

> **Décision de désignation — Référent protection des données**
> La société ______________ (Chaos Platform) désigne :
> **Nom :** ______________ · **Fonction :** ______________
> **Contact publié :** privacy@chaosmanager.tech *(alias à créer)*
> en qualité de **[référent RGPD | délégué à la protection des données]**,
> chargé de : tenue du registre Art. 30, réponses aux demandes de droits
> (accès, effacement, portabilité — outillées dans la plateforme), pilotage
> des analyses d'impact (DPIA géolocalisation), gestion des violations
> (cf. PROCEDURE_NOTIFICATION_BREACH.md), sensibilisation.
> Si DPO formel : notification à l'APD belge / CNIL via leur téléservice.
> **Date / signature :** ______________

## 4. Une fois signé

1. Reporter le contact dans `REGISTRE_TRAITEMENTS_CNIL.md` (champ « dpo_contact »,
   aujourd'hui « À définir ») et dans l'endpoint `/api/gdpr/data-inventory/`.
2. Créer l'alias mail `privacy@chaosmanager.tech`.
3. Reporter la réponse aux Q6/160/164 du questionnaire STIME.
