"""Routes Distancier enrichi / Enriched distance matrix API routes."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.base_logistics import BaseLogistics
from app.models.distance_matrix import DistanceMatrix
from app.models.pdv import PDV
from app.models.user import User
from app.schemas.distance_matrix import DistanceMatrixCreate, DistanceMatrixRead, DistanceMatrixUpdate
from app.api.deps import require_permission

router = APIRouter()


async def _build_label_caches(db: AsyncSession) -> tuple[dict[int, str], dict[int, str]]:
    """Construire caches de labels / Build label caches for BASE and PDV."""
    base_result = await db.execute(select(BaseLogistics.id, BaseLogistics.code, BaseLogistics.name))
    base_labels = {row[0]: f"{row[1]} — {row[2]}" for row in base_result.all()}

    pdv_result = await db.execute(select(PDV.id, PDV.code, PDV.name))
    pdv_labels = {row[0]: f"{row[1]} — {row[2]}" for row in pdv_result.all()}

    return base_labels, pdv_labels


def _resolve_label(entry_type: str, entry_id: int, base_labels: dict, pdv_labels: dict) -> str | None:
    """Résoudre un label depuis le type et l'ID / Resolve a label from type and ID."""
    if entry_type == "BASE":
        return base_labels.get(entry_id)
    elif entry_type == "PDV":
        return pdv_labels.get(entry_id)
    return None


@router.get("/", response_model=list[DistanceMatrixRead])
async def list_distances(
    origin_type: str | None = None,
    origin_id: int | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("distances", "read")),
):
    query = select(DistanceMatrix)
    if origin_type is not None:
        query = query.where(DistanceMatrix.origin_type == origin_type)
    if origin_id is not None:
        query = query.where(DistanceMatrix.origin_id == origin_id)
    result = await db.execute(query)
    entries = result.scalars().all()

    base_labels, pdv_labels = await _build_label_caches(db)
    enriched = []
    for e in entries:
        data = DistanceMatrixRead.model_validate(e)
        data.origin_label = _resolve_label(e.origin_type, e.origin_id, base_labels, pdv_labels)
        data.destination_label = _resolve_label(e.destination_type, e.destination_id, base_labels, pdv_labels)
        enriched.append(data)

    return enriched


@router.get("/lookup")
async def lookup_distance(
    origin_type: str,
    origin_id: int,
    destination_type: str,
    destination_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("distances", "read")),
):
    """Chercher la distance entre deux points / Look up distance between two points."""
    result = await db.execute(
        select(DistanceMatrix).where(
            DistanceMatrix.origin_type == origin_type,
            DistanceMatrix.origin_id == origin_id,
            DistanceMatrix.destination_type == destination_type,
            DistanceMatrix.destination_id == destination_id,
        )
    )
    entry = result.scalar_one_or_none()
    if not entry:
        raise HTTPException(status_code=404, detail="Distance entry not found")
    return entry


@router.post("/", response_model=DistanceMatrixRead, status_code=201)
async def create_distance(
    data: DistanceMatrixCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("distances", "create")),
):
    entry = DistanceMatrix(**data.model_dump())
    db.add(entry)
    await db.flush()
    await db.refresh(entry)
    return entry


@router.post("/bulk", response_model=list[DistanceMatrixRead], status_code=201)
async def create_distances_bulk(
    data: list[DistanceMatrixCreate],
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("distances", "create")),
):
    """Import en masse du distancier / Bulk import distance matrix entries."""
    entries = []
    for item in data:
        entry = DistanceMatrix(**item.model_dump())
        db.add(entry)
        entries.append(entry)
    await db.flush()
    for entry in entries:
        await db.refresh(entry)
    return entries


@router.delete("/{entry_id}", status_code=204)
async def delete_distance(
    entry_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("distances", "delete")),
):
    entry = await db.get(DistanceMatrix, entry_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Distance entry not found")
    await db.delete(entry)
