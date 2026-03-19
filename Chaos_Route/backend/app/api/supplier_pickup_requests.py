"""Routes reprises fournisseur / Supplier pickup request API routes.
Gestion des demandes de retour contenants base -> fournisseur.
"""

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models.supplier_pickup_request import (
    SupplierPickupRequest, SupplierPickupLine, SupplierPickupStatus,
)
from app.models.base_container_stock import BaseContainerStock, BaseContainerMovement, BaseMovementType
from app.models.support_type import SupportType
from app.models.supplier import Supplier
from app.models.base_logistics import BaseLogisticss
from app.models.user import User
from app.models.audit import AuditLog
from app.schemas.supplier_pickup import (
    SupplierPickupRequestCreate, SupplierPickupRequestRead, SupplierPickupRequestUpdate,
    SupplierPickupLineRead, StockAlertRead,
)
from app.api.deps import require_permission, get_current_user

logger = logging.getLogger(__name__)
router = APIRouter()


# ─── Helpers ───

def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


async def _enrich_request(req: SupplierPickupRequest, db: AsyncSession) -> dict:
    """Enrichir une demande avec relations / Enrich request with relations."""
    # Supplier
    supplier = await db.get(Supplier, req.supplier_id)
    # Base
    base = await db.get(BaseLogistics, req.base_id)
    # User
    username = None
    if req.created_by_user_id:
        user = await db.get(User, req.created_by_user_id)
        username = user.username if user else None
    # Lines
    lines_result = await db.execute(
        select(SupplierPickupLine).where(SupplierPickupLine.request_id == req.id)
    )
    lines = lines_result.scalars().all()
    # Enrich lines with support type info
    enriched_lines = []
    for line in lines:
        st = await db.get(SupportType, line.support_type_id)
        enriched_lines.append(SupplierPickupLineRead(
            id=line.id,
            request_id=line.request_id,
            support_type_id=line.support_type_id,
            palette_count=line.palette_count,
            unit_count=line.unit_count,
            notes=line.notes,
            support_type_name=st.name if st else None,
            support_type_code=st.code if st else None,
        ))

    return SupplierPickupRequestRead(
        id=req.id,
        base_id=req.base_id,
        supplier_id=req.supplier_id,
        status=req.status.value if isinstance(req.status, SupplierPickupStatus) else req.status,
        notes=req.notes,
        created_by_user_id=req.created_by_user_id,
        created_at=req.created_at,
        sent_at=req.sent_at,
        confirmed_at=req.confirmed_at,
        picked_up_at=req.picked_up_at,
        supplier={"id": supplier.id, "code": supplier.code, "name": supplier.name, "email": supplier.email} if supplier else None,
        base={"id": base.id, "code": getattr(base, "code", None), "name": base.name} if base else None,
        lines=enriched_lines,
        created_by_username=username,
    )


# ─── Alertes stock / Stock alerts ───

@router.get("/alerts/", response_model=list[StockAlertRead])
async def get_stock_alerts(
    base_id: int | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("supplier-pickups", "read")),
):
    """Alertes : stock base depasse le seuil pour un type de support.
    Alerts: base stock exceeds threshold for a support type."""
    # Jointure stock base × support_type (avec seuil defini)
    query = (
        select(BaseContainerStock, SupportType)
        .join(SupportType, BaseContainerStock.support_type_id == SupportType.id)
        .where(SupportType.alert_threshold.isnot(None))
        .where(SupportType.is_active.is_(True))
    )
    if base_id:
        query = query.where(BaseContainerStock.base_id == base_id)

    result = await db.execute(query)
    rows = result.all()

    alerts = []
    for stock, st in rows:
        if stock.current_stock >= (st.alert_threshold or 0):
            base = await db.get(BaseLogistics, stock.base_id)
            supplier = await db.get(Supplier, st.supplier_id) if st.supplier_id else None
            alerts.append(StockAlertRead(
                base_id=stock.base_id,
                base_name=base.name if base else "?",
                support_type_id=st.id,
                support_type_name=st.name,
                support_type_code=st.code,
                current_stock=stock.current_stock,
                alert_threshold=st.alert_threshold,
                supplier_id=st.supplier_id,
                supplier_name=supplier.name if supplier else None,
            ))

    return alerts


# ─── CRUD ───

@router.get("/", response_model=list[SupplierPickupRequestRead])
async def list_supplier_pickup_requests(
    base_id: int | None = None,
    supplier_id: int | None = None,
    status_filter: str | None = Query(None, alias="status"),
    limit: int = Query(default=200, le=2000),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("supplier-pickups", "read")),
):
    """Lister les demandes de reprise fournisseur / List supplier pickup requests."""
    query = select(SupplierPickupRequest)
    if base_id:
        query = query.where(SupplierPickupRequest.base_id == base_id)
    if supplier_id:
        query = query.where(SupplierPickupRequest.supplier_id == supplier_id)
    if status_filter:
        query = query.where(SupplierPickupRequest.status == status_filter)
    query = query.order_by(SupplierPickupRequest.id.desc()).offset(offset).limit(limit)

    result = await db.execute(query)
    requests = result.scalars().all()

    return [await _enrich_request(req, db) for req in requests]


