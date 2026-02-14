"""Routes Volumes / Volume API routes."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.volume import Volume
from app.schemas.volume import VolumeCreate, VolumeRead, VolumeUpdate

router = APIRouter()


@router.get("/", response_model=list[VolumeRead])
async def list_volumes(
    pdv_id: int | None = None,
    date: str | None = None,
    base_origin_id: int | None = None,
    db: AsyncSession = Depends(get_db),
):
    """Lister les volumes, avec filtres optionnels / List volumes with optional filters."""
    query = select(Volume)
    if pdv_id is not None:
        query = query.where(Volume.pdv_id == pdv_id)
    if date is not None:
        query = query.where(Volume.date == date)
    if base_origin_id is not None:
        query = query.where(Volume.base_origin_id == base_origin_id)
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/{volume_id}", response_model=VolumeRead)
async def get_volume(volume_id: int, db: AsyncSession = Depends(get_db)):
    volume = await db.get(Volume, volume_id)
    if not volume:
        raise HTTPException(status_code=404, detail="Volume not found")
    return volume


@router.post("/", response_model=VolumeRead, status_code=201)
async def create_volume(data: VolumeCreate, db: AsyncSession = Depends(get_db)):
    volume = Volume(**data.model_dump())
    db.add(volume)
    await db.flush()
    await db.refresh(volume)
    return volume


@router.put("/{volume_id}", response_model=VolumeRead)
async def update_volume(volume_id: int, data: VolumeUpdate, db: AsyncSession = Depends(get_db)):
    volume = await db.get(Volume, volume_id)
    if not volume:
        raise HTTPException(status_code=404, detail="Volume not found")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(volume, key, value)
    await db.flush()
    await db.refresh(volume)
    return volume


@router.delete("/{volume_id}", status_code=204)
async def delete_volume(volume_id: int, db: AsyncSession = Depends(get_db)):
    volume = await db.get(Volume, volume_id)
    if not volume:
        raise HTTPException(status_code=404, detail="Volume not found")
    await db.delete(volume)
