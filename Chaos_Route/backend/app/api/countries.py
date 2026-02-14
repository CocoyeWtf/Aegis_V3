"""Routes Pays / Country API routes."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.country import Country
from app.schemas.country import CountryCreate, CountryRead, CountryUpdate

router = APIRouter()


@router.get("/", response_model=list[CountryRead])
async def list_countries(db: AsyncSession = Depends(get_db)):
    """Lister tous les pays / List all countries."""
    result = await db.execute(select(Country))
    return result.scalars().all()


@router.get("/{country_id}", response_model=CountryRead)
async def get_country(country_id: int, db: AsyncSession = Depends(get_db)):
    """Obtenir un pays par ID / Get country by ID."""
    country = await db.get(Country, country_id)
    if not country:
        raise HTTPException(status_code=404, detail="Country not found")
    return country


@router.post("/", response_model=CountryRead, status_code=201)
async def create_country(data: CountryCreate, db: AsyncSession = Depends(get_db)):
    """Créer un pays / Create a country."""
    country = Country(**data.model_dump())
    db.add(country)
    await db.flush()
    await db.refresh(country)
    return country


@router.put("/{country_id}", response_model=CountryRead)
async def update_country(country_id: int, data: CountryUpdate, db: AsyncSession = Depends(get_db)):
    """Modifier un pays / Update a country."""
    country = await db.get(Country, country_id)
    if not country:
        raise HTTPException(status_code=404, detail="Country not found")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(country, key, value)
    await db.flush()
    await db.refresh(country)
    return country


@router.delete("/{country_id}", status_code=204)
async def delete_country(country_id: int, db: AsyncSession = Depends(get_db)):
    """Supprimer un pays / Delete a country."""
    country = await db.get(Country, country_id)
    if not country:
        raise HTTPException(status_code=404, detail="Country not found")
    await db.delete(country)
