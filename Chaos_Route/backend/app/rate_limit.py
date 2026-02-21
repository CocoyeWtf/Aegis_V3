"""Rate limiting global / Global rate limiter.

Utilise slowapi pour limiter les requetes par IP.
"""

from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
