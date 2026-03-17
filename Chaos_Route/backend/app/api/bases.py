"""Routes Bases Logistiques / Logistics Base API routes."""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.base_logistics import BaseLogistics
from app.models.base_activity import BaseActivity
from app.models.base_zone import BaseZone
from app.models.user import User
from app.schemas.base_logistics import BaseLogisticsCreate, BaseLogisticsRead, BaseLogisticsUpdate
from app.api.deps import require_permission, get_user_region_ids


# --- Schemas zones ---
class BaseZoneCreate(BaseModel):
    code: str
    name: str

class BaseZoneUpdate(BaseModel):
    code: str | None = None
    name: str | None = None
    is_active: bool | None = None

class BaseZoneRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    base_id: int
    code: str
    name: str
    is_active: bool

router = APIRouter()


@router.get("/", response_model=list[BaseLogisticsRead])
async def list_bases(
    region_id: int | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("bases", "read")),
):
    """Lister les bases logistiques / List logistics bases."""
    query = select(BaseLogistics)
    if region_id is not None:
        query = query.where(BaseLogistics.region_id == region_id)
    user_region_ids = get_user_region_ids(user)
    if user_region_ids is not None:
        query = query.where(BaseLogistics.region_id.in_(user_region_ids))
    result = await db.execute(query)
    return result.scalars().unique().all()


@router.get("/{base_id}", response_model=BaseLogisticsRead)
async def get_base(
    base_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("bases", "read")),
):
    base = await db.get(BaseLogistics, base_id)
    if not base:
        raise HTTPException(status_code=404, detail="Base not found")
    return base


@router.post("/", response_model=BaseLogisticsRead, status_code=201)
async def create_base(
    data: BaseLogisticsCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("bases", "create")),
):
    payload = data.model_dump(exclude={"activity_ids"})
    base = BaseLogistics(**payload)
    if data.activity_ids:
        result = await db.execute(select(BaseActivity).where(BaseActivity.id.in_(data.activity_ids)))
        base.activities = list(result.scalars().all())
    db.add(base)
    await db.flush()
    await db.refresh(base)
    return base


@router.put("/{base_id}", response_model=BaseLogisticsRead)
async def update_base(
    base_id: int,
    data: BaseLogisticsUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("bases", "update")),
):
    base = await db.get(BaseLogistics, base_id)
    if not base:
        raise HTTPException(status_code=404, detail="Base not found")
    update_data = data.model_dump(exclude_unset=True, exclude={"activity_ids"})
    for key, value in update_data.items():
        setattr(base, key, value)
    if data.activity_ids is not None:
        result = await db.execute(select(BaseActivity).where(BaseActivity.id.in_(data.activity_ids)))
        base.activities = list(result.scalars().all())
    await db.flush()
    await db.refresh(base)
    return base


@router.delete("/{base_id}", status_code=204)
async def delete_base(
    base_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("bases", "delete")),
):
    base = await db.get(BaseLogistics, base_id)
    if not base:
        raise HTTPException(status_code=404, detail="Base not found")
    await db.delete(base)


# ─── Zones de base / Base zones ───

@router.get("/{base_id}/zones/", response_model=list[BaseZoneRead])
async def list_zones(
    base_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("bases", "read")),
):
    """Lister les zones d'une base / List zones for a base."""
    result = await db.execute(
        select(BaseZone).where(BaseZone.base_id == base_id).order_by(BaseZone.code)
    )
    return result.scalars().all()


@router.post("/{base_id}/zones/", response_model=BaseZoneRead, status_code=201)
async def create_zone(
    base_id: int,
    data: BaseZoneCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("bases", "create")),
):
    """Creer une zone dans une base / Create a zone in a base."""
    base = await db.get(BaseLogistics, base_id)
    if not base:
        raise HTTPException(status_code=404, detail="Base not found")
    zone = BaseZone(base_id=base_id, code=data.code, name=data.name)
    db.add(zone)
    await db.flush()
    return zone


@router.put("/{base_id}/zones/{zone_id}", response_model=BaseZoneRead)
async def update_zone(
    base_id: int,
    zone_id: int,
    data: BaseZoneUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("bases", "update")),
):
    """Modifier une zone / Update a zone."""
    zone = await db.get(BaseZone, zone_id)
    if not zone or zone.base_id != base_id:
        raise HTTPException(status_code=404, detail="Zone not found")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(zone, key, value)
    await db.flush()
    return zone


@router.delete("/{base_id}/zones/{zone_id}", status_code=204)
async def delete_zone(
    base_id: int,
    zone_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("bases", "delete")),
):
    """Desactiver une zone / Deactivate a zone."""
    zone = await db.get(BaseZone, zone_id)
    if not zone or zone.base_id != base_id:
        raise HTTPException(status_code=404, detail="Zone not found")
    zone.is_active = False
    await db.flush()
