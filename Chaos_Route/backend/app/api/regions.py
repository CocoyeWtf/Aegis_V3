"""Routes Régions / Region API routes."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.region import Region
from app.models.user import User
from app.schemas.region import RegionCreate, RegionRead, RegionUpdate
from app.api.deps import require_permission, get_user_region_ids

router = APIRouter()


@router.get("/", response_model=list[RegionRead])
async def list_regions(
    country_id: int | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("countries", "read")),
):
    """Lister les régions, optionnellement filtrées par pays / List regions, optionally filtered by country."""
    query = select(Region)
    if country_id is not None:
        query = query.where(Region.country_id == country_id)
    region_ids = get_user_region_ids(user)
    if region_ids is not None:
        query = query.where(Region.id.in_(region_ids))
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/{region_id}", response_model=RegionRead)
async def get_region(
    region_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("countries", "read")),
):
    region = await db.get(Region, region_id)
    if not region:
        raise HTTPException(status_code=404, detail="Region not found")
    return region


@router.post("/", response_model=RegionRead, status_code=201)
async def create_region(
    data: RegionCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("countries", "create")),
):
    region = Region(**data.model_dump())
    db.add(region)
    await db.flush()
    await db.refresh(region)
    return region


@router.put("/{region_id}", response_model=RegionRead)
async def update_region(
    region_id: int,
    data: RegionUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("countries", "update")),
):
    region = await db.get(Region, region_id)
    if not region:
        raise HTTPException(status_code=404, detail="Region not found")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(region, key, value)
    await db.flush()
    await db.refresh(region)
    return region


@router.delete("/{region_id}", status_code=204)
async def delete_region(
    region_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("countries", "delete")),
):
    region = await db.get(Region, region_id)
    if not region:
        raise HTTPException(status_code=404, detail="Region not found")
    await db.delete(region)
