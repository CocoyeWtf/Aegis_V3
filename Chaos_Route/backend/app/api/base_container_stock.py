"""Routes Stock contenants base / Base container stock API routes."""

import csv
import io
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.base_container_stock import BaseContainerStock, BaseContainerMovement, BaseMovementType
from app.models.base_logistics import BaseLogistics
from app.models.base_zone import BaseZone
from app.models.support_type import SupportType
from app.models.user import User
from app.api.deps import require_permission

router = APIRouter()


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# --- Schemas ---

class BaseStockRead(BaseModel):
    id: int
    base_id: int
    base_code: str
    base_name: str
    zone_id: int | None = None
    zone_name: str | None = None
    support_type_id: int
    support_type_code: str
    support_type_name: str
    unit_quantity: int
    unit_label: str | None
    current_stock: int
    last_updated_at: str | None


class BaseStockAdjust(BaseModel):
    base_id: int
    support_type_id: int
    quantity: int  # nombre d'UNITES individuelles (palettes, bacs)
    movement_type: str  # DELIVERY_PREP | SUPPLIER_RETURN
    reference: str | None = None
    notes: str | None = None


class BaseStockInventory(BaseModel):
    base_id: int
    zone_id: int | None = None
    lines: list[dict]  # [{support_type_id: int, quantity: int}]


class BaseMovementRead(BaseModel):
    id: int
    base_id: int
    base_name: str
    zone_id: int | None = None
    zone_name: str | None = None
    support_type_id: int
    support_type_code: str
    support_type_name: str
    movement_type: str
    inventory_type: str | None = None
    quantity: int
    reference: str | None
    timestamp: str
    notes: str | None


# --- Endpoints ---

@router.get("/", response_model=list[BaseStockRead])
async def list_base_stocks(
    base_id: int | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("base-container-stock", "read")),
):
    """Stock contenants par base / Container stock by base."""
    query = (
        select(
            BaseContainerStock.id,
            BaseContainerStock.base_id,
            BaseLogistics.code.label("base_code"),
            BaseLogistics.name.label("base_name"),
            BaseContainerStock.zone_id,
            BaseZone.name.label("zone_name"),
            BaseContainerStock.support_type_id,
            SupportType.code.label("support_type_code"),
            SupportType.name.label("support_type_name"),
            SupportType.unit_quantity,
            SupportType.unit_label,
            BaseContainerStock.current_stock,
            BaseContainerStock.last_updated_at,
        )
        .join(BaseLogistics, BaseContainerStock.base_id == BaseLogistics.id)
        .join(SupportType, BaseContainerStock.support_type_id == SupportType.id)
        .outerjoin(BaseZone, BaseContainerStock.zone_id == BaseZone.id)
        .order_by(BaseLogistics.name, BaseZone.name, SupportType.name)
    )
    if base_id is not None:
        query = query.where(BaseContainerStock.base_id == base_id)

    result = await db.execute(query)
    return [BaseStockRead(**dict(row._mapping)) for row in result.all()]


@router.post("/inventory")
async def base_inventory(
    data: BaseStockInventory,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("base-container-stock", "update")),
):
    """Inventaire physique base / Physical base inventory."""
    base = await db.get(BaseLogistics, data.base_id)
    if not base:
        raise HTTPException(status_code=404, detail="Base not found")

    now = _now_iso()
    updated = 0

    for line in data.lines:
        st_id = line.get("support_type_id")
        qty = line.get("quantity", 0)
        if st_id is None:
            continue

        # Trouver ou creer le stock / Find or create stock
        result = await db.execute(
            select(BaseContainerStock).where(
                BaseContainerStock.base_id == data.base_id,
                BaseContainerStock.zone_id == data.zone_id,
                BaseContainerStock.support_type_id == st_id,
            )
        )
        stock = result.scalar_one_or_none()
        old_qty = stock.current_stock if stock else 0

        if stock:
            stock.current_stock = qty
            stock.last_updated_at = now
        else:
            stock = BaseContainerStock(
                base_id=data.base_id,
                zone_id=data.zone_id,
                support_type_id=st_id,
                current_stock=qty,
                last_updated_at=now,
            )
            db.add(stock)

        # Mouvement d'ajustement inventaire / Inventory adjustment movement
        delta = qty - old_qty
        if delta != 0:
            db.add(BaseContainerMovement(
                base_id=data.base_id,
                support_type_id=st_id,
                movement_type=BaseMovementType.INVENTORY_ADJUSTMENT,
                quantity=delta,
                reference=f"Inventaire physique ({old_qty} → {qty})",
                timestamp=now,
                user_id=user.id,
            ))
        updated += 1

    await db.flush()
    return {"status": "ok", "updated": updated}


