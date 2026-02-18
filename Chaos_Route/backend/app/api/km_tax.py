"""Routes Taxe au kilomètre / Km tax API routes (pattern distancier)."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.base_logistics import BaseLogistics
from app.models.km_tax import KmTax
from app.models.pdv import PDV
from app.models.user import User
from app.schemas.km_tax import KmTaxCreate, KmTaxRead, KmTaxUpdate
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


@router.get("/", response_model=list[KmTaxRead])
async def list_km_tax(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("distances", "read")),
):
    """Lister les taxes km avec labels enrichis / List km taxes with enriched labels."""
    result = await db.execute(select(KmTax))
    entries = result.scalars().all()

    base_labels, pdv_labels = await _build_label_caches(db)
    enriched = []
    for e in entries:
        data = KmTaxRead.model_validate(e)
        data.origin_label = _resolve_label(e.origin_type, e.origin_id, base_labels, pdv_labels)
        data.destination_label = _resolve_label(e.destination_type, e.destination_id, base_labels, pdv_labels)
        enriched.append(data)

    return enriched


@router.post("/", response_model=KmTaxRead, status_code=201)
async def create_km_tax(
    data: KmTaxCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("distances", "create")),
):
    """Créer une entrée de taxe km / Create a km tax entry."""
    entry = KmTax(**data.model_dump())
    db.add(entry)
    await db.flush()
    await db.refresh(entry)
    return entry


@router.post("/bulk", response_model=list[KmTaxRead], status_code=201)
async def create_km_tax_bulk(
    data: list[KmTaxCreate],
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("distances", "create")),
):
    """Import en masse des taxes km / Bulk import km tax entries."""
    entries = []
    for item in data:
        entry = KmTax(**item.model_dump())
        db.add(entry)
        entries.append(entry)
    await db.flush()
    for entry in entries:
        await db.refresh(entry)
    return entries


@router.put("/{entry_id}", response_model=KmTaxRead)
async def update_km_tax(
    entry_id: int,
    data: KmTaxUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("distances", "update")),
):
    """Modifier une entrée de taxe km / Update a km tax entry."""
    entry = await db.get(KmTax, entry_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Km tax entry not found")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(entry, key, value)
    await db.flush()
    await db.refresh(entry)
    return entry


@router.delete("/{entry_id}", status_code=204)
async def delete_km_tax(
    entry_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("distances", "delete")),
):
    """Supprimer une entrée de taxe km / Delete a km tax entry."""
    entry = await db.get(KmTax, entry_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Km tax entry not found")
    await db.delete(entry)
