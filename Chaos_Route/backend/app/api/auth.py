"""
Routes d'authentification / Authentication routes.
Login, refresh token, profil utilisateur.
"""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status

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

router = APIRouter()


def _client_ip(request: Request) -> str:
    """Extraire l'IP client / Extract client IP (supports X-Forwarded-For behind proxy)."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


@router.post("/login", response_model=TokenResponse)
@limiter.limit(settings.RATE_LIMIT_LOGIN)
async def login(request: Request, data: LoginRequest, db: AsyncSession = Depends(get_db)):
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

    return TokenResponse(
        access_token=create_access_token(user.id),
        refresh_token=create_refresh_token(user.id),
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh(data: RefreshRequest, db: AsyncSession = Depends(get_db)):
    """Rafraîchir les tokens / Refresh tokens."""
    payload = decode_token(data.refresh_token)
    if payload is None or payload.get("type") != "refresh":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

    user_id = int(payload["sub"])
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if user is None or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found or inactive")

    return TokenResponse(
        access_token=create_access_token(user.id),
        refresh_token=create_refresh_token(user.id),
    )


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

    user.hashed_password = hash_password(data.new_password)
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

    user.hashed_password = hash_password(data.new_password)
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
        pdv_id=user.pdv_id,
        badge_code=user.badge_code,
        roles=user.roles,
        regions=user.regions,
        permissions=permissions,
    )
