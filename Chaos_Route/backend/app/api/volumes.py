"""Routes Volumes / Volume API routes."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.pdv import PDV
from app.models.volume import Volume
from app.models.user import User
from app.schemas.volume import VolumeCreate, VolumeRead, VolumeSplit, VolumeUpdate
from app.api.deps import require_permission, get_user_region_ids

router = APIRouter()


@router.get("/", response_model=list[VolumeRead])
async def list_volumes(
    pdv_id: int | None = None,
    date: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    base_origin_id: int | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("volumes", "read")),
):
    """Lister les volumes, avec filtres optionnels / List volumes with optional filters."""
    query = select(Volume)
    if pdv_id is not None:
        query = query.where(Volume.pdv_id == pdv_id)
    if date is not None:
        query = query.where(Volume.date == date)
    if date_from is not None:
        query = query.where(Volume.date >= date_from)
    if date_to is not None:
        query = query.where(Volume.date <= date_to)
    if base_origin_id is not None:
        query = query.where(Volume.base_origin_id == base_origin_id)
    # Scope région via PDV / Region scope via PDV join
    user_region_ids = get_user_region_ids(user)
    if user_region_ids is not None:
        query = query.join(PDV, Volume.pdv_id == PDV.id).where(PDV.region_id.in_(user_region_ids))
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/{volume_id}", response_model=VolumeRead)
async def get_volume(
    volume_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("volumes", "read")),
):
    volume = await db.get(Volume, volume_id)
    if not volume:
        raise HTTPException(status_code=404, detail="Volume not found")
    return volume


@router.post("/", response_model=VolumeRead, status_code=201)
async def create_volume(
    data: VolumeCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("volumes", "create")),
):
    volume = Volume(**data.model_dump())
    db.add(volume)
    await db.flush()
    await db.refresh(volume)
    return volume


@router.put("/{volume_id}", response_model=VolumeRead)
async def update_volume(
    volume_id: int,
    data: VolumeUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("volumes", "update")),
):
    volume = await db.get(Volume, volume_id)
    if not volume:
        raise HTTPException(status_code=404, detail="Volume not found")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(volume, key, value)
    await db.flush()
    await db.refresh(volume)
    return volume


@router.post("/{volume_id}/split", response_model=list[VolumeRead])
async def split_volume(
    volume_id: int,
    data: VolumeSplit,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("volumes", "update")),
):
    """Scinder un volume en deux / Split a volume into two parts."""
    volume = await db.get(Volume, volume_id)
    if not volume:
        raise HTTPException(status_code=404, detail="Volume not found")
    if data.eqp_count <= 0 or data.eqp_count >= volume.eqp_count:
        raise HTTPException(status_code=400, detail="eqp_count must be between 1 and volume.eqp_count - 1")

    remainder = volume.eqp_count - data.eqp_count
    original_weight = float(volume.weight_kg) if volume.weight_kg else 0
    original_colis = volume.nb_colis or 0
    ratio = data.eqp_count / volume.eqp_count

    # Groupe de split — tous les fragments partagent le même ID / Split group tracking
    group_id = volume.split_group_id or volume.id
    volume.split_group_id = group_id

    volume.eqp_count = data.eqp_count
    volume.weight_kg = round(original_weight * ratio, 2) if original_weight else None
    volume.nb_colis = round(original_colis * ratio) if original_colis else None

    new_vol = Volume(
        pdv_id=volume.pdv_id,
        date=volume.date,
        nb_colis=round(original_colis * (1 - ratio)) if original_colis else None,
        eqp_count=remainder,
        weight_kg=round(original_weight * (1 - ratio), 2) if original_weight else None,
        temperature_class=volume.temperature_class,
        base_origin_id=volume.base_origin_id,
        preparation_start=volume.preparation_start,
        preparation_end=volume.preparation_end,
        dispatch_date=volume.dispatch_date,
        dispatch_time=volume.dispatch_time,
        tour_id=None,
        split_group_id=group_id,
    )
    db.add(new_vol)
    await db.flush()
    await db.refresh(volume)
    await db.refresh(new_vol)
    return [volume, new_vol]


@router.delete("/{volume_id}", status_code=204)
async def delete_volume(
    volume_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("volumes", "delete")),
):
    volume = await db.get(Volume, volume_id)
    if not volume:
        raise HTTPException(status_code=404, detail="Volume not found")
    await db.delete(volume)
