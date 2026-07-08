#!/bin/bash
# =============================================================================
# Wrapper pour les operations docker compose manuelles quand les secrets sont
# chiffres (STIME B3) : dechiffre .env.production le temps de la commande,
# purge garantie a la sortie.
#
# Exemples :
#   /root/ops/compose-with-secrets.sh up -d app      # apres edition d'un secret
#   /root/ops/compose-with-secrets.sh logs app --tail 50
#
# Edition d'un secret : sops /opt/chaos-route/.env.production.sops
# (rechiffre automatiquement a la sauvegarde), puis `up -d app` via ce wrapper.
# =============================================================================
set -e
cd /opt/chaos-route

if [ ! -f .env.production ] && [ -f .env.production.sops ]; then
    umask 077
    sops --decrypt .env.production.sops > .env.production
    trap 'rm -f /opt/chaos-route/.env.production' EXIT
fi

docker compose "$@"
