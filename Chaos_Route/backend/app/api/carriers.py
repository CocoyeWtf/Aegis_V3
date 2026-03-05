"""Routes Transporteurs / Carrier API routes."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.carrier import Carrier
from app.models.user import User
from app.schemas.carrier import CarrierCreate, CarrierRead, CarrierUpdate
from app.api.deps import require_permission, get_user_region_ids

router = APIRouter()


@router.get("/", response_model=list[CarrierRead])
async def list_carriers(
    region_id: int | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("carriers", "read")),
):
    query = select(Carrier)
    if region_id is not None:
        query = query.where(Carrier.region_id == region_id)
    user_region_ids = get_user_region_ids(user)
    if user_region_ids is not None:
        query = query.where(Carrier.region_id.in_(user_region_ids))
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/{carrier_id}", response_model=CarrierRead)
async def get_carrier(
    carrier_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("carriers", "read")),
):
    carrier = await db.get(Carrier, carrier_id)
    if not carrier:
        raise HTTPException(status_code=404, detail="Carrier not found")
    return carrier


@router.post("/", response_model=CarrierRead, status_code=201)
async def create_carrier(
    data: CarrierCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("carriers", "create")),
):
    carrier = Carrier(**data.model_dump())
    db.add(carrier)
    await db.flush()
    await db.refresh(carrier)
    return carrier


@router.put("/{carrier_id}", response_model=CarrierRead)
async def update_carrier(
    carrier_id: int,
    data: CarrierUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("carriers", "update")),
):
    carrier = await db.get(Carrier, carrier_id)
    if not carrier:
        raise HTTPException(status_code=404, detail="Carrier not found")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(carrier, key, value)
    await db.flush()
    await db.refresh(carrier)
    return carrier


@router.delete("/{carrier_id}", status_code=204)
async def delete_carrier(
    carrier_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("carriers", "delete")),
):
    carrier = await db.get(Carrier, carrier_id)
    if not carrier:
        raise HTTPException(status_code=404, detail="Carrier not found")
    await db.delete(carrier)
