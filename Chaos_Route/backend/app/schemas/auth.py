"""
Schémas d'authentification / Authentication schemas.
Login, tokens, refresh.
"""

from pydantic import BaseModel, Field, field_validator

from app.utils.password_policy import validate_password_strength


class LoginRequest(BaseModel):
    """Requête de connexion / Login request."""
    username: str = Field(min_length=1, max_length=100)
    password: str = Field(min_length=1, max_length=200)


class TokenResponse(BaseModel):
    """Réponse avec tokens / Token response."""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    # Changement de mot de passe requis avant tout usage (ex. compte seedé) /
    # Password change required before any use (e.g. seeded account)
    must_change_password: bool = False


class RefreshRequest(BaseModel):
    """Requête de rafraîchissement / Refresh request.

    refresh_token optionnel : le web l'envoie via cookie HttpOnly (STIME A4),
    le mobile continue de l'envoyer dans le corps.
    """
    refresh_token: str | None = None


class ChangePasswordRequest(BaseModel):
    """Changement de mot de passe par l'utilisateur / User self password change."""
    current_password: str = Field(min_length=1, max_length=200)
    new_password: str = Field(max_length=200)

    @field_validator("new_password")
    @classmethod
    def _check_strength(cls, v: str) -> str:
        return validate_password_strength(v)


class ForgotPasswordRequest(BaseModel):
    """Demande de réinitialisation par email / Forgot password request."""
    email: str = Field(min_length=1, max_length=200)


class ResetPasswordRequest(BaseModel):
    """Réinitialisation du mot de passe via token / Reset password via token."""
    token: str
    new_password: str = Field(max_length=200)

    @field_validator("new_password")
    @classmethod
    def _check_strength(cls, v: str) -> str:
        return validate_password_strength(v)
