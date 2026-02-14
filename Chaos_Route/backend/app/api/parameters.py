"""Routes Paramètres / Parameter API routes."""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.parameter import Parameter

router = APIRouter()


class ParameterCreate(BaseModel):
    key: str
    value: str
    value_type: str = "string"
    region_id: int | None = None
    effective_date: str | None = None
    end_date: str | None = None


class ParameterRead(ParameterCreate):
    model_config = ConfigDict(from_attributes=True)
    id: int


@router.get("/", response_model=list[ParameterRead])
async def list_parameters(region_id: int | None = None, db: AsyncSession = Depends(get_db)):
    query = select(Parameter)
    if region_id is not None:
        query = query.where(Parameter.region_id == region_id)
    else:
        query = query.where(Parameter.region_id.is_(None))
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/{key}")
async def get_parameter(key: str, region_id: int | None = None, db: AsyncSession = Depends(get_db)):
    """Obtenir un paramètre par clé / Get parameter by key."""
    query = select(Parameter).where(Parameter.key == key)
    if region_id is not None:
        query = query.where(Parameter.region_id == region_id)
    else:
        query = query.where(Parameter.region_id.is_(None))
    result = await db.execute(query)
    param = result.scalar_one_or_none()
    if not param:
        raise HTTPException(status_code=404, detail="Parameter not found")
    return param


@router.post("/", response_model=ParameterRead, status_code=201)
async def create_parameter(data: ParameterCreate, db: AsyncSession = Depends(get_db)):
    param = Parameter(**data.model_dump())
    db.add(param)
    await db.flush()
    await db.refresh(param)
    return param


@router.put("/{param_id}", response_model=ParameterRead)
async def update_parameter(param_id: int, data: ParameterCreate, db: AsyncSession = Depends(get_db)):
    param = await db.get(Parameter, param_id)
    if not param:
        raise HTTPException(status_code=404, detail="Parameter not found")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(param, key, value)
    await db.flush()
    await db.refresh(param)
    return param


@router.delete("/{param_id}", status_code=204)
async def delete_parameter(param_id: int, db: AsyncSession = Depends(get_db)):
    param = await db.get(Parameter, param_id)
    if not param:
        raise HTTPException(status_code=404, detail="Parameter not found")
    await db.delete(param)
