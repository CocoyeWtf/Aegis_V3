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
from app.schemas.auth import LoginRequest, RefreshRequest, TokenResponse
from app.schemas.user import UserMe
from app.utils.auth import create_access_token, create_refresh_token, decode_token, verify_password
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