@router.post("/adjust")
async def adjust_base_stock(
    data: BaseStockAdjust,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("base-container-stock", "update")),
):
    """Ajuster stock base (sortie preparation / retour fournisseur) / Adjust base stock."""
    # Valider le type de mouvement / Validate movement type
    try:
        mvt_type = BaseMovementType(data.movement_type)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid movement_type: {data.movement_type}")

    if mvt_type not in (BaseMovementType.DELIVERY_PREP, BaseMovementType.SUPPLIER_RETURN):
        raise HTTPException(status_code=400, detail="Use DELIVERY_PREP or SUPPLIER_RETURN")

    # Trouver le stock / Find stock
    result = await db.execute(
        select(BaseContainerStock).where(
            BaseContainerStock.base_id == data.base_id,
            BaseContainerStock.support_type_id == data.support_type_id,
        )
    )
    stock = result.scalar_one_or_none()
    if not stock:
        raise HTTPException(status_code=404, detail="Pas de stock pour cette base/support")

    # Decrémenter (quantity est le nombre a sortir, on le stocke en négatif)
    stock.current_stock = max(0, stock.current_stock - data.quantity)
    stock.last_updated_at = _now_iso()

    # Mouvement tracabilite / Traceability movement
    db.add(BaseContainerMovement(
        base_id=data.base_id,
        support_type_id=data.support_type_id,
        movement_type=mvt_type,
        quantity=-data.quantity,
        reference=data.reference,
        timestamp=_now_iso(),
        user_id=user.id,
        notes=data.notes,
    ))

    await db.flush()
    return {"status": "ok", "new_stock": stock.current_stock}


class PrepLine(BaseModel):
    """Ligne de préparation / Preparation line."""
    support_type_id: int
    quantity: int  # nombre d'unités individuelles
    stacks: int = 0  # nombre de piles complètes (informatif)


class PrepBatch(BaseModel):
    """Lot de préparation livraison / Delivery preparation batch."""
    base_id: int
    lines: list[PrepLine]
    reference: str | None = None
    notes: str | None = None


@router.post("/prep-batch")
async def prep_batch(
    data: PrepBatch,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("base-container-stock", "update")),
):
    """Prépare un lot de contenants pour livraison (batch multi-types).
    Prepare a container batch for delivery (multi-type)."""
    valid_lines = [l for l in data.lines if l.quantity > 0]
    if not valid_lines:
        return {"status": "ok", "lines": []}

    now = _now_iso()

    # Lock batch unique trié par support_type_id (anti-deadlock)
    st_ids = sorted({l.support_type_id for l in valid_lines})
    stock_result = await db.execute(
        select(BaseContainerStock).where(
            BaseContainerStock.base_id == data.base_id,
            BaseContainerStock.support_type_id.in_(st_ids),
        ).order_by(BaseContainerStock.support_type_id).with_for_update()
    )
    stock_map = {s.support_type_id: s for s in stock_result.scalars()}

    results = []
    for line in valid_lines:
        stock = stock_map.get(line.support_type_id)
        if not stock:
            results.append({"support_type_id": line.support_type_id, "error": "Pas de stock"})
            continue
        if stock.current_stock < line.quantity:
            results.append({"support_type_id": line.support_type_id, "error": f"Stock insuffisant ({stock.current_stock} < {line.quantity})"})
            continue
        stock.current_stock -= line.quantity
        stock.last_updated_at = now
        ref = data.reference or ""
        if line.stacks > 0:
            ref += f" ({line.stacks} piles)"
        db.add(BaseContainerMovement(
            base_id=data.base_id,
            support_type_id=line.support_type_id,
            movement_type=BaseMovementType.DELIVERY_PREP,
            quantity=-line.quantity,
            reference=ref.strip(),
            timestamp=now,
            user_id=user.id,
            notes=data.notes,
        ))
        results.append({
            "support_type_id": line.support_type_id,
            "qty_removed": line.quantity,
            "new_stock": stock.current_stock,
        })
    await db.flush()
    return {"status": "ok", "lines": results}


