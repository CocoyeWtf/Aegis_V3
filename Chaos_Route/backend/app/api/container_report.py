"""Rapport consolidé contenants / Consolidated container report.
Agrège stock base, stock PDV, consignes bière, tri vidanges, anomalies.
Export CSV consolidé.
"""

import csv
import io
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import select, func, case
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.base_container_stock import BaseContainerStock, BaseContainerMovement, BaseMovementType
from app.models.pdv_inventory import PdvStock
from app.models.beer_consignment import BeerConsignmentBalance
from app.models.bottle_sorting import SortingSession, SortingLine, SortingStatus, BottleBrand
from app.models.container_anomaly import ContainerAnomaly, AnomalyStatus, AnomalySeverity
from app.models.support_type import SupportType
from app.models.pdv import PDV
from app.models.base_logistics import BaseLogistics
from app.api.deps import require_permission

router = APIRouter()


@router.get("/summary/", dependencies=[Depends(require_permission("base-container-stock", "read"))])
async def report_summary(
    db: AsyncSession = Depends(get_db),
):
    """KPI consolidés du module contenants / Consolidated container KPIs."""

    # 1. Stock base total
    base_stock_q = select(func.sum(BaseContainerStock.current_stock))
    base_stock_total = (await db.execute(base_stock_q)).scalar() or 0

    # 2. Stock base par type
    base_by_type_q = (
        select(SupportType.code, SupportType.name, func.sum(BaseContainerStock.current_stock))
        .join(SupportType, BaseContainerStock.support_type_id == SupportType.id)
        .group_by(SupportType.code, SupportType.name)
        .order_by(SupportType.code)
    )
    base_by_type = [
        {"code": r[0], "name": r[1], "stock": r[2] or 0}
        for r in (await db.execute(base_by_type_q)).all()
    ]

    # 3. Stock PDV total + valeur PUO
    pdv_stock_q = select(
        func.sum(PdvStock.current_stock),
        func.count(func.distinct(PdvStock.pdv_id)),
    )
    pdv_row = (await db.execute(pdv_stock_q)).one()
    pdv_stock_total = pdv_row[0] or 0
    pdv_count = pdv_row[1] or 0

    # PUO overages
    puo_q = select(
        func.count(),
        func.sum(PdvStock.current_stock - PdvStock.puo),
    ).where(PdvStock.puo.isnot(None), PdvStock.current_stock > PdvStock.puo)
    puo_row = (await db.execute(puo_q)).one()
    puo_overage_count = puo_row[0] or 0
    puo_overage_units = puo_row[1] or 0

    # 4. Consignes bière
    beer_q = select(
        func.sum(BeerConsignmentBalance.crate_balance),
        func.sum(BeerConsignmentBalance.total_delivered),
        func.sum(BeerConsignmentBalance.total_returned),
        func.count(func.distinct(BeerConsignmentBalance.pdv_id)),
    )
    beer_row = (await db.execute(beer_q)).one()
    beer_balance = beer_row[0] or 0
    beer_delivered = beer_row[1] or 0
    beer_returned = beer_row[2] or 0
    beer_pdv_count = beer_row[3] or 0
    beer_return_rate = round(beer_returned / max(beer_delivered, 1) * 100, 1)

    # 5. Tri vidanges (30 derniers jours)
    thirty_days_ago = (datetime.now(timezone.utc).replace(hour=0, minute=0, second=0) - timedelta(days=30)).strftime('%Y-%m-%d')
    sorting_q = select(
        func.count(func.distinct(SortingSession.id)),
        func.sum(SortingSession.total_crates),
        func.sum(SortingSession.total_bottles),
    ).where(
        SortingSession.status == SortingStatus.COMPLETED,
        SortingSession.session_date >= thirty_days_ago,
    )
    sorting_row = (await db.execute(sorting_q)).one()

    # 6. Anomalies
    anomaly_q = select(
        func.count(),
        func.sum(case((ContainerAnomaly.status == AnomalyStatus.OPEN, 1), else_=0)),
        func.sum(case((ContainerAnomaly.severity == AnomalySeverity.CRITICAL, 1), else_=0)),
        func.sum(func.coalesce(ContainerAnomaly.financial_impact, 0)),
    ).where(ContainerAnomaly.status != AnomalyStatus.CLOSED)
    anom_row = (await db.execute(anomaly_q)).one()

    # 7. Mouvements 7j
    seven_days_ago = (datetime.now(timezone.utc) - timedelta(days=7)).strftime('%Y-%m-%d')
    mvt_q = (
        select(
            BaseContainerMovement.movement_type,
            func.sum(func.abs(BaseContainerMovement.quantity)),
        )
        .where(BaseContainerMovement.timestamp >= seven_days_ago)
        .group_by(BaseContainerMovement.movement_type)
    )
    mvt_rows = (await db.execute(mvt_q)).all()
    movements_7d = {
        (r[0].value if hasattr(r[0], 'value') else r[0]): r[1] or 0
        for r in mvt_rows
    }

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "base_stock": {
            "total_units": base_stock_total,
            "by_type": base_by_type,
        },
        "pdv_stock": {
            "total_units": pdv_stock_total,
            "pdv_count": pdv_count,
            "puo_overage_count": puo_overage_count,
            "puo_overage_units": puo_overage_units,
        },
        "beer_consignments": {
            "crate_balance": beer_balance,
            "total_delivered": beer_delivered,
            "total_returned": beer_returned,
            "pdv_count": beer_pdv_count,
            "return_rate": beer_return_rate,
        },
        "bottle_sorting_30d": {
            "sessions": sorting_row[0] or 0,
            "total_crates": sorting_row[1] or 0,
            "total_bottles": sorting_row[2] or 0,
        },
        "anomalies": {
            "total_active": anom_row[0] or 0,
            "open": anom_row[1] or 0,
            "critical": anom_row[2] or 0,
            "total_impact": round(float(anom_row[3] or 0), 2),
        },
        "movements_7d": movements_7d,
    }


