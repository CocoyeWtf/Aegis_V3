#!/usr/bin/env bash
# =============================================================================
# Sauvegarde nocturne CHAOS Platform (STIME B1/B2)
# pg_dump -> compression -> chiffrement age -> copie locale + upload S3 UE
# + rotation. Journal horodaté dans /var/log/chaos_backup.log.
#
# Installation (VPS, root) :
#   1. apt-get install -y age  (ou télécharger le binaire age)
#   2. Générer la paire de clés UNE FOIS, hors du serveur de préférence :
#        age-keygen -o chaos_backup_key.txt        # PRIVÉE — coffre-fort, PAS sur le VPS
#      et reporter la clé publique (age1...) dans AGE_RECIPIENT ci-dessous.
#   3. Copier ce script : /root/ops/backup_chaos.sh (chmod 700)
#   4. Renseigner /root/.chaos_backup.env (chmod 600) — voir README.md
#   5. Cron : 30 2 * * * /root/ops/backup_chaos.sh >> /var/log/chaos_backup.log 2>&1
#
# Restauration : voir restore_test.sh (exercice à exécuter au moins 1x/an).
# =============================================================================
set -euo pipefail

# --- Configuration (surchargée par /root/.chaos_backup.env) -----------------
COMPOSE_DIR="${COMPOSE_DIR:-/root/Chaos_Route}"
BACKUP_DIR="${BACKUP_DIR:-/root/backups}"
DB_USER="${DB_USER:-cmro}"
DB_NAME="${DB_NAME:-cmro}"
RETENTION_DAYS_LOCAL="${RETENTION_DAYS_LOCAL:-14}"    # dumps chiffrés locaux
# Clé PUBLIQUE age (le VPS ne peut que chiffrer, jamais déchiffrer)
AGE_RECIPIENT="${AGE_RECIPIENT:-}"
# Stockage externe S3 compatible UE (Scaleway/OVH/Backblaze EU) — optionnel mais
# requis pour la conformité (copie hors site). Utilise l'outil `aws` ou `s3cmd`.
S3_BUCKET="${S3_BUCKET:-}"                             # ex. s3://chaos-backups-eu
S3_ENDPOINT="${S3_ENDPOINT:-}"                         # ex. https://s3.fr-par.scw.cloud
RETENTION_DAYS_REMOTE="${RETENTION_DAYS_REMOTE:-90}"

ENV_FILE="/root/.chaos_backup.env"
[ -f "$ENV_FILE" ] && . "$ENV_FILE"

TS="$(date +%Y%m%d_%H%M%S)"
DUMP="cmro_${TS}.dump"
LOG_PREFIX="[chaos-backup]"

log() { echo "$(date -Is) ${LOG_PREFIX} $*"; }

fail() { log "ERREUR: $*"; exit 1; }

[ -n "$AGE_RECIPIENT" ] || fail "AGE_RECIPIENT non défini : sauvegarde NON chiffrée refusée (STIME B2)."
command -v age >/dev/null || fail "binaire 'age' introuvable (apt-get install age)."

mkdir -p "$BACKUP_DIR"

# --- 1. Dump PostgreSQL (format custom, compressé) ---------------------------
log "pg_dump ${DB_NAME} ..."
docker compose -f "$COMPOSE_DIR/docker-compose.yml" exec -T db \
    pg_dump -U "$DB_USER" -d "$DB_NAME" -Fc -Z 6 -f "/tmp/${DUMP}" \
    || fail "pg_dump a échoué"
docker compose -f "$COMPOSE_DIR/docker-compose.yml" cp "db:/tmp/${DUMP}" "$BACKUP_DIR/${DUMP}" \
    || fail "extraction du dump hors conteneur a échoué"
docker compose -f "$COMPOSE_DIR/docker-compose.yml" exec -T db rm -f "/tmp/${DUMP}"

SIZE=$(stat -c %s "$BACKUP_DIR/${DUMP}")
[ "$SIZE" -gt 10000 ] || fail "dump suspect (${SIZE} octets) — sauvegarde invalide"

# --- 2. Chiffrement age (clé publique : rien de déchiffrable sur le VPS) -----
log "chiffrement age ..."
age -r "$AGE_RECIPIENT" -o "$BACKUP_DIR/${DUMP}.age" "$BACKUP_DIR/${DUMP}" \
    || fail "chiffrement age a échoué"
rm -f "$BACKUP_DIR/${DUMP}"                            # jamais de dump en clair au repos

# --- 3. Copie hors site (S3 compatible UE) -----------------------------------
if [ -n "$S3_BUCKET" ]; then
    log "upload ${S3_BUCKET} ..."
    aws s3 cp "$BACKUP_DIR/${DUMP}.age" "${S3_BUCKET}/${DUMP}.age" \
        ${S3_ENDPOINT:+--endpoint-url "$S3_ENDPOINT"} \
        || fail "upload S3 a échoué (la copie locale chiffrée existe : $BACKUP_DIR/${DUMP}.age)"
    # Rotation distante
    CUTOFF=$(date -d "-${RETENTION_DAYS_REMOTE} days" +%Y%m%d)
    aws s3 ls "${S3_BUCKET}/" ${S3_ENDPOINT:+--endpoint-url "$S3_ENDPOINT"} \
        | awk '{print $NF}' | grep -E '^cmro_[0-9]{8}_[0-9]{6}\.dump\.age$' \
        | while read -r f; do
            d=$(echo "$f" | sed -E 's/^cmro_([0-9]{8})_.*/\1/')
            if [ "$d" -lt "$CUTOFF" ]; then
                aws s3 rm "${S3_BUCKET}/${f}" ${S3_ENDPOINT:+--endpoint-url "$S3_ENDPOINT"}
                log "rotation distante: ${f} supprimé"
            fi
        done
else
    log "AVERTISSEMENT: S3_BUCKET non défini — pas de copie hors site (non conforme B2)."
fi

# --- 4. Rotation locale -------------------------------------------------------
find "$BACKUP_DIR" -name 'cmro_*.dump.age' -mtime "+${RETENTION_DAYS_LOCAL}" -delete
# Les anciens dumps NON chiffrés (avant B2) sont purgés après la période de rétention
find "$BACKUP_DIR" -name 'cmro_*.dump' -mtime "+${RETENTION_DAYS_LOCAL}" -delete

log "OK ${DUMP}.age ($(stat -c %s "$BACKUP_DIR/${DUMP}.age") octets), rétention locale ${RETENTION_DAYS_LOCAL} j, distante ${RETENTION_DAYS_REMOTE} j."
