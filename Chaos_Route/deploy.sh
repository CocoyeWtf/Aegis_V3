#!/bin/bash
# =============================================================
# Script de déploiement / Deployment script
# Usage : cd /opt/chaos-route && sudo ./deploy.sh
# =============================================================
set -e

cd /opt/chaos-route

echo "=== Pull des dernières modifications / Pulling latest changes ==="
git pull origin main

echo "=== Build Docker ==="
docker compose build --no-cache

echo "=== Redémarrage des conteneurs / Restarting containers ==="
docker compose up -d

echo "=== Nettoyage des images inutilisées / Cleaning unused images ==="
docker image prune -f

echo "=== Déploiement terminé / Deployment complete ==="
docker compose ps
