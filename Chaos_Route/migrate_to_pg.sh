#!/bin/bash
# =============================================================
# ONE-TIME: Migration SQLite → PostgreSQL
# Executer depuis /opt/chaos-route sur le VPS
# Usage: cd /opt/chaos-route && sudo ./migrate_to_pg.sh
# =============================================================
set -e

cd /opt/chaos-route

echo "==========================================="
echo "  Migration SQLite → PostgreSQL"
echo "==========================================="
echo ""

# --- STEP 1 : Backup SQLite ---
echo "=== STEP 1: Backup SQLite ==="
BACKUP_NAME="chaos_route_backup_$(date +%Y%m%d_%H%M%S).db"
cp data/chaos_route.db "data/${BACKUP_NAME}"
echo "[OK] Backup cree : data/${BACKUP_NAME}"

# --- STEP 2 : Stop app + caddy ---
echo ""
echo "=== STEP 2: Arret de l'application ==="
docker compose stop app caddy || true
echo "[OK] App et Caddy arretes"

# --- STEP 3 : Demarrer PostgreSQL seul ---
echo ""
echo "=== STEP 3: Demarrage PostgreSQL ==="
docker compose up -d db
echo "Attente du demarrage PostgreSQL..."
sleep 5
docker compose exec db pg_isready -U cmro -d cmro
echo "[OK] PostgreSQL pret"

# --- STEP 4 : Build du nouveau container app ---
echo ""
echo "=== STEP 4: Build du container app ==="
docker compose build --no-cache app
echo "[OK] Container app construit"

# --- STEP 5 : Lancer la migration des donnees ---
echo ""
echo "=== STEP 5: Migration des donnees SQLite → PostgreSQL ==="
docker compose run --rm \
  -e SQLITE_URL=sqlite+aiosqlite:///./data/chaos_route.db \
  app python -m scripts.migrate_sqlite_to_pg
echo "[OK] Migration des donnees terminee"

# --- STEP 6 : Demarrer tout ---
echo ""
echo "=== STEP 6: Demarrage complet ==="
docker compose up -d
echo "[OK] Tous les services demarres"

# --- STEP 7 : Verifier ---
echo ""
echo "=== STEP 7: Verification ==="
sleep 3
docker compose ps
echo ""

# --- STEP 8 : Backup PostgreSQL post-migration ---
echo "=== STEP 8: Backup PostgreSQL ==="
PG_BACKUP="data/pg_backup_post_migration_$(date +%Y%m%d).sql"
docker compose exec -T db pg_dump -U cmro cmro > "${PG_BACKUP}"
echo "[OK] Backup PostgreSQL cree : ${PG_BACKUP}"

echo ""
echo "==========================================="
echo "  Migration terminee !"
echo "  Verifier : https://chaosroute.chaosmanager.tech"
echo "==========================================="
