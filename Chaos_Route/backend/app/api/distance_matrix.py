"""Routes Distancier / Distance matrix API routes."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.distance_matrix import DistanceMatrix
from app.schemas.distance_matrix import DistanceMatrixCreate, DistanceMatrixRead, DistanceMatrixUpdate

router = APIRouter()


@router.get("/", response_model=list[DistanceMatrixRead])
async def list_distances(
    origin_type: str | None = None,
    origin_id: int | None = None,
    db: AsyncSession = Depends(get_db),
):
    query = select(DistanceMatrix)
    if origin_type is not None:
        query = query.where(DistanceMatrix.origin_type == origin_type)
    if origin_id is not None:
        query = query.where(DistanceMatrix.origin_id == origin_id)
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/lookup")
async def lookup_distance(
    origin_type: str,
    origin_id: int,
    destination_type: str,
    destination_id: int,
    db: AsyncSession = Depends(get_db),
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
async def create_distance(data: DistanceMatrixCreate, db: AsyncSession = Depends(get_db)):
    entry = DistanceMatrix(**data.model_dump())
    db.add(entry)
    await db.flush()
    await db.refresh(entry)
    return entry


@router.post("/bulk", response_model=list[DistanceMatrixRead], status_code=201)
async def create_distances_bulk(data: list[DistanceMatrixCreate], db: AsyncSession = Depends(get_db)):
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
async def delete_distance(entry_id: int, db: AsyncSession = Depends(get_db)):
    entry = await db.get(DistanceMatrix, entry_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Distance entry not found")
    await db.delete(entry)