@router.get("/export-csv/", dependencies=[Depends(require_permission("base-container-stock", "read"))])
async def export_consolidated_csv(
    db: AsyncSession = Depends(get_db),
):
    """Export CSV consolidé stock + consignes + anomalies / Consolidated CSV export."""
    output = io.StringIO()
    writer = csv.writer(output, delimiter=';')

    # Section 1: Stock base
    writer.writerow(["=== STOCK BASE ==="])
    writer.writerow(["Base", "Type support", "Stock actuel"])
    q1 = (
        select(BaseLogistics.name, SupportType.code, SupportType.name, BaseContainerStock.current_stock)
        .join(BaseLogistics, BaseContainerStock.base_id == BaseLogistics.id)
        .join(SupportType, BaseContainerStock.support_type_id == SupportType.id)
        .order_by(BaseLogistics.name, SupportType.code)
    )
    for r in (await db.execute(q1)).all():
        writer.writerow([r[0], f"{r[1]} - {r[2]}", r[3]])

    writer.writerow([])

    # Section 2: Stock PDV avec PUO
    writer.writerow(["=== STOCK PDV ==="])
    writer.writerow(["PDV Code", "PDV Nom", "Type support", "Stock", "PUO", "Ecart"])
    q2 = (
        select(PDV.code, PDV.name, SupportType.code, PdvStock.current_stock, PdvStock.puo)
        .join(PDV, PdvStock.pdv_id == PDV.id)
        .join(SupportType, PdvStock.support_type_id == SupportType.id)
        .order_by(PDV.code, SupportType.code)
    )
    for r in (await db.execute(q2)).all():
        ecart = (r[3] - r[4]) if r[4] else ""
        writer.writerow([r[0], r[1], r[2], r[3], r[4] or "", ecart])

    writer.writerow([])

    # Section 3: Consignes bière
    writer.writerow(["=== CONSIGNES BIERE ==="])
    writer.writerow(["PDV Code", "PDV Nom", "Type casier", "Solde casiers", "Total livre", "Total retourne", "Pertes"])
    q3 = (
        select(PDV.code, PDV.name, SupportType.code,
               BeerConsignmentBalance.crate_balance, BeerConsignmentBalance.total_delivered,
               BeerConsignmentBalance.total_returned, BeerConsignmentBalance.total_write_off)
        .join(PDV, BeerConsignmentBalance.pdv_id == PDV.id)
        .join(SupportType, BeerConsignmentBalance.support_type_id == SupportType.id)
        .order_by(PDV.code)
    )
    for r in (await db.execute(q3)).all():
        writer.writerow(list(r))

    writer.writerow([])

    # Section 4: Anomalies actives
    writer.writerow(["=== ANOMALIES ACTIVES ==="])
    writer.writerow(["ID", "Statut", "Severite", "Categorie", "Titre", "PDV", "Impact EUR", "Cree le"])
    q4 = (
        select(ContainerAnomaly.id, ContainerAnomaly.status, ContainerAnomaly.severity,
               ContainerAnomaly.category, ContainerAnomaly.title,
               PDV.code, ContainerAnomaly.financial_impact, ContainerAnomaly.created_at)
        .outerjoin(PDV, ContainerAnomaly.pdv_id == PDV.id)
        .where(ContainerAnomaly.status != AnomalyStatus.CLOSED)
        .order_by(ContainerAnomaly.created_at.desc())
    )
    for r in (await db.execute(q4)).all():
        row = list(r)
        # Enum to string
        for i in [1, 2, 3]:
            if hasattr(row[i], 'value'):
                row[i] = row[i].value
        writer.writerow(row)

    output.seek(0)
    now = datetime.now(timezone.utc).strftime('%Y%m%d_%H%M')
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=rapport_contenants_{now}.csv"},
    )
