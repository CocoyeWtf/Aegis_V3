"""API stock contenants PDV / PDV container stock API.
Consultation du stock, historique des inventaires, PUO (stock autorisé) et rapport dépassements.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.pdv import PDV
from app.models.support_type import SupportType
from app.models.pdv_inventory import PdvInventory, PdvStock
from app.models.user import User
from app.schemas.inventory import (
    PdvStockDetail, PdvInventoryRead,
    PuoUpdate, PuoBulkUpdate,
    PuoOverageItem, PuoOverageReport,
)
from app.api.deps import require_permission, enforce_pdv_scope

router = APIRouter()


@router.get("/", response_model=list[PdvStockDetail])
async def list_stocks(
    pdv_id: int | None = None,
    support_type_id: int | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("pdv-stock", "read")),
):
    """Liste des stocks courants / List current stocks."""
    pdv_id = enforce_pdv_scope(user, pdv_id)

    query = (
        select(PdvStock, PDV.code, PDV.name, SupportType.code, SupportType.name, SupportType.unit_value)
        .join(PDV, PdvStock.pdv_id == PDV.id)
        .join(SupportType, PdvStock.support_type_id == SupportType.id)
    )
    if pdv_id:
        query = query.where(PdvStock.pdv_id == pdv_id)
    if support_type_id:
        query = query.where(PdvStock.support_type_id == support_type_id)
    query = query.order_by(PDV.code, SupportType.code)

    result = await db.execute(query)
    rows = result.all()

    return [
        PdvStockDetail(
            pdv_id=stock.pdv_id,
            pdv_code=pdv_code,
            pdv_name=pdv_name,
            support_type_id=stock.support_type_id,
            support_type_code=st_code,
            support_type_name=st_name,
            current_stock=stock.current_stock,
            puo=stock.puo,
            unit_value=float(unit_value) if unit_value else None,
            last_inventory_at=stock.last_inventory_at,
            last_inventoried_by=stock.last_inventoried_by,
        )
        for stock, pdv_code, pdv_name, st_code, st_name, unit_value in rows
    ]


@router.get("/history/", response_model=list[PdvInventoryRead])
async def inventory_history(
    pdv_id: int | None = None,
    limit: int = Query(100, le=500),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("pdv-stock", "read")),
):
    """Historique des inventaires / Inventory history."""
    pdv_id = enforce_pdv_scope(user, pdv_id)

    query = select(PdvInventory).order_by(PdvInventory.inventoried_at.desc())
    if pdv_id:
        query = query.where(PdvInventory.pdv_id == pdv_id)
    query = query.limit(limit)

    result = await db.execute(query)
    return result.scalars().all()


# ─── PUO (Parc Unités autorisé) ───


@router.put("/puo/", status_code=200)
async def update_puo(
    data: PuoUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("pdv-stock", "update")),
):
    """Mettre à jour le PUO d'un couple PDV × type / Update PUO for a PDV × support type pair."""
    result = await db.execute(
        select(PdvStock).where(
            and_(PdvStock.pdv_id == data.pdv_id, PdvStock.support_type_id == data.support_type_id)
        )
    )
    stock = result.scalar_one_or_none()
    if not stock:
        # Créer l'entrée si elle n'existe pas / Create entry if it doesn't exist
        stock = PdvStock(
            pdv_id=data.pdv_id,
            support_type_id=data.support_type_id,
            current_stock=0,
            puo=data.puo,
        )
        db.add(stock)
    else:
        stock.puo = data.puo
    await db.flush()
    return {"ok": True, "pdv_id": data.pdv_id, "support_type_id": data.support_type_id, "puo": data.puo}


@router.put("/puo/bulk/", status_code=200)
async def bulk_update_puo(
    data: PuoBulkUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("pdv-stock", "update")),
):
    """Mise à jour en masse des PUO / Bulk PUO update."""
    updated = 0
    created = 0
    for item in data.updates:
        result = await db.execute(
            select(PdvStock).where(
                and_(PdvStock.pdv_id == item.pdv_id, PdvStock.support_type_id == item.support_type_id)
            )
        )
        stock = result.scalar_one_or_none()
        if stock:
            stock.puo = item.puo
            updated += 1
        else:
            db.add(PdvStock(
                pdv_id=item.pdv_id, support_type_id=item.support_type_id,
                current_stock=0, puo=item.puo,
            ))
            created += 1
    await db.flush()
    return {"ok": True, "updated": updated, "created": created}


@router.get("/puo/overages/", response_model=PuoOverageReport)
async def puo_overages(
    support_type_id: int | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("pdv-stock", "read")),
):
    """Rapport dépassements PUO / PUO overage report.
    Retourne tous les PDV dont le stock dépasse le PUO autorisé.
    """
    query = (
        select(PdvStock, PDV.code, PDV.name, SupportType.code, SupportType.name, SupportType.unit_value)
        .join(PDV, PdvStock.pdv_id == PDV.id)
        .join(SupportType, PdvStock.support_type_id == SupportType.id)
        .where(PdvStock.puo.isnot(None))
        .where(PdvStock.current_stock > PdvStock.puo)
    )
    if support_type_id:
        query = query.where(PdvStock.support_type_id == support_type_id)
    query = query.order_by((PdvStock.current_stock - PdvStock.puo).desc())

    result = await db.execute(query)
    rows = result.all()

    items: list[PuoOverageItem] = []
    total_units = 0
    total_value = 0.0

    for stock, pdv_code, pdv_name, st_code, st_name, unit_value in rows:
        overage = stock.current_stock - stock.puo
        uv = float(unit_value) if unit_value else 0.0
        overage_val = overage * uv
        items.append(PuoOverageItem(
            pdv_id=stock.pdv_id, pdv_code=pdv_code, pdv_name=pdv_name,
            support_type_id=stock.support_type_id, support_type_code=st_code,
            support_type_name=st_name,
            current_stock=stock.current_stock, puo=stock.puo,
            overage=overage, unit_value=uv, overage_value=overage_val,
        ))
        total_units += overage
        total_value += overage_val

    pdv_ids = set(i.pdv_id for i in items)
    return PuoOverageReport(
        items=items,
        total_overage_units=total_units,
        total_overage_value=total_value,
        pdv_count=len(pdv_ids),
    )
