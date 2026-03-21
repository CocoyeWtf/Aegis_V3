"""Routes API consignes bière / Beer consignment API routes.
Registre livré vs retourné par PDV × casier.
"""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.beer_consignment import BeerConsignmentTx, BeerConsignmentBalance, BeerTransactionType
from app.models.pdv import PDV
from app.models.support_type import SupportType
from app.schemas.beer_consignment import (
    BeerTxCreate, BeerTxDetail, BeerBalanceDetail, BeerBalanceSummary,
)
from app.api.deps import require_permission, get_current_user

router = APIRouter()


# ─── Helpers ────────────────────────────────────────────────────────────


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _compute_financial_value(
    tx_type: str, crate_qty: int, loose_bottle_qty: int,
    unit_value: float | None, bottle_value: float | None,
) -> float:
    """Calcule la valeur financière d'une transaction / Compute financial value."""
    val = 0.0
    if unit_value:
        val += abs(crate_qty) * float(unit_value)
    if bottle_value:
        val += abs(loose_bottle_qty) * float(bottle_value)
    if tx_type in ("RETURN", "WRITE_OFF"):
        val = -val
    return round(val, 2)


# ─── Liste des soldes / Balance list ────────────────────────────────────


@router.get("/balances/", dependencies=[Depends(require_permission("beer-consignments", "read"))])
async def list_balances(
    pdv_id: int | None = Query(None),
    support_type_id: int | None = Query(None),
    db: AsyncSession = Depends(get_db),
) -> BeerBalanceSummary:
    """Liste les soldes consignes par PDV × type / List consignment balances."""
    q = (
        select(BeerConsignmentBalance, PDV, SupportType)
        .join(PDV, BeerConsignmentBalance.pdv_id == PDV.id)
        .join(SupportType, BeerConsignmentBalance.support_type_id == SupportType.id)
    )
    if pdv_id:
        q = q.where(BeerConsignmentBalance.pdv_id == pdv_id)
    if support_type_id:
        q = q.where(BeerConsignmentBalance.support_type_id == support_type_id)
    q = q.order_by(PDV.code, SupportType.code)

    result = await db.execute(q)
    rows = result.all()

    items: list[BeerBalanceDetail] = []
    total_crate = 0
    total_value = 0.0
    total_del = 0
    total_ret = 0
    pdv_ids = set()

    for bal, pdv, st in rows:
        uv = float(st.unit_value) if st.unit_value else None
        bv = float(st.content_item_value) if st.content_item_value else None
        balance_val = 0.0
        if uv:
            balance_val += bal.crate_balance * uv
        if bv:
            balance_val += bal.loose_bottle_balance * bv
        balance_val = round(balance_val, 2)

        items.append(BeerBalanceDetail(
            pdv_id=pdv.id,
            pdv_code=pdv.code,
            pdv_name=pdv.name,
            support_type_id=st.id,
            support_type_code=st.code,
            support_type_name=st.name,
            unit_value=uv,
            bottles_per_crate=st.content_items_per_unit,
            bottle_value=bv,
            crate_balance=bal.crate_balance,
            loose_bottle_balance=bal.loose_bottle_balance,
            total_delivered=bal.total_delivered,
            total_returned=bal.total_returned,
            total_write_off=bal.total_write_off,
            balance_value=balance_val,
            last_delivery_date=bal.last_delivery_date,
            last_return_date=bal.last_return_date,
        ))
        total_crate += bal.crate_balance
        total_value += balance_val
        total_del += bal.total_delivered
        total_ret += bal.total_returned
        pdv_ids.add(pdv.id)

    return BeerBalanceSummary(
        items=items,
        total_crate_balance=total_crate,
        total_balance_value=round(total_value, 2),
        total_delivered=total_del,
        total_returned=total_ret,
        pdv_count=len(pdv_ids),
    )


# ─── Historique transactions / Transaction history ──────────────────────