@router.get("/{request_id}", response_model=SupplierPickupRequestRead)
async def get_supplier_pickup_request(
    request_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("supplier-pickups", "read")),
):
    """Detail d'une demande / Request detail."""
    req = await db.get(SupplierPickupRequest, request_id)
    if not req:
        raise HTTPException(status_code=404, detail="Demande non trouvee")
    return await _enrich_request(req, db)


@router.post("/", response_model=SupplierPickupRequestRead, status_code=status.HTTP_201_CREATED)
async def create_supplier_pickup_request(
    data: SupplierPickupRequestCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("supplier-pickups", "create")),
):
    """Creer une demande de reprise fournisseur / Create a supplier pickup request."""
    now = _now_iso()

    req = SupplierPickupRequest(
        base_id=data.base_id,
        supplier_id=data.supplier_id,
        status=SupplierPickupStatus.DRAFT,
        notes=data.notes,
        created_by_user_id=user.id,
        created_at=now,
    )
    db.add(req)
    await db.flush()

    for line_data in data.lines:
        line = SupplierPickupLine(
            request_id=req.id,
            support_type_id=line_data.support_type_id,
            palette_count=line_data.palette_count,
            unit_count=line_data.unit_count,
            notes=line_data.notes,
        )
        db.add(line)

    await db.flush()

    db.add(AuditLog(
        entity_type="supplier_pickup", entity_id=req.id, action="CREATED",
        changes=f'{{"supplier_id":{data.supplier_id},"base_id":{data.base_id},"lines":{len(data.lines)}}}',
        user=user.username, timestamp=now,
    ))

    return await _enrich_request(req, db)


@router.put("/{request_id}", response_model=SupplierPickupRequestRead)
async def update_supplier_pickup_request(
    request_id: int,
    data: SupplierPickupRequestUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("supplier-pickups", "update")),
):
    """Modifier une demande / Update a request."""
    req = await db.get(SupplierPickupRequest, request_id)
    if not req:
        raise HTTPException(status_code=404, detail="Demande non trouvee")

    now = _now_iso()

    if data.status is not None:
        new_status = SupplierPickupStatus(data.status)
        old_status = req.status
        req.status = new_status
        # Mettre a jour les dates selon le statut / Update dates based on status
        if new_status == SupplierPickupStatus.SENT and not req.sent_at:
            req.sent_at = now
        elif new_status == SupplierPickupStatus.CONFIRMED and not req.confirmed_at:
            req.confirmed_at = now
        elif new_status == SupplierPickupStatus.PICKED_UP and not req.picked_up_at:
            req.picked_up_at = now
            # Decrementer le stock base / Decrement base stock
            await _apply_supplier_return(req, db, user, now)

    if data.notes is not None:
        req.notes = data.notes

    # Mise a jour des lignes si fournies / Update lines if provided
    if data.lines is not None:
        # Supprimer les anciennes / Delete old lines
        old_lines = await db.execute(
            select(SupplierPickupLine).where(SupplierPickupLine.request_id == req.id)
        )
        for old_line in old_lines.scalars().all():
            await db.delete(old_line)
        # Creer les nouvelles / Create new lines
        for line_data in data.lines:
            line = SupplierPickupLine(
                request_id=req.id,
                support_type_id=line_data.support_type_id,
                palette_count=line_data.palette_count,
                unit_count=line_data.unit_count,
                notes=line_data.notes,
            )
            db.add(line)

    await db.flush()

    db.add(AuditLog(
        entity_type="supplier_pickup", entity_id=req.id, action="UPDATED",
        changes=f'{{"status":"{req.status.value}"}}',
        user=user.username, timestamp=now,
    ))

    return await _enrich_request(req, db)


@router.delete("/{request_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_supplier_pickup_request(
    request_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("supplier-pickups", "delete")),
):
    """Supprimer une demande (brouillon uniquement) / Delete a request (draft only)."""
    req = await db.get(SupplierPickupRequest, request_id)
    if not req:
        raise HTTPException(status_code=404, detail="Demande non trouvee")
    if req.status != SupplierPickupStatus.DRAFT:
        raise HTTPException(status_code=400, detail="Seules les demandes en brouillon peuvent etre supprimees")
    # Supprimer les lignes / Delete lines
    lines = await db.execute(
        select(SupplierPickupLine).where(SupplierPickupLine.request_id == req.id)
    )
    for line in lines.scalars().all():
        await db.delete(line)
    await db.delete(req)