@router.get("/movements/", response_model=list[BaseMovementRead])
async def list_base_movements(
    base_id: int | None = None,
    support_type_id: int | None = None,
    limit: int = Query(default=200, le=1000),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("base-container-stock", "read")),
):
    """Historique mouvements base / Base movement history."""
    query = (
        select(
            BaseContainerMovement.id,
            BaseContainerMovement.base_id,
            BaseLogistics.name.label("base_name"),
            BaseContainerMovement.zone_id,
            BaseZone.name.label("zone_name"),
            BaseContainerMovement.support_type_id,
            SupportType.code.label("support_type_code"),
            SupportType.name.label("support_type_name"),
            BaseContainerMovement.movement_type,
            BaseContainerMovement.inventory_type,
            BaseContainerMovement.quantity,
            BaseContainerMovement.reference,
            BaseContainerMovement.timestamp,
            BaseContainerMovement.notes,
        )
        .join(BaseLogistics, BaseContainerMovement.base_id == BaseLogistics.id)
        .join(SupportType, BaseContainerMovement.support_type_id == SupportType.id)
        .outerjoin(BaseZone, BaseContainerMovement.zone_id == BaseZone.id)
        .order_by(BaseContainerMovement.timestamp.desc())
        .limit(limit)
    )
    if base_id is not None:
        query = query.where(BaseContainerMovement.base_id == base_id)
    if support_type_id is not None:
        query = query.where(BaseContainerMovement.support_type_id == support_type_id)

    result = await db.execute(query)
    rows = result.all()
    return [
        BaseMovementRead(
            **{
                **dict(row._mapping),
                "movement_type": row.movement_type.value if hasattr(row.movement_type, "value") else row.movement_type,
            }
        )
        for row in rows
    ]


# --- Export InBev CSV ---

@router.get("/export")
async def export_base_stock(
    base_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("base-container-stock", "read")),
):
    """Export stock biere au format InBev CSV / Export beer stock in InBev CSV format."""
    base = await db.get(BaseLogistics, base_id)
    if not base:
        raise HTTPException(status_code=404, detail="Base not found")

    # Stock agrege toutes zones / Aggregate stock across zones
    query = (
        select(
            SupportType.name.label("empties_type"),
            SupportType.supplier_plant.label("plant"),
            func.sum(BaseContainerStock.current_stock).label("pallets"),
        )
        .join(SupportType, BaseContainerStock.support_type_id == SupportType.id)
        .where(
            BaseContainerStock.base_id == base_id,
            SupportType.code.like("SF-%"),  # Biere/consigne uniquement
            BaseContainerStock.current_stock > 0,
        )
        .group_by(SupportType.name, SupportType.supplier_plant)
        .order_by(SupportType.supplier_plant, SupportType.name)
    )
    result = await db.execute(query)
    rows = result.all()

    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    customer_name = f"{base.name}"

    # Generer CSV format InBev / Generate InBev format CSV
    output = io.StringIO()
    writer = csv.writer(output, delimiter=";")
    writer.writerow(["CUSTOMER NAME", "DATE", "EMPTIES TYPE", "PLANT", "PALLETS"])

    # Grouper par plant / Group by plant
    current_plant = None
    first_row = True
    for row in rows:
        plant = row.plant or ""
        if first_row:
            writer.writerow([customer_name, today, row.empties_type, plant, int(row.pallets)])
            first_row = False
        elif plant != current_plant:
            writer.writerow([])  # Ligne vide entre groupes / Blank line between groups
            writer.writerow([customer_name, today, row.empties_type, plant, int(row.pallets)])
        else:
            writer.writerow(["", "", row.empties_type, plant, int(row.pallets)])
        current_plant = plant

    # Total
    total = sum(int(r.pallets) for r in rows)
    writer.writerow([])
    writer.writerow(["", "", "", "", total])

    output.seek(0)
    filename = f"inventaire_biere_{base.code}_{today}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# --- Helper pour auto-increment sur reception / Helper for auto-increment on reception ---

async def increment_base_stock_on_receive(
    db: AsyncSession, base_id: int, support_type_id: int, unit_quantity: int,
    label_code: str, device_id: int | None = None,
):
    """Incrementer le stock base quand un label est receptionne / Increment base stock on label receipt."""
    result = await db.execute(
        select(BaseContainerStock).where(
            BaseContainerStock.base_id == base_id,
            BaseContainerStock.support_type_id == support_type_id,
        )
    )
    stock = result.scalar_one_or_none()
    now = _now_iso()

    if stock:
        stock.current_stock += unit_quantity
        stock.last_updated_at = now
    else:
        stock = BaseContainerStock(
            base_id=base_id,
            support_type_id=support_type_id,
            current_stock=unit_quantity,
            last_updated_at=now,
        )
        db.add(stock)

    db.add(BaseContainerMovement(
        base_id=base_id,
        support_type_id=support_type_id,
        movement_type=BaseMovementType.RECEIVED_FROM_PDV,
        quantity=unit_quantity,
        reference=label_code,
        timestamp=now,
        device_id=device_id,
    ))
