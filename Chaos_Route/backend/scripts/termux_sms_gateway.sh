#!/data/data/com.termux/files/usr/bin/bash
# =================================================================
# Passerelle SMS Termux / Termux SMS Gateway
# -----------------------------------------------------------------
# Ce script tourne en boucle sur un telephone Android avec Termux.
# Il interroge le serveur pour recuperer les SMS en attente,
# les envoie via termux-sms-send, et marque le resultat.
#
# INSTALLATION:
#   1. Installer Termux + Termux:API depuis F-Droid
#   2. pkg install termux-api curl jq
#   3. Copier ce script sur le telephone
#   4. Configurer SERVER_URL et API_KEY ci-dessous
#   5. chmod +x termux_sms_gateway.sh
#   6. Lancer : ./termux_sms_gateway.sh
#   7. (Optionnel) Ajouter au demarrage Termux :
#      mkdir -p ~/.termux/boot
#      cp termux_sms_gateway.sh ~/.termux/boot/
#
# PREREQUIS:
#   - Accorder la permission SMS a Termux:API
#   - Le telephone doit avoir une carte SIM active
# =================================================================

# ── Configuration ──
SERVER_URL="${SERVER_URL:-https://chaosroute.chaosmanager.tech}"
API_KEY="${API_KEY:-chaos-sms-default-key-change-me}"
POLL_INTERVAL=15  # secondes entre chaque verification
LOG_FILE="$HOME/sms_gateway.log"

log() {
  echo "$(date '+%Y-%m-%d %H:%M:%S') | $1" | tee -a "$LOG_FILE"
}

log "=== Demarrage passerelle SMS ==="
log "Serveur: $SERVER_URL"

while true; do
  # Recuperer les SMS en attente
  RESPONSE=$(curl -s -w "\n%{http_code}" \
    -H "X-API-Key: $API_KEY" \
    "$SERVER_URL/api/sms/pending/?limit=5" 2>/dev/null)

  HTTP_CODE=$(echo "$RESPONSE" | tail -1)
  BODY=$(echo "$RESPONSE" | sed '$d')

  if [ "$HTTP_CODE" != "200" ]; then
    log "ERREUR serveur HTTP $HTTP_CODE"
    sleep "$POLL_INTERVAL"
    continue
  fi

  # Parser les SMS
  COUNT=$(echo "$BODY" | jq 'length' 2>/dev/null)
  if [ -z "$COUNT" ] || [ "$COUNT" = "0" ] || [ "$COUNT" = "null" ]; then
    sleep "$POLL_INTERVAL"
    continue
  fi

  log "$COUNT SMS en attente"

  for i in $(seq 0 $((COUNT - 1))); do
    SMS_ID=$(echo "$BODY" | jq -r ".[$i].id")
    PHONE=$(echo "$BODY" | jq -r ".[$i].phone")
    SMS_BODY=$(echo "$BODY" | jq -r ".[$i].body")

    log "Envoi SMS #$SMS_ID a $PHONE..."

    # Envoyer via Termux
    if termux-sms-send -n "$PHONE" "$SMS_BODY" 2>/dev/null; then
      log "SMS #$SMS_ID envoye OK"
      curl -s -X POST \
        -H "X-API-Key: $API_KEY" \
        "$SERVER_URL/api/sms/$SMS_ID/sent" >/dev/null 2>&1
    else
      log "SMS #$SMS_ID ECHEC"
      curl -s -X POST \
        -H "X-API-Key: $API_KEY" \
        -H "Content-Type: application/json" \
        -d '{"error":"termux-sms-send failed"}' \
        "$SERVER_URL/api/sms/$SMS_ID/failed" >/dev/null 2>&1
    fi

    sleep 2  # Pause entre chaque SMS
  done

  sleep "$POLL_INTERVAL"
done
