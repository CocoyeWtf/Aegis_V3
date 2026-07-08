# Sauvegardes CHAOS Platform (STIME B1/B2)

Répond aux points **B1** (sauvegarde versionnée + tracée) et **B2** (chiffrée,
externalisée, testée) du [plan de remédiation](../../docs/PLAN_REMEDIATION_STIME.md).

## Architecture

```
02:30 cron ─▶ backup_chaos.sh
              ├─ pg_dump -Fc (compressé) depuis le conteneur db
              ├─ chiffrement age (clé PUBLIQUE seule sur le VPS)
              ├─ /root/backups/cmro_YYYYMMDD_HHMMSS.dump.age   (rétention 14 j)
              ├─ upload S3 compatible UE                        (rétention 90 j)
              └─ journal /var/log/chaos_backup.log
```

- **Chiffrement** : [age](https://github.com/FiloSottile/age), clé publique sur le
  VPS → un attaquant qui vole les dumps ne peut rien déchiffrer. La clé **privée**
  est conservée hors ligne (coffre de mots de passe), jamais sur le VPS.
- **Externalisation** : bucket S3 compatible dans l'UE (Scaleway `fr-par`,
  OVH, Backblaze EU). **Décision D : choisir le fournisseur** (plan B2).
- **Aucun dump en clair au repos** : le `.dump` intermédiaire est supprimé
  immédiatement après chiffrement.

## Installation sur le VPS (une fois)

```bash
apt-get update && apt-get install -y age awscli
mkdir -p /root/ops && cp backup_chaos.sh /root/ops/ && chmod 700 /root/ops/backup_chaos.sh

# Clé age — générer HORS VPS, ne copier que la clé publique :
age-keygen -o chaos_backup_key.txt     # à ranger dans le coffre
grep 'public key' chaos_backup_key.txt # → age1...

cat > /root/.chaos_backup.env <<'EOF'
AGE_RECIPIENT=age1...................................
S3_BUCKET=s3://chaos-backups-eu
S3_ENDPOINT=https://s3.fr-par.scw.cloud
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
EOF
chmod 600 /root/.chaos_backup.env

( crontab -l 2>/dev/null; echo '30 2 * * * /root/ops/backup_chaos.sh >> /var/log/chaos_backup.log 2>&1' ) | crontab -
```

> **B1 — audit de l'existant** : avant d'installer, relever le cron actuel
> (`crontab -l`) et l'éventuel script en place, vérifier la présence de dumps
> dans `/root/backups` et archiver le dernier. Remplacer ensuite l'ancien cron
> par celui-ci (un seul job de sauvegarde).

## Test de restauration (exercice annuel — B2/B6)

```bash
AGE_KEY_FILE=/chemin/cle_privee.txt ./restore_test.sh
```

Restaure le dernier dump dans un conteneur PostgreSQL jetable, vérifie les
invariants (users, pdvs, nombre de tables) et mesure la durée. **Consigner
chaque exercice dans `RESTORE_LOG.md`** (date, dump utilisé, durée, RPO constaté).

## Preuves pour l'audit

- Script versionné : ce répertoire.
- Preuve d'exécution : `/var/log/chaos_backup.log` (horodaté) + listing S3.
- Preuve de restauration : `RESTORE_LOG.md`.
