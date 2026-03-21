#!/usr/bin/env python3
"""Passerelle SMS Termux / Termux SMS Gateway.
Tourne en boucle sur un smartphone Android avec Termux.
Recupere les SMS en attente depuis le serveur et les envoie via termux-sms-send.

Installation Termux :
  pkg install python termux-api
  pip install requests
  cp gateway.py ~/gateway.py
  cp config.py ~/config.py  (editer avec vos valeurs)

Lancement :
  python ~/gateway.py

Lancement automatique au demarrage :
  mkdir -p ~/.termux/boot
  echo '#!/data/data/com.termux/files/usr/bin/bash' > ~/.termux/boot/start_sms_gateway.sh
  echo 'sleep 30 && python ~/gateway.py >> ~/sms_gateway.log 2>&1 &' >> ~/.termux/boot/start_sms_gateway.sh
  chmod +x ~/.termux/boot/start_sms_gateway.sh
"""

import subprocess
import time
import json
import logging
from datetime import datetime

try:
    import requests
except ImportError:
    print("ERREUR: pip install requests")
    exit(1)

# ─── Configuration ───
try:
    from config import SERVER_URL, API_KEY
except ImportError:
    # Valeurs par defaut — A MODIFIER
    SERVER_URL = "http://76.13.58.182/api/sms"
    API_KEY = "chaos-sms-default-key-change-me"

POLL_INTERVAL = 60       # Secondes entre chaque verification
DELAY_BETWEEN_SMS = 5    # Secondes entre chaque envoi (anti-spam operateur)
MAX_RETRIES = 3          # Tentatives max par SMS

# ─── Logging ───
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger("sms-gateway")

HEADERS = {"X-API-Key": API_KEY, "Content-Type": "application/json"}


def get_pending_sms():
    """Recuperer les SMS en attente depuis le serveur."""
    try:
        resp = requests.get(f"{SERVER_URL}/pending/", headers=HEADERS, timeout=15)
        resp.raise_for_status()
        return resp.json()
    except Exception as e:
        log.error(f"Erreur recuperation SMS: {e}")
        return []


def send_sms(phone: str, body: str) -> bool:
    """Envoyer un SMS via termux-sms-send."""
    try:
        result = subprocess.run(
            ["termux-sms-send", "-n", phone, body],
            capture_output=True, text=True, timeout=30,
        )
        if result.returncode == 0:
            log.info(f"SMS envoye a {phone}: {body[:50]}...")
            return True
        else:
            log.error(f"Erreur termux-sms-send: {result.stderr}")
            return False
    except FileNotFoundError:
        log.error("termux-sms-send non trouve. Installer: pkg install termux-api")
        return False
    except subprocess.TimeoutExpired:
        log.error(f"Timeout envoi SMS a {phone}")
        return False
    except Exception as e:
        log.error(f"Erreur envoi SMS: {e}")
        return False


def mark_sent(sms_id: int):
    """Marquer le SMS comme envoye sur le serveur."""
    try:
        resp = requests.post(f"{SERVER_URL}/{sms_id}/sent", headers=HEADERS, timeout=10)
        resp.raise_for_status()
    except Exception as e:
        log.error(f"Erreur confirmation envoi SMS #{sms_id}: {e}")


def mark_failed(sms_id: int, error: str):
    """Marquer le SMS comme echoue sur le serveur."""
    try:
        resp = requests.post(
            f"{SERVER_URL}/{sms_id}/failed",
            headers=HEADERS, json={"error": error}, timeout=10,
        )
        resp.raise_for_status()
    except Exception as e:
        log.error(f"Erreur marquage echec SMS #{sms_id}: {e}")


def process_queue():
    """Traiter la file d'attente."""
    messages = get_pending_sms()
    if not messages:
        return

    log.info(f"{len(messages)} SMS en attente")

    for msg in messages:
        sms_id = msg["id"]
        phone = msg["phone"]
        body = msg["body"]

        log.info(f"Envoi SMS #{sms_id} a {phone}")
        success = send_sms(phone, body)

        if success:
            mark_sent(sms_id)
        else:
            mark_failed(sms_id, "termux-sms-send failed")

        # Delai anti-spam entre les SMS
        if len(messages) > 1:
            time.sleep(DELAY_BETWEEN_SMS)


def main():
    log.info("=== Passerelle SMS demarree ===")
    log.info(f"Serveur: {SERVER_URL}")
    log.info(f"Intervalle: {POLL_INTERVAL}s")

    while True:
        try:
            process_queue()
        except KeyboardInterrupt:
            log.info("Arret demande")
            break
        except Exception as e:
            log.error(f"Erreur inattendue: {e}")

        time.sleep(POLL_INTERVAL)


if __name__ == "__main__":
    main()
