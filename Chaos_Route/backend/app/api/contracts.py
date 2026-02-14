"""Routes Contrats / Contract API routes."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.contract import Contract
from app.schemas.contract import ContractCreate, ContractRead, ContractUpdate

router = APIRouter()


@router.get("/", response_model=list[ContractRead])
async def list_contracts(region_id: int | None = None, db: AsyncSession = Depends(get_db)):
    query = select(Contract)
    if region_id is not None:
        query = query.where(Contract.region_id == region_id)
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/{contract_id}", response_model=ContractRead)
async def get_contract(contract_id: int, db: AsyncSession = Depends(get_db)):
    contract = await db.get(Contract, contract_id)
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")
    return contract


@router.post("/", response_model=ContractRead, status_code=201)
async def create_contract(data: ContractCreate, db: AsyncSession = Depends(get_db)):
    contract = Contract(**data.model_dump())
    db.add(contract)
    await db.flush()
    await db.refresh(contract)
    return contract


@router.put("/{contract_id}", response_model=ContractRead)
async def update_contract(contract_id: int, data: ContractUpdate, db: AsyncSession = Depends(get_db)):
    contract = await db.get(Contract, contract_id)
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(contract, key, value)
    await db.flush()
    await db.refresh(contract)
    return contract


@router.delete("/{contract_id}", status_code=204)
async def delete_contract(contract_id: int, db: AsyncSession = Depends(get_db)):
    contract = await db.get(Contract, contract_id)
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")
    await db.delete(contract)
