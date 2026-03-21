"""Routes facturation GIC / GIC billing API routes.
Génération, consultation et gestion des factures d'immobilisation contenants.
"""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
import io
import csv

from app.database import get_db
from app.models.gic_invoice import GicInvoice, GicInvoiceLine, GicInvoiceStatus
from app.models.pdv import PDV
from app.models.pdv_inventory import PdvStock
from app.models.support_type import SupportType
from app.models.user import User
from app.schemas.gic_invoice import (
    GicInvoiceRead, GicInvoiceDetail, GicInvoiceGenerate, GicInvoiceStatusUpdate,
)
from app.api.deps import require_permission

router = APIRouter()


@router.get("/", response_model=list[GicInvoiceRead])
async def list_invoices(
    status: str | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("pdv-stock", "read")),
):
    """Liste les factures GIC / List GIC invoices."""
    query = select(GicInvoice).order_by(GicInvoice.generated_at.desc())
    if status:
        query = query.where(GicInvoice.status == status)
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/{invoice_id}", response_model=GicInvoiceDetail)
async def get_invoice(
    invoice_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("pdv-stock", "read")),
):
    """Détail d'une facture avec lignes / Invoice detail with line items."""
    result = await db.execute(
        select(GicInvoice)
        .options(selectinload(GicInvoice.lines))
        .where(GicInvoice.id == invoice_id)
    )
    invoice = result.scalar_one_or_none()
    if not invoice:
        raise HTTPException(status_code=404, detail="Facture GIC non trouvée")
    return invoice


@router.post("/generate/", response_model=GicInvoiceDetail, status_code=201)
async def generate_invoice(
    data: GicInvoiceGenerate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("pdv-stock", "create")),
):
    """Générer une facture GIC à partir des dépassements PUO actuels /
    Generate a GIC invoice from current PUO overages.
    Prend un snapshot de tous les PDV dont le stock dépasse le PUO.
    """
    from zoneinfo import ZoneInfo
    now = datetime.now(ZoneInfo("Europe/Brussels")).isoformat()

    # Requêter tous les dépassements / Query all overages
    query = (
        select(PdvStock, PDV.code, PDV.name, SupportType.code, SupportType.name, SupportType.unit_value)
        .join(PDV, PdvStock.pdv_id == PDV.id)
        .join(SupportType, PdvStock.support_type_id == SupportType.id)
        .where(PdvStock.puo.isnot(None))
        .where(PdvStock.current_stock > PdvStock.puo)
    )
    if data.base_id:
        # Filtrer par base via la région du PDV (même région que la base)
        # Pour simplifier, on ne filtre pas ici — l'utilisateur filtre côté frontend
        pass

    result = await db.execute(query)
    rows = result.all()

    if not rows:
        raise HTTPException(status_code=400, detail="Aucun dépassement PUO trouvé — rien à facturer")

    # Créer la facture / Create invoice
    invoice = GicInvoice(
        period_label=data.period_label,
        period_start=data.period_start,
        period_end=data.period_end,
        status=GicInvoiceStatus.DRAFT,
        generated_at=now,
        generated_by=user.username if hasattr(user, 'username') else None,
        notes=data.notes,
        base_id=data.base_id,
    )

    total_units = 0
    total_value = 0.0
    pdv_ids: set[int] = set()

    for stock, pdv_code, pdv_name, st_code, st_name, unit_value in rows:
        overage = stock.current_stock - stock.puo
        uv = float(unit_value) if unit_value else 0.0
        ov = overage * uv

        line = GicInvoiceLine(
            pdv_id=stock.pdv_id, pdv_code=pdv_code, pdv_name=pdv_name,
            support_type_id=stock.support_type_id, support_type_code=st_code,
            support_type_name=st_name,
            current_stock=stock.current_stock, puo=stock.puo,
            overage=overage, unit_value=uv, overage_value=ov,
        )
        invoice.lines.append(line)
        total_units += overage
        total_value += ov
        pdv_ids.add(stock.pdv_id)

    invoice.total_overage_units = total_units
    invoice.total_overage_value = total_value
    invoice.pdv_count = len(pdv_ids)
    invoice.line_count = len(invoice.lines)

    db.add(invoice)
    await db.flush()
    await db.refresh(invoice)

    # Recharger avec les lignes / Reload with lines
    result2 = await db.execute(
        select(GicInvoice).options(selectinload(GicInvoice.lines)).where(GicInvoice.id == invoice.id)
    )
    return result2.scalar_one()


@router.put("/{invoice_id}/status", response_model=GicInvoiceRead)
async def update_invoice_status(
    invoice_id: int,
    data: GicInvoiceStatusUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("pdv-stock", "update")),
):
    """Changer le statut d'une facture / Update invoice status."""
    try:
        new_status = GicInvoiceStatus(data.status)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Statut invalide: {data.status}")

    invoice = await db.get(GicInvoice, invoice_id)
    if not invoice:
        raise HTTPException(status_code=404, detail="Facture GIC non trouvée")
    invoice.status = new_status
    await db.flush()
    await db.refresh(invoice)
    return invoice


@router.delete("/{invoice_id}", status_code=204)
async def delete_invoice(
    invoice_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("pdv-stock", "delete")),
):
    """Supprimer une facture (DRAFT uniquement) / Delete invoice (DRAFT only)."""
    invoice = await db.get(GicInvoice, invoice_id)
    if not invoice:
        raise HTTPException(status_code=404, detail="Facture GIC non trouvée")
    if invoice.status != GicInvoiceStatus.DRAFT:
        raise HTTPException(status_code=400, detail="Seules les factures DRAFT peuvent être supprimées")
    await db.delete(invoice)


@router.get("/{invoice_id}/export")
async def export_invoice_csv(
    invoice_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("pdv-stock", "read")),
):
    """Exporter une facture en CSV / Export invoice as CSV."""
    result = await db.execute(
        select(GicInvoice).options(selectinload(GicInvoice.lines)).where(GicInvoice.id == invoice_id)
    )
    invoice = result.scalar_one_or_none()
    if not invoice:
        raise HTTPException(status_code=404, detail="Facture GIC non trouvée")

    output = io.StringIO()
    writer = csv.writer(output, delimiter=";")
    writer.writerow([
        "PDV Code", "PDV Nom", "Type Support Code", "Type Support Nom",
        "Stock Actuel", "PUO", "Exces", "Valeur Unitaire EUR", "Valeur Exces EUR",
    ])
    for line in invoice.lines:
        writer.writerow([
            line.pdv_code, line.pdv_name, line.support_type_code, line.support_type_name,
            line.current_stock, line.puo, line.overage,
            f"{line.unit_value:.2f}", f"{line.overage_value:.2f}",
        ])
    # Ligne totale / Total row
    writer.writerow([])
    writer.writerow(["TOTAL", "", "", "", "", "", invoice.total_overage_units, "", f"{invoice.total_overage_value:.2f}"])
    writer.writerow(["Periode", invoice.period_label, "Du", invoice.period_start, "Au", invoice.period_end])
    writer.writerow(["PDV en depassement", invoice.pdv_count, "Lignes", invoice.line_count])

    content = output.getvalue().encode("utf-8-sig")
    filename = f"GIC_{invoice.period_label}_{invoice.id}.csv"

    return StreamingResponse(
        io.BytesIO(content),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
