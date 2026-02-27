"""
Dépendances d'authentification et d'autorisation / Authentication and authorization dependencies.
Injectées dans les routes via Depends().
"""

from datetime import datetime, timezone

from fastapi import Depends, Header, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.device_assignment import DeviceAssignment
from app.models.mobile_device import MobileDevice
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


async def get_authenticated_device(
    x_device_id: str = Header(..., alias="X-Device-ID"),
    x_app_version: str | None = Header(None, alias="X-App-Version"),
    x_os_version: str | None = Header(None, alias="X-OS-Version"),
    db: AsyncSession = Depends(get_db),
) -> MobileDevice:
    """Authentifier un appareil mobile via son UUID / Authenticate a mobile device via its UUID.

    Le telephone envoie son device_identifier dans le header X-Device-ID.
    Met a jour automatiquement app_version, os_version, last_seen_at.
    """
    if not x_device_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing X-Device-ID header")

    result = await db.execute(
        select(MobileDevice).where(MobileDevice.device_identifier == x_device_id)
    )
    device = result.scalar_one_or_none()

    if device is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unknown device")
    if not device.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Device deactivated")

    # Auto-update tracabilite / Auto-update traceability fields
    now = datetime.now(timezone.utc).isoformat(timespec="seconds")
    device.last_seen_at = now
    if x_app_version:
        device.app_version = x_app_version
    if x_os_version:
        device.os_version = x_os_version

    return device


async def require_device_tour_access(
    tour_id: int,
    device: MobileDevice = Depends(get_authenticated_device),
    db: AsyncSession = Depends(get_db),
) -> MobileDevice:
    """Vérifier que l'appareil est assigné au tour / Verify device is assigned to the tour."""
    result = await db.execute(
        select(DeviceAssignment).where(
            DeviceAssignment.tour_id == tour_id,
            DeviceAssignment.device_id == device.id,
        ).limit(1)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Device not assigned to this tour")
    return device


def get_user_region_ids(user: User) -> list[int] | None:
    """Retourne les IDs de régions de l'utilisateur / Returns user's region IDs.

    None = pas de filtre (superadmin ou aucune région assignée) / no filter (superadmin or no regions assigned).
    """
    if user.is_superadmin:
        return None
    if not user.regions:
        return None
    return [r.id for r in user.regions]
