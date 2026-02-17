"""
Dépendances d'authentification et d'autorisation / Authentication and authorization dependencies.
Injectées dans les routes via Depends().
"""

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.utils.auth import decode_token

security = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Extraire et valider l'utilisateur depuis le JWT / Extract and validate user from JWT."""
    payload = decode_token(credentials.credentials)
    if payload is None or payload.get("type") != "access":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")

    user_id = int(payload["sub"])
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if user is None or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found or inactive")

    return user


def require_permission(resource: str, action: str):
    """Factory de dépendance qui vérifie une permission / Dependency factory that checks a permission.

    Superadmin bypass toutes les permissions / Superadmin bypasses all permissions.
    """

    async def _check(user: User = Depends(get_current_user)) -> User:
        if user.is_superadmin:
            return user

        for role in user.roles:
            for perm in role.permissions:
                if perm.resource == resource and perm.action == action:
                    return user

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Permission required: {resource}:{action}",
        )

    return _check


def get_user_region_ids(user: User) -> list[int] | None:
    """Retourne les IDs de régions de l'utilisateur / Returns user's region IDs.

    None = pas de filtre (superadmin ou aucune région assignée) / no filter (superadmin or no regions assigned).
    """
    if user.is_superadmin:
        return None
    if not user.regions:
        return None
    return [r.id for r in user.regions]
