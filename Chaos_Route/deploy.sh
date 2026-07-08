#!/bin/bash
# =============================================================
# Script de deploiement / Deployment script
# Usage : cd /opt/chaos-route && bash deploy.sh
# =============================================================
set -e

cd /opt/chaos-route

echo "=== Pull des dernieres modifications / Pulling latest changes ==="
git pull origin main

# Secrets chiffres au repos (STIME B3) : .env.production n'existe plus en
# clair sur le disque. Dechiffrement ephemere le temps du deploiement, purge
# garantie a la sortie (meme en cas d'echec). / Encrypted secrets at rest:
# ephemeral decrypt for the deploy, guaranteed cleanup on exit.
if [ -f .env.production.sops ]; then
    umask 077
    sops --decrypt .env.production.sops > .env.production
    trap 'rm -f /opt/chaos-route/.env.production' EXIT
fi

echo "=== Build Docker ==="
docker compose build --no-cache

echo "=== Redemarrage des conteneurs / Restarting containers ==="
docker compose up -d

echo "=== Nettoyage des images inutilisees / Cleaning unused images ==="
docker image prune -f

echo "=== Deploiement termine / Deployment complete ==="
docker compose ps
