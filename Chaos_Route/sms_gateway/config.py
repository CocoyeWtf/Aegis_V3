# Configuration passerelle SMS / SMS gateway config
# Copier ce fichier sur le telephone Termux et adapter les valeurs

import logging
import os

logger = logging.getLogger(__name__)

SERVER_URL = os.getenv("SMS_GATEWAY_SERVER_URL", "")
if not SERVER_URL:
    logger.warning("SMS_GATEWAY_SERVER_URL is not set — SMS gateway will not reach the server")

API_KEY = os.getenv("SMS_API_KEY", "")
if not API_KEY:
    logger.warning("SMS_API_KEY is not set — SMS gateway authentication will fail")
