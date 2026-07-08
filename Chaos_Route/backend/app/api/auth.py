"""
Routes d'authentification / Authentication routes.
Login, refresh token, profil utilisateur.
"""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status

from app.config import settings
from app.rate_limit import limiter
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.models.audit import AuditLog
from app.schemas.auth import (
    LoginRequest, RefreshRequest, TokenResponse,
    ChangePasswordRequest, ForgotPasswordRequest, ResetPasswordRequest,
)
from app.schemas.user import UserMe
from app.utils.auth import (
    create_access_token, create_refresh_token, create_reset_token,
    decode_token, verify_password, hash_password,
)
from app.api.deps import get_current_user
from app.services.token_revocation import is_revoked, revoke_token
from app.utils.password_policy import PasswordPolicyError, validate_password_strength

router = APIRouter()


def _client_ip(request: Request) -> str:
    """Extraire l'IP client / Extract client IP (supports X-Forwarded-For behind proxy)."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


# ---------------------------------------------------------------------------
# Cookies HttpOnly (STIME A4) : le front web n'écrit plus les jetons en
# localStorage (inexfiltrables par XSS). L'app mobile continue d'utiliser les
# jetons du corps de réponse (Bearer). / HttpOnly cookies for the web front;
# the mobile app keeps using body tokens (Bearer).
# ---------------------------------------------------------------------------

def _set_auth_cookies(response: Response, access_token: str, refresh_token: str) -> None:
    secure = not settings.DEBUG
    response.set_cookie(
        "access_token", access_token,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        httponly=True, secure=secure, samesite="lax", path="/",
    )
    # Refresh limité au chemin auth (jamais envoyé sur les routes métier)
    response.set_cookie(
        "refresh_token", refresh_token,
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400,
        httponly=True, secure=secure, samesite="strict", path="/api/auth",
    )


def _clear_auth_cookies(response: Response) -> None:
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/api/auth")


@router.post("/login", response_model=TokenResponse)
@limiter.limit(settings.RATE_LIMIT_LOGIN)
async def login(request: Request, response: Response, data: LoginRequest, db: AsyncSession = Depends(get_db)):
    """Connexion par identifiants / Login with credentials."""
    result = await db.execute(select(User).where(User.username == data.username))
    user = result.scalar_one_or_none()
    ip = _client_ip(request)
    now = datetime.now(timezone.utc).isoformat(timespec="seconds")

    if user is None or not verify_password(data.password, user.hashed_password):
        # Journal de tentative échouée / Log failed login attempt
        db.add(AuditLog(
            entity_type="auth", entity_id=0, action="LOGIN_FAILED",
            changes=f'{{"username":"{data.username}","ip":"{ip}"}}',
            user=data.username, timestamp=now,
        ))
        await db.commit()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    if not user.is_active:
        db.add(AuditLog(
            entity_type="auth", entity_id=user.id, action="LOGIN_DISABLED",
            changes=f'{{"ip":"{ip}"}}',
            user=user.username, timestamp=now,
        ))
        await db.commit()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Account disabled")

    # Journal de connexion réussie / Log successful login
    db.add(AuditLog(
        entity_type="auth", entity_id=user.id, action="LOGIN",
        changes=f'{{"ip":"{ip}"}}',
        user=user.username, timestamp=now,
    ))

    access_token = create_access_token(user.id)
    refresh_token = create_refresh_token(user.id)
    _set_auth_cookies(response, access_token, refresh_token)
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        must_change_password=bool(user.must_change_password),
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh(request: Request, response: Response, data: RefreshRequest | None = None,
                  db: AsyncSession = Depends(get_db)):
    """Rafraîchir les tokens / Refresh tokens.

    Jeton accepté depuis le corps (mobile) ou le cookie HttpOnly (web).
    Rotation : l'ancien refresh token est révoqué à chaque usage (STIME A4).
    """
    raw_token = (data.refresh_token if data else None) or request.cookies.get("refresh_token")
    payload = decode_token(raw_token) if raw_token else None
    if payload is None or payload.get("type") != "refresh":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

    if await is_revoked(db, payload.get("jti")):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token revoked")

    user_id = int(payload["sub"])
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if user is None or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found or inactive")

    # Rotation : un refresh token ne sert qu'une fois / One-time use refresh token
    await revoke_token(db, payload, reason="rotation")

    access_token = create_access_token(user.id)
    refresh_token = create_refresh_token(user.id)
    _set_auth_cookies(response, access_token, refresh_token)
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        must_change_password=bool(user.must_change_password),
    )


@router.post("/logout")
async def logout(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Déconnexion avec révocation serveur des jetons (STIME A4) /
    Logout with server-side token revocation."""
    # Révoquer l'access token courant (header ou cookie) / Revoke current access token
    auth_header = request.headers.get("authorization", "")
    raw_access = auth_header[7:] if auth_header.lower().startswith("bearer ") else request.cookies.get("access_token")
    access_payload = decode_token(raw_access) if raw_access else None
    if access_payload:
        await revoke_token(db, access_payload, reason="logout")

    # Révoquer le refresh token si transmis (cookie web) / Revoke refresh if present
    raw_refresh = request.cookies.get("refresh_token")
    refresh_payload = decode_token(raw_refresh) if raw_refresh else None
    if refresh_payload:
        await revoke_token(db, refresh_payload, reason="logout")

    _clear_auth_cookies(response)

    db.add(AuditLog(
        entity_type="auth", entity_id=user.id, action="LOGOUT",
        changes=f'{{"ip":"{_client_ip(request)}"}}',
        user=user.username, timestamp=datetime.now(timezone.utc).isoformat(timespec="seconds"),
    ))
    return {"detail": "Déconnecté"}


