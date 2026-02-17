"""
Schémas d'authentification / Authentication schemas.
Login, tokens, refresh.
"""

from pydantic import BaseModel


class LoginRequest(BaseModel):
    """Requête de connexion / Login request."""
    username: str
    password: str


class TokenResponse(BaseModel):
    """Réponse avec tokens / Token response."""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    """Requête de rafraîchissement / Refresh request."""
    refresh_token: str
