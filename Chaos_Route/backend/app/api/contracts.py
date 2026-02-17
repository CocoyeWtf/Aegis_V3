"""Routes Contrats (fusionné véhicule) / Contract API routes (merged with vehicle)."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.base_logistics import BaseLogistics
from app.models.contract import Contract
from app.models.contract_schedule import ContractSchedule
from app.schemas.contract import (
    ContractCreate,
    ContractRead,
    ContractScheduleBase,
    ContractUpdate,
)

router = APIRouter()


@router.get("/", response_model=list[ContractRead])
async def list_contracts(region_id: int | None = None, db: AsyncSession = Depends(get_db)):
    query = select(Contract).options(selectinload(Contract.schedules))
    if region_id is not None:
        query = query.where(Contract.region_id == region_id)
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/available", response_model=list[ContractRead])
async def available_contracts(
    date: str = Query(...),
    base_id: int = Query(...),
    temperature_type: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
):
    """Contrats disponibles pour une date et base / Available contracts for a date and base."""
    # Trouver la région de la base / Find base region
    base = await db.get(BaseLogistics, base_id)
    if not base:
        raise HTTPException(status_code=404, detail="Base not found")

    query = (
        select(Contract)
        .options(selectinload(Contract.schedules))
        .where(Contract.region_id == base.region_id)
    )

    # Filtre validité tarifaire / Tariff validity filter
    query = query.where(
        (Contract.start_date.is_(None)) | (Contract.start_date <= date)
    ).where(
        (Contract.end_date.is_(None)) | (Contract.end_date >= date)
    )

    # Filtre température compatible / Temperature compatibility filter
    if temperature_type:
        from app.models.contract import TemperatureType
        compatible = {temperature_type}
        compatible.add("BI_TEMP")
        compatible.add("TRI_TEMP")
        query = query.where(
            (Contract.temperature_type.is_(None))
            | (Contract.temperature_type.in_([TemperatureType(t) for t in compatible if t in TemperatureType.__members__]))
        )

    result = await db.execute(query)
    contracts = result.scalars().all()

    # Filtrer par disponibilité à la date / Filter by date availability
    # Convention : dispo par défaut, sauf si exception is_available=false
    available = []
    for c in contracts:
        is_unavailable = any(
            s.date == date and not s.is_available for s in c.schedules
        )
        if not is_unavailable:
            available.append(c)

    return available


@router.get("/{contract_id}", response_model=ContractRead)
async def get_contract(contract_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Contract).where(Contract.id == contract_id).options(selectinload(Contract.schedules))
    )
    contract = result.scalar_one_or_none()
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")
    return contract


@router.post("/", response_model=ContractRead, status_code=201)
async def create_contract(data: ContractCreate, db: AsyncSession = Depends(get_db)):
    schedules_data = data.schedules
    contract_data = data.model_dump(exclude={"schedules"})
    contract = Contract(**contract_data)
    db.add(contract)
    await db.flush()

    for s in schedules_data:
        schedule = ContractSchedule(contract_id=contract.id, **s.model_dump())
        db.add(schedule)

    await db.flush()
    result = await db.execute(
        select(Contract).where(Contract.id == contract.id).options(selectinload(Contract.schedules))
    )
    return result.scalar_one()


@router.put("/{contract_id}", response_model=ContractRead)
async def update_contract(contract_id: int, data: ContractUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Contract).where(Contract.id == contract_id).options(selectinload(Contract.schedules))
    )
    contract = result.scalar_one_or_none()
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(contract, key, value)
    await db.flush()
    result = await db.execute(
        select(Contract).where(Contract.id == contract.id).options(selectinload(Contract.schedules))
    )
    return result.scalar_one()


@router.put("/{contract_id}/schedule", response_model=ContractRead)
async def update_schedule(
    contract_id: int,
    schedules: list[ContractScheduleBase],
    db: AsyncSession = Depends(get_db),
):
    """Mise à jour planning date-par-date / Update date-based schedule.

    Si is_available=true → supprimer l'exception (retour au défaut dispo).
    Si is_available=false → upsert l'exception.
    If is_available=true → delete the exception (back to default available).
    If is_available=false → upsert the exception.
    """
    result = await db.execute(
        select(Contract).where(Contract.id == contract_id).options(selectinload(Contract.schedules))
    )
    contract = result.scalar_one_or_none()
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")

    existing_by_date = {s.date: s for s in contract.schedules}

    for s in schedules:
        if s.is_available:
            # Supprimer l'exception si elle existe / Delete exception if it exists
            if s.date in existing_by_date:
                await db.delete(existing_by_date[s.date])
        else:
            # Upsert : créer ou mettre à jour / Upsert: create or update
            if s.date in existing_by_date:
                existing_by_date[s.date].is_available = False
            else:
                db.add(ContractSchedule(
                    contract_id=contract.id, date=s.date, is_available=False
                ))

    await db.flush()
    result = await db.execute(
        select(Contract).where(Contract.id == contract.id).options(selectinload(Contract.schedules))
    )
    return result.scalar_one()


@router.delete("/{contract_id}", status_code=204)
async def delete_contract(contract_id: int, db: AsyncSession = Depends(get_db)):
    contract = await db.get(Contract, contract_id)
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")
    await db.delete(contract)
