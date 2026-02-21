#!/bin/bash
# =============================================================
# Script de deploiement / Deployment script
# Usage : cd /opt/chaos-route && sudo ./deploy.sh
# =============================================================
set -e

cd /opt/chaos-route

echo "=== Pull des dernieres modifications / Pulling latest changes ==="
git pull origin main

echo "=== Build Docker ==="
docker compose build --no-cache

echo "=== Redemarrage des conteneurs / Restarting containers ==="
docker compose up -d

echo "=== Nettoyage des images inutilisees / Cleaning unused images ==="
docker image prune -f

echo "=== Deploiement termine / Deployment complete ==="
docker compose ps
