"""
Schémas d'authentification / Authentication schemas.
Login, tokens, refresh.
"""

from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    """Requête de connexion / Login request."""
    username: str = Field(min_length=1, max_length=100)
    password: str = Field(min_length=1, max_length=200)


class TokenResponse(BaseModel):
    """Réponse avec tokens / Token response."""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    """Requête de rafraîchissement / Refresh request."""
    refresh_token: str


class ChangePasswordRequest(BaseModel):
    """Changement de mot de passe par l'utilisateur / User self password change."""
    current_password: str = Field(min_length=1, max_length=200)
    new_password: str = Field(min_length=4, max_length=200)


class ForgotPasswordRequest(BaseModel):
    """Demande de réinitialisation par email / Forgot password request."""
    email: str = Field(min_length=1, max_length=200)


class ResetPasswordRequest(BaseModel):
    """Réinitialisation du mot de passe via token / Reset password via token."""
    token: str
    new_password: str = Field(min_length=4, max_length=200)
