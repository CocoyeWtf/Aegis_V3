#!/usr/bin/env bash
# =============================================================================
# Watchdog CHAOS Platform (STIME B4) — alerte < 5 min si service down.
# Cron : */2 * * * * /root/ops/chaos_watchdog.sh >> /var/log/chaos_watchdog.log 2>&1
#
# Vérifie : API HTTPS, santé des conteneurs, espace disque. Alerte par push
# ntfy (app mobile ntfy abonnée au topic secret NTFY_TOPIC). Anti-spam :
# alerte à la transition OK→KO, rappel toutes les 30 min, message de
# rétablissement à la transition KO→OK.
#
# Limite connue : si le VPS entier tombe, ce watchdog tombe avec lui —
# la sonde EXTERNE (UptimeRobot, cf. README) couvre ce cas.
# =============================================================================
set -u

ENV_FILE="/root/.chaos_watchdog.env"          # NTFY_TOPIC=... (+ NTFY_SERVER optionnel)
[ -f "$ENV_FILE" ] && . "$ENV_FILE"
NTFY_SERVER="${NTFY_SERVER:-https://ntfy.sh}"
NTFY_TOPIC="${NTFY_TOPIC:-}"
STATE_FILE="/run/chaos_watchdog.state"
REMIND_SECONDS=1800
API_URL="https://chaosroute.chaosmanager.tech/api/"
CONTAINERS="chaos-route-app-1 chaos-route-db-1 chaos-route-caddy-1"
DISK_ALERT_PCT=85

log() { echo "$(date -Is) [watchdog] $*"; }

notify() {  # notify <priorite> <titre> <message>
    [ -n "$NTFY_TOPIC" ] || { log "NTFY_TOPIC non défini — alerte non envoyée : $3"; return; }
    curl -fsS -m 10 \
        -H "Title: $2" -H "Priority: $1" -H "Tags: rotating_light" \
        -d "$3" "$NTFY_SERVER/$NTFY_TOPIC" >/dev/null \
        || log "échec envoi ntfy : $3"
}

# --- Contrôles / Checks ------------------------------------------------------
FAILS=""

curl -fsS -m 10 "$API_URL" >/dev/null 2>&1 || FAILS="API HTTPS injoignable;"

for c in $CONTAINERS; do
    st=$(docker inspect -f '{{.State.Health.Status}}' "$c" 2>/dev/null || echo "absent")
    [ "$st" = "healthy" ] || FAILS="${FAILS} conteneur ${c}: ${st};"
done

disk_pct=$(df -P / | awk 'NR==2 {print int($5)}')
[ "$disk_pct" -lt "$DISK_ALERT_PCT" ] || FAILS="${FAILS} disque ${disk_pct}%;"

# --- Machine à états / State machine ------------------------------------------
now=$(date +%s)
prev_status="OK"; prev_alert=0
if [ -f "$STATE_FILE" ]; then
    prev_status=$(cut -d'|' -f1 "$STATE_FILE")
    prev_alert=$(cut -d'|' -f2 "$STATE_FILE")
fi

if [ -n "$FAILS" ]; then
    log "KO: $FAILS"
    if [ "$prev_status" = "OK" ] || [ $((now - prev_alert)) -ge $REMIND_SECONDS ]; then
        notify urgent "CHAOS Route — PANNE" "$FAILS ($(date '+%d/%m %H:%M'))"
        echo "KO|$now" > "$STATE_FILE"
    else
        echo "KO|$prev_alert" > "$STATE_FILE"
    fi
else
    if [ "$prev_status" = "KO" ]; then
        log "rétablissement"
        notify default "CHAOS Route — rétabli" "Tous les services sont de nouveau opérationnels ($(date '+%d/%m %H:%M'))"
    fi
    echo "OK|0" > "$STATE_FILE"
fi
