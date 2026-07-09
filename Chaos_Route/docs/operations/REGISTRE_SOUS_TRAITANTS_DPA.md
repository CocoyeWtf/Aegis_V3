# Sous-traitants & DPA Article 28 — registre et plan d'action (STIME C2)

**Réf. :** Q5/26/176/177 · **Statut : suivi vivant — signatures Dominic** · MàJ 2026-07-09

## 1. Sous-traitants traitant des données personnelles

| Sous-traitant | Rôle | Données personnelles | Localisation | DPA | Action |
|---|---|---|---|---|---|
| **Hostinger** (VPS) | Hébergement de toute la plateforme | Toutes (comptes, GPS, photos, SMS…) | UE (datacenter) | ☐ à signer | Le DPA Hostinger est intégré à leurs CGU (« Data Processing Agreement », hpanel → légal). **Télécharger, vérifier la localisation contractuelle UE, archiver.** |
| **Opérateur SIM passerelle SMS** (téléphone Termux) | Acheminement des SMS quai/booking | N° de téléphone chauffeurs, contenu SMS | BE | ☐ n/a probable | Opérateur télécom = cadre ePrivacy, pas un ST RGPD classique. **Documenter l'analyse.** |
| **Let's Encrypt** | Certificats TLS | Aucune (domaines publics) | — | n/a | — |
| **GitHub** (dépôt privé) | Code source | Aucune donnée personnelle métier (vérifié : pas de dumps commités) | US (SCC) | ☐ | DPA GitHub standard (Customer Agreement). Archiver la référence. |
| **Expo / EAS** | Build APK | Aucune donnée métier | US (SCC) | ☐ | Idem — référence à archiver. |
| **ntfy.sh** | Push d'alertes techniques | **Aucune** (messages « service down », pas de données perso — vérifié) | UE (DE) | n/a | Documenté ici. Si un jour des données perso transitent → auto-héberger ntfy. |

## 2. À l'arrivée des services prévus

| Futur ST | Déclencheur | Action à la mise en service |
|---|---|---|
| **Stockage S3 UE** (OVH/Scaleway/Backblaze) | Contrat B2 | Signer le DPA au moment du contrat (standard chez les 3), l'ajouter ici + registre Art. 30 (destinataire « sauvegardes chiffrées » — données chiffrées age avant envoi : exposition minimale) |
| **Cloudflare** (WAF B5) | Décision DNS | DPA self-service (dashboard) + vérifier « EU data boundary » si exigé |
| **UptimeRobot** | Sonde externe B4 | Ne traite que l'URL publique — pas de DPA nécessaire, documenter |

## 3. Checklist de signature (par ST)

1. Récupérer le DPA type du fournisseur (tous les fournisseurs listés en ont un standard).
2. Vérifier : objet et durée du traitement, localisation UE ou SCC, sous-traitance ultérieure, assistance violation/droits, restitution/destruction en fin de contrat, audit.
3. Archiver le PDF signé/accepté dans `docs/operations/dpa/` (à créer, hors éventuel dépôt public).
4. Mettre à jour ce tableau (☑) + la section « destinataires » du registre Art. 30.

**Réponse STIME (Q176/177)** une fois fait : « DPA signés avec l'ensemble des
sous-traitants ; registre des sous-traitants tenu à jour, revu à chaque
nouveau fournisseur. »
