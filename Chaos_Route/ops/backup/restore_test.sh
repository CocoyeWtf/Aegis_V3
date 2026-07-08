#!/usr/bin/env bash
# =============================================================================
# Test de restauration CHAOS Platform (STIME B2 — « restauration testée »)
#
# Restaure le dernier dump chiffré dans une base JETABLE (conteneur PostgreSQL
# temporaire), vérifie des invariants métier, puis détruit le conteneur.
# N'IMPACTE PAS la production. À exécuter au moins 1 fois par an (exercice PRA)
# et après tout changement du script de sauvegarde.
#
# Usage : ./restore_test.sh [fichier.dump.age]
#         AGE_KEY_FILE=/chemin/cle_privee.txt ./restore_test.sh
# Sortie : code 0 + rapport si OK ; code 1 sinon. Consigner date/durée/RPO
#          dans ops/backup/RESTORE_LOG.md.
# =============================================================================
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/root/backups}"
AGE_KEY_FILE="${AGE_KEY_FILE:?Définir AGE_KEY_FILE=/chemin/vers/cle_privee_age.txt}"
DB_USER="${DB_USER:-cmro}"
DB_NAME="${DB_NAME:-cmro}"
CONTAINER="chaos_restore_test"

DUMP_AGE="${1:-$(ls -t "$BACKUP_DIR"/cmro_*.dump.age 2>/dev/null | head -1)}"
[ -n "$DUMP_AGE" ] || { echo "Aucun dump chiffré trouvé dans $BACKUP_DIR"; exit 1; }

echo "=== Test de restauration : $DUMP_AGE ==="
START=$(date +%s)

WORK=$(mktemp -d)
trap 'rm -rf "$WORK"; docker rm -f "$CONTAINER" >/dev/null 2>&1 || true' EXIT

# 1. Déchiffrement (nécessite la clé PRIVÉE — jamais stockée sur le VPS)
age -d -i "$AGE_KEY_FILE" -o "$WORK/restore.dump" "$DUMP_AGE"
echo "[ok] déchiffrement age"

# 2. Base jetable
docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
docker run -d --name "$CONTAINER" -e POSTGRES_USER="$DB_USER" \
    -e POSTGRES_PASSWORD=restore_test -e POSTGRES_DB="$DB_NAME" postgres:16-alpine >/dev/null
until docker exec "$CONTAINER" pg_isready -U "$DB_USER" -d "$DB_NAME" >/dev/null 2>&1; do sleep 1; done
echo "[ok] conteneur PostgreSQL jetable démarré"

# 3. Restauration
docker cp "$WORK/restore.dump" "$CONTAINER:/tmp/restore.dump"
docker exec "$CONTAINER" pg_restore -U "$DB_USER" -d "$DB_NAME" --no-owner /tmp/restore.dump
echo "[ok] pg_restore terminé"

# 4. Invariants métier : la restauration contient bien des données exploitables
check() {  # check <label> <sql> — échoue si résultat = 0
    local n
    n=$(docker exec "$CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -tAc "$2")
    if [ "${n:-0}" -gt 0 ]; then echo "[ok] $1 : $n"; else echo "[ECHEC] $1 : $n"; exit 1; fi
}
check "utilisateurs"  "SELECT count(*) FROM users;"
check "PDV"           "SELECT count(*) FROM pdvs;"
check "tables"        "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';"

DUR=$(( $(date +%s) - START ))
DUMP_TS=$(basename "$DUMP_AGE" | sed -E 's/^cmro_([0-9]{8}_[0-9]{6}).*/\1/')
echo "=== RESTAURATION OK — durée ${DUR}s — dump du ${DUMP_TS} (RPO = écart avec maintenant) ==="
echo "Consigner ce résultat dans ops/backup/RESTORE_LOG.md"