@router.get("/transactions/", dependencies=[Depends(require_permission("beer-consignments", "read"))])
async def list_transactions(
    pdv_id: int | None = Query(None),
    support_type_id: int | None = Query(None),
    transaction_type: str | None = Query(None),
    date_from: str | None = Query(None),
    date_to: str | None = Query(None),
    limit: int = Query(200, le=1000),
    db: AsyncSession = Depends(get_db),
) -> list[BeerTxDetail]:
    """Liste l'historique des transactions / List transaction history."""
    q = (
        select(BeerConsignmentTx, PDV, SupportType)
        .join(PDV, BeerConsignmentTx.pdv_id == PDV.id)
        .join(SupportType, BeerConsignmentTx.support_type_id == SupportType.id)
    )
    if pdv_id:
        q = q.where(BeerConsignmentTx.pdv_id == pdv_id)
    if support_type_id:
        q = q.where(BeerConsignmentTx.support_type_id == support_type_id)
    if transaction_type:
        q = q.where(BeerConsignmentTx.transaction_type == transaction_type)
    if date_from:
        q = q.where(BeerConsignmentTx.transaction_date >= date_from)
    if date_to:
        q = q.where(BeerConsignmentTx.transaction_date <= date_to)

    q = q.order_by(BeerConsignmentTx.transaction_date.desc(), BeerConsignmentTx.id.desc()).limit(limit)

    result = await db.execute(q)
    rows = result.all()

    items: list[BeerTxDetail] = []
    for tx, pdv, st in rows:
        uv = float(st.unit_value) if st.unit_value else None
        bv = float(st.content_item_value) if st.content_item_value else None
        fv = _compute_financial_value(
            tx.transaction_type.value if hasattr(tx.transaction_type, 'value') else tx.transaction_type,
            tx.crate_qty, tx.loose_bottle_qty, uv, bv,
        )
        items.append(BeerTxDetail(
            id=tx.id,
            pdv_id=pdv.id,
            pdv_code=pdv.code,
            pdv_name=pdv.name,
            support_type_id=st.id,
            support_type_code=st.code,
            support_type_name=st.name,
            transaction_type=tx.transaction_type.value if hasattr(tx.transaction_type, 'value') else tx.transaction_type,
            crate_qty=tx.crate_qty,
            loose_bottle_qty=tx.loose_bottle_qty,
            unit_value_snapshot=tx.unit_value_snapshot,
            bottle_value_snapshot=tx.bottle_value_snapshot,
            financial_value=fv,
            reference=tx.reference,
            transaction_date=tx.transaction_date,
            created_at=tx.created_at,
            notes=tx.notes,
        ))
    return items


# ─── Créer une transaction / Create transaction ────────────────────────


