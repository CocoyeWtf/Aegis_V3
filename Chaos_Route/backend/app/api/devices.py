"""Routes CRUD appareils mobiles / Mobile device CRUD routes."""

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request

from app.config import settings
from app.rate_limit import limiter
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.mobile_device import MobileDevice
from app.models.user import User
from app.schemas.mobile import MobileDeviceCreate, MobileDeviceRead, MobileDeviceUpdate, DeviceRegistration
from app.api.deps import require_permission

router = APIRouter()


@router.post("/", response_model=MobileDeviceRead, status_code=201)
async def create_device(
    data: MobileDeviceCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("devices", "create")),
):
    """Creer un appareil (auto-genere registration_code UUID) / Create a device.
    device_identifier laisse vide — sera rempli par le telephone lors de l'enregistrement QR.
    """
    device = MobileDevice(
        device_identifier=None,  # Rempli par le telephone / Filled by phone on registration
        friendly_name=data.friendly_name,
        base_id=data.base_id,
        registration_code=str(uuid.uuid4())[:8].upper(),
        is_active=True,
        registered_at=None,  # Sera set lors de l'enregistrement QR
    )
    db.add(device)
    await db.flush()
    return device


@router.get("/", response_model=list[MobileDeviceRead])
async def list_devices(
    base_id: int | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("devices", "read")),
):
    """Lister les appareils (filtre base_id) / List devices."""
    query = select(MobileDevice)
    if base_id is not None:
        query = query.where(MobileDevice.base_id == base_id)
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/{device_id}", response_model=MobileDeviceRead)
async def get_device(
    device_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("devices", "read")),
):
    device = await db.get(MobileDevice, device_id)
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    return device


@router.put("/{device_id}", response_model=MobileDeviceRead)
async def update_device(
    device_id: int,
    data: MobileDeviceUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("devices", "update")),
):
    device = await db.get(MobileDevice, device_id)
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    changes = data.model_dump(exclude_unset=True)
    for key, value in changes.items():
        setattr(device, key, value)
    await db.flush()
    return device


@router.delete("/{device_id}", status_code=204)
async def delete_device(
    device_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("devices", "delete")),
):
    """Desactiver un appareil (soft delete) / Deactivate a device."""
    device = await db.get(MobileDevice, device_id)
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    device.is_active = False
    await db.flush()


@router.post("/register", response_model=MobileDeviceRead)
@limiter.limit(settings.RATE_LIMIT_REGISTER)
async def register_device(
    request: Request,
    data: DeviceRegistration,
    db: AsyncSession = Depends(get_db),
):
    """Enregistrement mobile (registration_code + device_identifier) / Mobile registration.
    Public endpoint — le telephone presente son QR pour s'enregistrer.
    """
    result = await db.execute(
        select(MobileDevice).where(MobileDevice.registration_code == data.registration_code)
    )
    device = result.scalar_one_or_none()
    if not device:
        raise HTTPException(status_code=404, detail="Invalid registration code")
    if not device.is_active:
        raise HTTPException(status_code=400, detail="Device is deactivated")
    # Mettre a jour l'identifiant physique / Update the physical identifier
    device.device_identifier = data.device_identifier
    device.registered_at = datetime.now(timezone.utc).isoformat(timespec="seconds")
    await db.flush()
    return device
