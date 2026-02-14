"""Routes Tournées / Tour API routes."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.tour import Tour
from app.models.tour_stop import TourStop
from app.schemas.tour import TourCreate, TourRead, TourUpdate

router = APIRouter()


@router.get("/", response_model=list[TourRead])
async def list_tours(
    date: str | None = None,
    base_id: int | None = None,
    status: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    """Lister les tours avec filtres / List tours with filters."""
    query = select(Tour).options(selectinload(Tour.stops))
    if date is not None:
        query = query.where(Tour.date == date)
    if base_id is not None:
        query = query.where(Tour.base_id == base_id)
    if status is not None:
        query = query.where(Tour.status == status)
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/{tour_id}", response_model=TourRead)
async def get_tour(tour_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Tour).where(Tour.id == tour_id).options(selectinload(Tour.stops))
    )
    tour = result.scalar_one_or_none()
    if not tour:
        raise HTTPException(status_code=404, detail="Tour not found")
    return tour


@router.post("/", response_model=TourRead, status_code=201)
async def create_tour(data: TourCreate, db: AsyncSession = Depends(get_db)):
    """Créer un tour avec ses arrêts / Create a tour with its stops."""
    tour_data = data.model_dump(exclude={"stops"})
    tour = Tour(**tour_data)
    db.add(tour)
    await db.flush()

    for stop_data in data.stops:
        stop = TourStop(**stop_data.model_dump(), tour_id=tour.id)
        db.add(stop)

    await db.flush()
    # Recharger avec les stops / Reload with stops
    result = await db.execute(
        select(Tour).where(Tour.id == tour.id).options(selectinload(Tour.stops))
    )
    return result.scalar_one()


@router.put("/{tour_id}", response_model=TourRead)
async def update_tour(tour_id: int, data: TourUpdate, db: AsyncSession = Depends(get_db)):
    tour = await db.get(Tour, tour_id)
    if not tour:
        raise HTTPException(status_code=404, detail="Tour not found")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(tour, key, value)
    await db.flush()
    result = await db.execute(
        select(Tour).where(Tour.id == tour.id).options(selectinload(Tour.stops))
    )
    return result.scalar_one()


@router.delete("/{tour_id}", status_code=204)
async def delete_tour(tour_id: int, db: AsyncSession = Depends(get_db)):
    tour = await db.get(Tour, tour_id)
    if not tour:
        raise HTTPException(status_code=404, detail="Tour not found")
    await db.delete(tour)