@router.post("/transactions/", dependencies=[Depends(require_permission("beer-consignments", "create"))])
async def create_transaction(
    data: BeerTxCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """Enregistre une transaction consigne et met à jour le solde.
    Records a consignment transaction and updates the balance."""

    # Vérifier PDV et SupportType existent
    pdv = await db.get(PDV, data.pdv_id)
    if not pdv:
        raise HTTPException(404, "PDV introuvable")
    st = await db.get(SupportType, data.support_type_id)
    if not st:
        raise HTTPException(404, "Type de support introuvable")

    # Valider le type de transaction
    try:
        tx_type = BeerTransactionType(data.transaction_type)
    except ValueError:
        raise HTTPException(400, f"Type invalide: {data.transaction_type}")

    # Snapshot des valeurs actuelles
    uv = float(st.unit_value) if st.unit_value else None
    bv = float(st.content_item_value) if st.content_item_value else None

    tx = BeerConsignmentTx(
        pdv_id=data.pdv_id,
        support_type_id=data.support_type_id,
        transaction_type=tx_type,
        crate_qty=data.crate_qty,
        loose_bottle_qty=data.loose_bottle_qty,
        unit_value_snapshot=uv,
        bottle_value_snapshot=bv,
        reference=data.reference,
        transaction_date=data.transaction_date,
        created_at=_now_iso(),
        user_id=user.id if user else None,
        notes=data.notes,
    )
    db.add(tx)

    # Mettre à jour le solde / Update balance
    bal_q = select(BeerConsignmentBalance).where(
        BeerConsignmentBalance.pdv_id == data.pdv_id,
        BeerConsignmentBalance.support_type_id == data.support_type_id,
    )
    bal_res = await db.execute(bal_q)
    bal = bal_res.scalar_one_or_none()

    if not bal:
        bal = BeerConsignmentBalance(
            pdv_id=data.pdv_id,
            support_type_id=data.support_type_id,
        )
        db.add(bal)
        await db.flush()

    now = _now_iso()
    if tx_type == BeerTransactionType.DELIVERY:
        bal.crate_balance += data.crate_qty
        bal.loose_bottle_balance += data.loose_bottle_qty
        bal.total_delivered += abs(data.crate_qty)
        bal.last_delivery_date = data.transaction_date
    elif tx_type == BeerTransactionType.RETURN:
        bal.crate_balance -= abs(data.crate_qty)
        bal.loose_bottle_balance -= abs(data.loose_bottle_qty)
        bal.total_returned += abs(data.crate_qty)
        bal.last_return_date = data.transaction_date
    elif tx_type == BeerTransactionType.ADJUSTMENT:
        bal.crate_balance += data.crate_qty
        bal.loose_bottle_balance += data.loose_bottle_qty
    elif tx_type == BeerTransactionType.WRITE_OFF:
        bal.crate_balance -= abs(data.crate_qty)
        bal.loose_bottle_balance -= abs(data.loose_bottle_qty)
        bal.total_write_off += abs(data.crate_qty)

    bal.last_updated_at = now
    await db.commit()

    return {"id": tx.id, "message": "Transaction enregistree"}


# ─── Supprimer transaction / Delete transaction ────────────────────────


@router.delete("/transactions/{tx_id}", dependencies=[Depends(require_permission("beer-consignments", "delete"))])
async def delete_transaction(
    tx_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Annule une transaction et recalcule le solde / Cancel a transaction and recalculate balance."""
    tx = await db.get(BeerConsignmentTx, tx_id)
    if not tx:
        raise HTTPException(404, "Transaction introuvable")

    # Inverser l'effet sur le solde
    bal_q = select(BeerConsignmentBalance).where(
        BeerConsignmentBalance.pdv_id == tx.pdv_id,
        BeerConsignmentBalance.support_type_id == tx.support_type_id,
    )
    bal_res = await db.execute(bal_q)
    bal = bal_res.scalar_one_or_none()

    if bal:
        tx_type = tx.transaction_type.value if hasattr(tx.transaction_type, 'value') else tx.transaction_type
        if tx_type == "DELIVERY":
            bal.crate_balance -= tx.crate_qty
            bal.loose_bottle_balance -= tx.loose_bottle_qty
            bal.total_delivered -= abs(tx.crate_qty)
        elif tx_type == "RETURN":
            bal.crate_balance += abs(tx.crate_qty)
            bal.loose_bottle_balance += abs(tx.loose_bottle_qty)
            bal.total_returned -= abs(tx.crate_qty)
        elif tx_type == "ADJUSTMENT":
            bal.crate_balance -= tx.crate_qty
            bal.loose_bottle_balance -= tx.loose_bottle_qty
        elif tx_type == "WRITE_OFF":
            bal.crate_balance += abs(tx.crate_qty)
            bal.loose_bottle_balance += abs(tx.loose_bottle_qty)
            bal.total_write_off -= abs(tx.crate_qty)
        bal.last_updated_at = _now_iso()

    await db.delete(tx)
    await db.commit()
    return {"message": "Transaction supprimee"}


# ─── Stats résumé / Summary stats ──────────────────────────────────────


@router.get("/stats/", dependencies=[Depends(require_permission("beer-consignments", "read"))])
async def consignment_stats(
    db: AsyncSession = Depends(get_db),
):
    """Statistiques globales consignes bière / Global beer consignment stats."""
    # Nombre de PDV avec solde > 0
    q_pdv = select(func.count(func.distinct(BeerConsignmentBalance.pdv_id))).where(
        BeerConsignmentBalance.crate_balance > 0
    )
    pdv_count = (await db.execute(q_pdv)).scalar() or 0

    # Totaux
    q_totals = select(
        func.sum(BeerConsignmentBalance.crate_balance),
        func.sum(BeerConsignmentBalance.total_delivered),
        func.sum(BeerConsignmentBalance.total_returned),
        func.sum(BeerConsignmentBalance.total_write_off),
    )
    row = (await db.execute(q_totals)).one()

    # Valeur financière totale (join avec SupportType pour unit_value)
    q_val = (
        select(func.sum(BeerConsignmentBalance.crate_balance * SupportType.unit_value))
        .join(SupportType, BeerConsignmentBalance.support_type_id == SupportType.id)
        .where(SupportType.unit_value.isnot(None))
    )
    total_value = (await db.execute(q_val)).scalar() or 0

    return {
        "pdv_with_balance": pdv_count,
        "total_crate_balance": row[0] or 0,
        "total_delivered": row[1] or 0,
        "total_returned": row[2] or 0,
        "total_write_off": row[3] or 0,
        "total_balance_value": round(float(total_value), 2),
        "return_rate": round((row[2] or 0) / max(row[1] or 1, 1) * 100, 1),
    }
