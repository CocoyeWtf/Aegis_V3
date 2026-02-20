"""
Utilitaires d'authentification / Authentication utilities.
Hashing de mots de passe et gestion des tokens JWT.
Password hashing and JWT token management.
"""

from datetime import datetime, timedelta, timezone

import bcrypt
from jose import JWTError, jwt

from app.config import settings

# Constantes des ressources et actions / Resource and action constants
RESOURCES = [
    "dashboard",
    "countries",
    "bases",
    "pdvs",
    "suppliers",
    "volumes",
    "contracts",
    "distances",
    "base-activities",
    "parameters",
    "tour-planning",
    "tour-history",
    "operations",
    "guard-post",
    "imports-exports",
    "users",
    "roles",
    "loaders",
    "devices",
    "tracking",
    "support-types",
    "pickup-requests",
]
ACTIONS = ["read", "create", "update", "delete"]


def hash_password(password: str) -> str:
    """Hasher un mot de passe / Hash a password."""
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Vérifier un mot de passe / Verify a password."""
    return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))


def create_access_token(user_id: int) -> str:
    """Créer un access token JWT / Create a JWT access token."""
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {"sub": str(user_id), "type": "access", "exp": expire}
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def create_refresh_token(user_id: int) -> str:
    """Créer un refresh token JWT / Create a JWT refresh token."""
    expire = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    payload = {"sub": str(user_id), "type": "refresh", "exp": expire}
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_token(token: str) -> dict | None:
    """Décoder un token JWT / Decode a JWT token. Returns None if invalid."""
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
    except JWTError:
        return None
