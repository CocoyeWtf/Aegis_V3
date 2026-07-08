# Plan de Reprise d'Activité (PRA) — CHAOS Platform

**Réf. STIME :** B6 (Q91/92/93/143/145) · **Version :** 1.0 — 2026-07-09 · **Propriétaire :** Dominic Verleyen
**Périmètre :** VPS de production `76.13.58.182` (Hostinger) — app, PostgreSQL, Caddy, monitoring, itmexport.

## 1. Objectifs

| Indicateur | Objectif | Mesuré |
|---|---|---|
| **RPO** (perte de données max) | ≤ 24 h (sauvegarde quotidienne 02:30) | Dump quotidien chiffré — vérifié 2026-07-08 |
| **RTO** (durée de reprise) | ≤ 4 h ouvrées (scénario 3) | Restauration base seule : **21 s** (exercice 2026-07-08, cf. `ops/backup/RESTORE_LOG.md`) |

> ⚠️ Tant que l'externalisation S3 (B2, contrat à prendre) n'est pas en place,
> le RPO en cas de **perte totale du VPS** (scénario 3) n'est pas garanti :
> les sauvegardes chiffrées résident sur le même serveur. **Point critique n° 1.**

## 2. Scénarios et procédures

### Scénario 1 — Service dégradé (app plante, conteneur unhealthy)
Détection : watchdog (< 5 min, push ntfy) + Grafana/Loki.
```bash
ssh root@76.13.58.182
docker ps                                   # identifier le conteneur en défaut
docker logs chaos-route-app-1 --tail 100    # ou via Grafana/Loki (6 mois d'historique)
cd /opt/chaos-route && docker compose restart app     # ou caddy/db
```
Si récidive : `docs/operations/RUNBOOK_INCIDENT.md` + rollback (`PROCEDURE_ROLLBACK.md`).
**RTO attendu : < 15 min.**

### Scénario 2 — Base corrompue / erreur humaine sur les données
```bash
# 1. Geler l'écriture
cd /opt/chaos-route && docker compose stop app
# 2. Restaurer le dernier dump chiffré (clé privée age : coffre Dominic)
#    Test à blanc d'abord (conteneur jetable) :
AGE_KEY_FILE=/chemin/cle.txt /root/ops/restore_test.sh
#    Puis restauration réelle :
age -d -i /chemin/cle.txt -o /tmp/restore.dump /root/backups/cmro_YYYYMMDD_HHMMSS.dump.age
docker compose cp /tmp/restore.dump db:/tmp/restore.dump
docker compose exec db pg_restore -U cmro -d cmro --clean --if-exists /tmp/restore.dump
shred -u /tmp/restore.dump
docker compose start app
```
**RTO attendu : < 1 h. RPO : dernière sauvegarde (≤ 24 h).**

### Scénario 3 — Perte totale du VPS (panne matérielle, compromission)
Reconstruction sur un VPS neuf (Hostinger ou autre) :
```bash
# 1. Provisionner Ubuntu 24.04, pointer le DNS chaosroute.chaosmanager.tech
#    et mexprt.chaosmanager.tech sur la nouvelle IP (TTL Hostinger ~300 s)
# 2. Installer Docker + age, cloner le dépôt
apt-get update && apt-get install -y docker.io docker-compose-v2 age git
git clone https://github.com/CocoyeWtf/Aegis_V3.git /opt/chaos-route-repo
ln -s /opt/chaos-route-repo/Chaos_Route /opt/chaos-route
# 3. Recréer /opt/chaos-route/.env.production depuis le coffre (secrets)
# 4. Récupérer le dernier dump chiffré (stockage S3 UE — cf. point critique n° 1)
# 5. Démarrer, restaurer, vérifier
cd /opt/chaos-route && docker compose up -d db
age -d -i cle.txt -o /tmp/restore.dump cmro_LAST.dump.age
docker compose cp /tmp/restore.dump db:/tmp/restore.dump
docker compose exec db pg_restore -U cmro -d cmro --clean --if-exists /tmp/restore.dump
docker compose up -d
# 6. Réinstaller ops : backup (ops/backup/README.md), monitoring
#    (ops/monitoring/README.md), cron
# 7. Vérifier : https://.../api/ -> 200, login, tablette test
```
**RTO cible : ≤ 4 h ouvrées** (dominé par le provisioning + DNS).
**Données hors base** à re-provisionner : `.env.production` (coffre), photos/`data/`
(⚠️ non externalisées à ce jour — les inclure au périmètre S3 avec la base), APK (`apk/`, re-téléchargeable depuis EAS).

### Scénario 4 — Indisponibilité Hostinger prolongée
Même procédure que scénario 3 chez un autre fournisseur UE (OVH/Scaleway).
Le dépôt Git (GitHub) + les sauvegardes S3 + le coffre de secrets suffisent
à reconstruire — **aucune dépendance à Hostinger** hors hébergement.

## 3. Haute disponibilité (état et cible)

- **Actuel** : mono-VPS, `restart: unless-stopped`, healthchecks + watchdog + tini.
  Redémarrage auto des conteneurs ; pas de bascule automatique inter-serveurs.
- **Cible groupe (si STIME l'exige)** : 2ᵉ VPS + réplication PostgreSQL en continu
  (streaming replication) + bascule DNS. Décision/budget : Dominic.
  L'architecture actuelle (Docker + configs versionnées + backups chiffrés) rend
  cette évolution incrémentale.

## 4. Exercices

| Date | Type | Résultat | Durée | Écarts |
|---|---|---|---|---|
| 2026-07-08 | Restauration base (test à blanc, conteneur jetable) | ✅ 187 users / 170 PDV / 102 tables | 21 s | 1 FK héritée (corrigée le 09/07) |
| _à planifier (annuel)_ | Reconstruction complète scénario 3 sur VPS temporaire | | | |

**Règle : un exercice complet (scénario 3) par an minimum**, consigné ici, avec RTO/RPO mesurés.

## 5. Points critiques ouverts

1. **Externalisation S3 UE des sauvegardes** (B2) — contrat à prendre (OVH/Scaleway/Backblaze). Sans elle, scénario 3 = perte potentielle des données depuis le dernier dump exporté manuellement.
2. Inclure `data/` (photos) et `pdv-plans/` dans la sauvegarde externalisée.
3. Exercice scénario 3 à planifier après mise en place du S3.
