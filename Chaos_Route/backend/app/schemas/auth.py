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
    """Réponse avec tokens / Token response.

    Si mfa_required=True (compte avec TOTP actif, STIME B7), les jetons sont
    vides : le client doit appeler /auth/mfa-verify avec mfa_token + code.
    """
    access_token: str = ""
    refresh_token: str = ""
    token_type: str = "bearer"
    # Changement de mot de passe requis avant tout usage (ex. compte seedé) /
    # Password change required before any use (e.g. seeded account)
    must_change_password: bool = False
    # Second facteur requis / Second factor required (STIME B7)
    mfa_required: bool = False
    mfa_token: str | None = None


class MfaVerifyRequest(BaseModel):
    """Vérification du second facteur au login / Login second-factor check."""
    mfa_token: str
    code: str = Field(min_length=6, max_length=8)


class MfaActivateRequest(BaseModel):
    """Activation de l'enrôlement TOTP / TOTP enrollment activation."""
    code: str = Field(min_length=6, max_length=8)


class MfaDisableRequest(BaseModel):
    """Désactivation du TOTP (mot de passe + code exigés) / TOTP disable."""
    password: str = Field(min_length=1, max_length=200)
    code: str = Field(min_length=6, max_length=8)


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