@router.put("/change-password")
async def change_password(
    request: Request,
    data: ChangePasswordRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Changer son propre mot de passe / Change own password (requires current password)."""
    if not verify_password(data.current_password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Mot de passe actuel incorrect")

    # Compte à privilèges → exigence renforcée (le schéma a déjà validé la base)
    if user.is_superadmin:
        try:
            validate_password_strength(data.new_password, privileged=True)
        except PasswordPolicyError as e:
            raise HTTPException(status_code=400, detail=str(e))

    user.hashed_password = hash_password(data.new_password)
    user.must_change_password = False
    await db.flush()

    ip = _client_ip(request)
    now = datetime.now(timezone.utc).isoformat(timespec="seconds")
    db.add(AuditLog(
        entity_type="auth", entity_id=user.id, action="PASSWORD_CHANGED",
        changes=f'{{"ip":"{ip}","self":true}}',
        user=user.username, timestamp=now,
    ))

    return {"detail": "Mot de passe modifié avec succès"}


@router.post("/forgot-password")
@limiter.limit(settings.RATE_LIMIT_REGISTER)
async def forgot_password(request: Request, data: ForgotPasswordRequest, db: AsyncSession = Depends(get_db)):
    """Envoyer un email de réinitialisation / Send password reset email."""
    ip = _client_ip(request)
    now = datetime.now(timezone.utc).isoformat(timespec="seconds")

    result = await db.execute(select(User).where(User.email == data.email))
    user = result.scalar_one_or_none()

    # Toujours répondre OK (ne pas révéler si l'email existe) / Always respond OK
    if not user or not user.is_active:
        db.add(AuditLog(
            entity_type="auth", entity_id=0, action="RESET_REQUEST_UNKNOWN",
            changes=f'{{"email":"{data.email}","ip":"{ip}"}}',
            user="anonymous", timestamp=now,
        ))
        await db.commit()
        return {"detail": "Si cette adresse existe, un email a été envoyé"}

    token = create_reset_token(user.id)
    reset_url = f"{settings.PUBLIC_URL}/reset-password?token={token}"

    # Envoi email / Send email
    if settings.SMTP_HOST:
        import aiosmtplib
        from email.message import EmailMessage

        msg = EmailMessage()
        msg["From"] = settings.SMTP_FROM
        msg["To"] = user.email
        msg["Subject"] = "Chaos RouteManager — Réinitialisation de mot de passe"
        msg.set_content(
            f"Bonjour {user.username},\n\n"
            f"Vous avez demandé la réinitialisation de votre mot de passe.\n"
            f"Cliquez sur le lien ci-dessous (valable 15 minutes) :\n\n"
            f"{reset_url}\n\n"
            f"Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.\n\n"
            f"— Chaos RouteManager"
        )

        try:
            await aiosmtplib.send(
                msg,
                hostname=settings.SMTP_HOST,
                port=settings.SMTP_PORT,
                username=settings.SMTP_USER or None,
                password=settings.SMTP_PASSWORD or None,
                use_tls=settings.SMTP_USE_TLS,
            )
        except Exception as e:
            import logging
            logging.getLogger(__name__).error(f"Erreur envoi email reset: {e}")
            raise HTTPException(status_code=500, detail="Erreur lors de l'envoi de l'email")
    else:
        # Pas de SMTP configuré — log le lien pour debug / No SMTP — log link for debug
        import logging
        logging.getLogger(__name__).warning(f"SMTP non configuré. Lien reset: {reset_url}")

    db.add(AuditLog(
        entity_type="auth", entity_id=user.id, action="RESET_REQUESTED",
        changes=f'{{"ip":"{ip}"}}',
        user=user.username, timestamp=now,
    ))

    return {"detail": "Si cette adresse existe, un email a été envoyé"}


@router.post("/reset-password")
@limiter.limit(settings.RATE_LIMIT_LOGIN)
async def reset_password(request: Request, data: ResetPasswordRequest, db: AsyncSession = Depends(get_db)):
    """Réinitialiser le mot de passe via token / Reset password via token."""
    payload = decode_token(data.token)
    if payload is None or payload.get("type") != "reset":
        raise HTTPException(status_code=400, detail="Lien invalide ou expiré")

    user_id = int(payload["sub"])
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user or not user.is_active:
        raise HTTPException(status_code=400, detail="Lien invalide ou expiré")

    # Compte à privilèges → exigence renforcée (le schéma a déjà validé la base)
    if user.is_superadmin:
        try:
            validate_password_strength(data.new_password, privileged=True)
        except PasswordPolicyError as e:
            raise HTTPException(status_code=400, detail=str(e))

    user.hashed_password = hash_password(data.new_password)
    user.must_change_password = False
    await db.flush()

    ip = _client_ip(request)
    now = datetime.now(timezone.utc).isoformat(timespec="seconds")
    db.add(AuditLog(
        entity_type="auth", entity_id=user.id, action="PASSWORD_RESET",
        changes=f'{{"ip":"{ip}","via":"email"}}',
        user=user.username, timestamp=now,
    ))

    return {"detail": "Mot de passe réinitialisé avec succès"}


@router.get("/me", response_model=UserMe)
async def me(user: User = Depends(get_current_user)):
    """Profil de l'utilisateur connecté avec permissions aplaties / Current user profile with flat permissions."""
    if user.is_superadmin:
        permissions = ["*:*"]
    else:
        permissions = sorted(set(f"{p.resource}:{p.action}" for role in user.roles for p in role.permissions))

    return UserMe(
        id=user.id,
        username=user.username,
        email=user.email,
        is_superadmin=user.is_superadmin,
        must_change_password=bool(user.must_change_password),
        pdv_id=user.pdv_id,
        supplier_id=user.supplier_id,
        badge_code=user.badge_code,
        default_route=user.default_route,
        roles=user.roles,
        regions=user.regions,
        permissions=permissions,
    )
