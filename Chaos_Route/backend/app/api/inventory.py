"""API stock contenants PDV / PDV container stock API.
Consultation du stock et historique des inventaires.
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.pdv import PDV
from app.models.support_type import SupportType
from app.models.pdv_inventory import PdvInventory, PdvStock
from app.models.user import User
from app.schemas.inventory import PdvStockDetail, PdvInventoryRead
from app.api.deps import require_permission

router = APIRouter()


@router.get("/", response_model=list[PdvStockDetail])
async def list_stocks(
    pdv_id: int | None = None,
    support_type_id: int | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("pdv-stock", "read")),
):
    """Liste des stocks courants / List current stocks."""
    query = (
        select(PdvStock, PDV.code, PDV.name, SupportType.code, SupportType.name)
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
            last_inventory_at=stock.last_inventory_at,
            last_inventoried_by=stock.last_inventoried_by,
        )
        for stock, pdv_code, pdv_name, st_code, st_name in rows
    ]


@router.get("/history/", response_model=list[PdvInventoryRead])
async def inventory_history(
    pdv_id: int | None = None,
    limit: int = Query(100, le=500),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("pdv-stock", "read")),
):
    """Historique des inventaires / Inventory history."""
    query = select(PdvInventory).order_by(PdvInventory.inventoried_at.desc())
    if pdv_id:
        query = query.where(PdvInventory.pdv_id == pdv_id)
    query = query.limit(limit)

    result = await db.execute(query)
    return result.scalars().all()