# ─── Envoi email / Send email ───

@router.post("/{request_id}/send-email")
async def send_supplier_pickup_email(
    request_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("supplier-pickups", "update")),
):
    """Envoyer la demande par email au fournisseur / Send request by email to supplier."""
    req = await db.get(SupplierPickupRequest, request_id)
    if not req:
        raise HTTPException(status_code=404, detail="Demande non trouvee")

    supplier = await db.get(Supplier, req.supplier_id)
    if not supplier or not supplier.email:
        raise HTTPException(status_code=400, detail="Le fournisseur n'a pas d'adresse email")

    base = await db.get(BaseLogistics, req.base_id)

    # Charger les lignes / Load lines
    lines_result = await db.execute(
        select(SupplierPickupLine).where(SupplierPickupLine.request_id == req.id)
    )
    lines = lines_result.scalars().all()

    # Construire le tableau / Build table
    table_rows = []
    for line in lines:
        st = await db.get(SupportType, line.support_type_id)
        table_rows.append(
            f"  - {st.name if st else '?'} ({st.code if st else '?'}): "
            f"{line.palette_count} palette(s)"
            + (f", {line.unit_count} unites" if line.unit_count else "")
            + (f" — {line.notes}" if line.notes else "")
        )

    now = _now_iso()
    body = (
        f"Bonjour,\n\n"
        f"Nous vous adressons une demande de reprise de contenants consignes.\n\n"
        f"Base : {base.name if base else '?'}\n"
        f"Date : {now[:10]}\n\n"
        f"Contenants a reprendre :\n"
        + "\n".join(table_rows) + "\n\n"
        + (f"Notes : {req.notes}\n\n" if req.notes else "")
        + f"Merci de confirmer la date d'enlevement.\n\n"
        f"Cordialement,\n"
        f"— Chaos RouteManager\n"
    )

    if settings.SMTP_HOST:
        import aiosmtplib
        from email.message import EmailMessage

        msg = EmailMessage()
        msg["From"] = settings.SMTP_FROM
        msg["To"] = supplier.email
        msg["Subject"] = f"Demande de reprise contenants — {base.name if base else ''} — {now[:10]}"
        msg.set_content(body)

        try:
            await aiosmtplib.send(
                msg,
                hostname=settings.SMTP_HOST,
                port=settings.SMTP_PORT,
                username=settings.SMTP_USER or None,
                password=settings.SMTP_PASSWORD or None,
                use_tls=settings.SMTP_USE_TLS,
            )
        except Exception as e:
            logger.error(f"Erreur envoi email reprise fournisseur: {e}")
            raise HTTPException(status_code=500, detail="Erreur lors de l'envoi de l'email")
    else:
        logger.warning(f"SMTP non configure. Email reprise fournisseur:\nTo: {supplier.email}\n{body}")

    # Mettre a jour le statut / Update status
    req.status = SupplierPickupStatus.SENT
    req.sent_at = now
    await db.flush()

    db.add(AuditLog(
        entity_type="supplier_pickup", entity_id=req.id, action="EMAIL_SENT",
        changes=f'{{"to":"{supplier.email}"}}',
        user=user.username, timestamp=now,
    ))

    return {"detail": f"Email envoye a {supplier.email}"}


# ─── Helper : appliquer le retour fournisseur sur le stock base ───

async def _apply_supplier_return(
    req: SupplierPickupRequest, db: AsyncSession, user: User, now: str,
):
    """Decrementer le stock base pour chaque ligne / Decrement base stock for each line."""
    lines_result = await db.execute(
        select(SupplierPickupLine).where(SupplierPickupLine.request_id == req.id)
    )
    for line in lines_result.scalars().all():
        # Calculer la quantite totale en unites / Calculate total units
        st = await db.get(SupportType, line.support_type_id)
        unit_qty = st.unit_quantity if st else 1
        total_units = line.palette_count * unit_qty
        if line.unit_count:
            total_units = line.unit_count  # Si explicitement fourni, utiliser celui-ci

        # Decrementer le stock / Decrement stock
        stock_result = await db.execute(
            select(BaseContainerStock).where(
                BaseContainerStock.base_id == req.base_id,
                BaseContainerStock.support_type_id == line.support_type_id,
            )
        )
        stock = stock_result.scalar_one_or_none()
        if stock:
            stock.current_stock = max(0, stock.current_stock - total_units)
            stock.last_updated_at = now

        # Mouvement tracabilite / Traceability movement
        db.add(BaseContainerMovement(
            base_id=req.base_id,
            support_type_id=line.support_type_id,
            movement_type=BaseMovementType.SUPPLIER_RETURN,
            quantity=-total_units,
            reference=f"SPR-{req.id}",
            timestamp=now,
            user_id=user.id,
            notes=f"Reprise fournisseur #{req.id}",
        ))
