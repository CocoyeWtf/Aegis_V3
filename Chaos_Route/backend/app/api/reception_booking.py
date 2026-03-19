"""Routes booking reception fournisseur / Supplier reception booking API routes.
Config bases, commandes, creneaux, reservations.
"""

import math
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.reception_booking import (
    ReceptionConfig, PurchaseOrder, PurchaseOrderStatus,
    ReceptionBooking, BookingStatus,
)
from app.models.supplier import Supplier
from app.models.base_logistics import BaseLogistics
from app.models.user import User
from app.schemas.reception_booking import (
    ReceptionConfigCreate, ReceptionConfigRead,
    PurchaseOrderCreate, PurchaseOrderRead,
    BookingCreate, BookingRead, BookingUpdate,
    SlotAvailability,
)
from app.api.deps import require_permission, get_current_user

router = APIRouter()


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _add_minutes(time_str: str, minutes: int) -> str:
    """Ajouter des minutes a HH:MM / Add minutes to HH:MM."""
    h, m = map(int, time_str.split(":"))
    total = h * 60 + m + minutes
    return f"{total // 60:02d}:{total % 60:02d}"


def _time_to_minutes(time_str: str) -> int:
    h, m = map(int, time_str.split(":"))
    return h * 60 + m


# ─── Config ───

@router.get("/configs/", response_model=list[ReceptionConfigRead])
async def list_reception_configs(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("reception-booking", "read")),
):
    """Lister les configurations reception / List reception configs."""
    result = await db.execute(select(ReceptionConfig))
    configs = result.scalars().all()
    enriched = []
    for cfg in configs:
        base = await db.get(BaseLogistics, cfg.base_id)
        enriched.append(ReceptionConfigRead(
            id=cfg.id, base_id=cfg.base_id,
            opening_time=cfg.opening_time, closing_time=cfg.closing_time,
            dock_count=cfg.dock_count, slot_duration_minutes=cfg.slot_duration_minutes,
            productivity_eqp_per_slot=cfg.productivity_eqp_per_slot,
            base_name=base.name if base else None,
        ))
    return enriched


@router.post("/configs/", response_model=ReceptionConfigRead, status_code=201)
async def create_reception_config(
    data: ReceptionConfigCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("reception-booking", "create")),
):
    """Creer une configuration / Create a config."""
    existing = await db.execute(
        select(ReceptionConfig).where(ReceptionConfig.base_id == data.base_id)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Configuration deja existante pour cette base")
    cfg = ReceptionConfig(**data.model_dump())
    db.add(cfg)
    await db.flush()
    base = await db.get(BaseLogistics, cfg.base_id)
    return ReceptionConfigRead(
        id=cfg.id, base_id=cfg.base_id,
        opening_time=cfg.opening_time, closing_time=cfg.closing_time,
        dock_count=cfg.dock_count, slot_duration_minutes=cfg.slot_duration_minutes,
        productivity_eqp_per_slot=cfg.productivity_eqp_per_slot,
        base_name=base.name if base else None,
    )


@router.put("/configs/{config_id}", response_model=ReceptionConfigRead)
async def update_reception_config(
    config_id: int,
    data: ReceptionConfigCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("reception-booking", "update")),
):
    """Modifier une configuration / Update a config."""
    cfg = await db.get(ReceptionConfig, config_id)
    if not cfg:
        raise HTTPException(status_code=404, detail="Configuration non trouvee")
    for key, value in data.model_dump().items():
        setattr(cfg, key, value)
    await db.flush()
    base = await db.get(BaseLogistics, cfg.base_id)
    return ReceptionConfigRead(
        id=cfg.id, base_id=cfg.base_id,
        opening_time=cfg.opening_time, closing_time=cfg.closing_time,
        dock_count=cfg.dock_count, slot_duration_minutes=cfg.slot_duration_minutes,
        productivity_eqp_per_slot=cfg.productivity_eqp_per_slot,
        base_name=base.name if base else None,
    )


# ─── Purchase Orders ───

@router.get("/orders/", response_model=list[PurchaseOrderRead])
async def list_purchase_orders(
    base_id: int | None = None,
    supplier_id: int | None = None,
    status_filter: str | None = Query(None, alias="status"),
    limit: int = Query(default=200, le=2000),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Lister les commandes / List purchase orders.
    Fournisseurs voient uniquement leurs commandes / Suppliers see only their orders."""
    query = select(PurchaseOrder)

    # Scope fournisseur / Supplier scope
    if user.supplier_id:
        query = query.where(PurchaseOrder.supplier_id == user.supplier_id)
    elif base_id:
        query = query.where(PurchaseOrder.base_id == base_id)

    if supplier_id and not user.supplier_id:
        query = query.where(PurchaseOrder.supplier_id == supplier_id)
    if status_filter:
        query = query.where(PurchaseOrder.status == status_filter)

    query = query.order_by(PurchaseOrder.expected_delivery_date.asc()).offset(offset).limit(limit)

    result = await db.execute(query)
    orders = result.scalars().all()

    enriched = []
    for o in orders:
        supplier = await db.get(Supplier, o.supplier_id)
        base = await db.get(BaseLogistics, o.base_id)
        enriched.append(PurchaseOrderRead(
            id=o.id, base_id=o.base_id, supplier_id=o.supplier_id,
            order_ref=o.order_ref, eqp_count=o.eqp_count,
            expected_delivery_date=o.expected_delivery_date,
            status=o.status.value if isinstance(o.status, PurchaseOrderStatus) else o.status,
            notes=o.notes, created_at=o.created_at,
            supplier_name=supplier.name if supplier else None,
            base_name=base.name if base else None,
        ))
    return enriched


@router.post("/orders/", response_model=PurchaseOrderRead, status_code=201)
async def create_purchase_order(
    data: PurchaseOrderCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("reception-booking", "create")),
):
    """Creer/injecter une commande / Create/inject a purchase order."""
    now = _now_iso()
    order = PurchaseOrder(
        base_id=data.base_id, supplier_id=data.supplier_id,
        order_ref=data.order_ref, eqp_count=data.eqp_count,
        expected_delivery_date=data.expected_delivery_date,
        status=PurchaseOrderStatus.PENDING,
        notes=data.notes, created_at=now,
    )
    db.add(order)
    await db.flush()
    supplier = await db.get(Supplier, order.supplier_id)
    base = await db.get(BaseLogistics, order.base_id)
    return PurchaseOrderRead(
        id=order.id, base_id=order.base_id, supplier_id=order.supplier_id,
        order_ref=order.order_ref, eqp_count=order.eqp_count,
        expected_delivery_date=order.expected_delivery_date,
        status="PENDING", notes=order.notes, created_at=order.created_at,
        supplier_name=supplier.name if supplier else None,
        base_name=base.name if base else None,
    )


@router.post("/orders/bulk/", response_model=list[PurchaseOrderRead], status_code=201)
async def bulk_create_purchase_orders(
    orders: list[PurchaseOrderCreate],
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("reception-booking", "create")),
):
    """Injection en masse de commandes / Bulk inject purchase orders."""
    now = _now_iso()
    created = []
    for data in orders:
        order = PurchaseOrder(
            base_id=data.base_id, supplier_id=data.supplier_id,
            order_ref=data.order_ref, eqp_count=data.eqp_count,
            expected_delivery_date=data.expected_delivery_date,
            status=PurchaseOrderStatus.PENDING,
            notes=data.notes, created_at=now,
        )
        db.add(order)
        await db.flush()
        supplier = await db.get(Supplier, order.supplier_id)
        base = await db.get(BaseLogistics, order.base_id)
        created.append(PurchaseOrderRead(
            id=order.id, base_id=order.base_id, supplier_id=order.supplier_id,
            order_ref=order.order_ref, eqp_count=order.eqp_count,
            expected_delivery_date=order.expected_delivery_date,
            status="PENDING", notes=order.notes, created_at=order.created_at,
            supplier_name=supplier.name if supplier else None,
            base_name=base.name if base else None,
        ))
    return created


# ─── Slot availability ───

@router.get("/availability/", response_model=list[SlotAvailability])
async def get_slot_availability(
    base_id: int,
    date: str,  # YYYY-MM-DD
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Creneaux disponibles pour une base et un jour / Available slots for a base and date."""
    # Charger config
    cfg_result = await db.execute(
        select(ReceptionConfig).where(ReceptionConfig.base_id == base_id)
    )
    cfg = cfg_result.scalar_one_or_none()
    if not cfg:
        raise HTTPException(status_code=404, detail="Pas de configuration reception pour cette base")

    # Charger bookings existants pour ce jour
    bookings_result = await db.execute(
        select(ReceptionBooking).where(
            ReceptionBooking.base_id == base_id,
            ReceptionBooking.booking_date == date,
            ReceptionBooking.status.notin_([BookingStatus.CANCELLED]),
        )
    )
    bookings = bookings_result.scalars().all()

    # Generer tous les creneaux
    opening = _time_to_minutes(cfg.opening_time)
    closing = _time_to_minutes(cfg.closing_time)
    slot_dur = cfg.slot_duration_minutes

    slots = []
    current = opening
    while current + slot_dur <= closing:
        start = f"{current // 60:02d}:{current % 60:02d}"
        end = f"{(current + slot_dur) // 60:02d}:{(current + slot_dur) % 60:02d}"

        # Trouver les quais occupes a ce creneau
        occupied_docks = set()
        for b in bookings:
            b_start = _time_to_minutes(b.start_time)
            b_end = _time_to_minutes(b.end_time)
            if b_start < current + slot_dur and b_end > current:
                occupied_docks.add(b.dock_number)

        available_docks = [d for d in range(1, cfg.dock_count + 1) if d not in occupied_docks]
        if available_docks:
            slots.append(SlotAvailability(
                start_time=start, end_time=end, available_docks=available_docks,
            ))

        current += slot_dur

    return slots


# ─── Bookings ───

@router.get("/bookings/", response_model=list[BookingRead])
async def list_bookings(
    base_id: int | None = None,
    date: str | None = None,
    supplier_id: int | None = None,
    status_filter: str | None = Query(None, alias="status"),
    limit: int = Query(default=200, le=2000),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Lister les reservations / List bookings."""
    query = select(ReceptionBooking)

    # Scope fournisseur
    if user.supplier_id:
        query = query.where(ReceptionBooking.supplier_id == user.supplier_id)
    elif supplier_id:
        query = query.where(ReceptionBooking.supplier_id == supplier_id)

    if base_id:
        query = query.where(ReceptionBooking.base_id == base_id)
    if date:
        query = query.where(ReceptionBooking.booking_date == date)
    if status_filter:
        query = query.where(ReceptionBooking.status == status_filter)

    query = query.order_by(ReceptionBooking.booking_date.asc(), ReceptionBooking.start_time.asc())
    query = query.offset(offset).limit(limit)

    result = await db.execute(query)
    bookings = result.scalars().all()

    enriched = []
    for b in bookings:
        supplier = await db.get(Supplier, b.supplier_id)
        base = await db.get(BaseLogistics, b.base_id)
        order = await db.get(PurchaseOrder, b.purchase_order_id)
        enriched.append(BookingRead(
            id=b.id, purchase_order_id=b.purchase_order_id,
            base_id=b.base_id, supplier_id=b.supplier_id,
            booking_date=b.booking_date, start_time=b.start_time,
            end_time=b.end_time, dock_number=b.dock_number,
            slots_needed=b.slots_needed,
            status=b.status.value if isinstance(b.status, BookingStatus) else b.status,
            created_at=b.created_at, arrived_at=b.arrived_at,
            completed_at=b.completed_at, notes=b.notes,
            supplier_name=supplier.name if supplier else None,
            base_name=base.name if base else None,
            order_ref=order.order_ref if order else None,
            eqp_count=order.eqp_count if order else None,
        ))
    return enriched


@router.post("/bookings/", response_model=BookingRead, status_code=201)
async def create_booking(
    data: BookingCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Reserver un creneau / Book a slot."""
    # Charger la commande
    order = await db.get(PurchaseOrder, data.purchase_order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Commande non trouvee")

    # Scope fournisseur : ne peut booker que ses propres commandes
    if user.supplier_id and order.supplier_id != user.supplier_id:
        raise HTTPException(status_code=403, detail="Acces interdit")

    if order.status != PurchaseOrderStatus.PENDING:
        raise HTTPException(status_code=400, detail="Cette commande est deja reservee ou traitee")

    # Charger config
    cfg_result = await db.execute(
        select(ReceptionConfig).where(ReceptionConfig.base_id == data.base_id)
    )
    cfg = cfg_result.scalar_one_or_none()
    if not cfg:
        raise HTTPException(status_code=400, detail="Pas de configuration reception pour cette base")

    # Calculer creneaux necessaires
    slots_needed = max(1, math.ceil(order.eqp_count / cfg.productivity_eqp_per_slot))
    end_time = _add_minutes(data.start_time, cfg.slot_duration_minutes * slots_needed)

    # Verifier disponibilite du quai pour tous les creneaux
    bookings_result = await db.execute(
        select(ReceptionBooking).where(
            ReceptionBooking.base_id == data.base_id,
            ReceptionBooking.booking_date == data.booking_date,
            ReceptionBooking.dock_number == data.dock_number,
            ReceptionBooking.status.notin_([BookingStatus.CANCELLED]),
        )
    )
    existing = bookings_result.scalars().all()

    new_start = _time_to_minutes(data.start_time)
    new_end = _time_to_minutes(end_time)

    for b in existing:
        b_start = _time_to_minutes(b.start_time)
        b_end = _time_to_minutes(b.end_time)
        if b_start < new_end and b_end > new_start:
            raise HTTPException(status_code=409, detail=f"Le quai {data.dock_number} est deja occupe de {b.start_time} a {b.end_time}")

    now = _now_iso()
    booking = ReceptionBooking(
        purchase_order_id=data.purchase_order_id,
        base_id=data.base_id,
        supplier_id=order.supplier_id,
        booking_date=data.booking_date,
        start_time=data.start_time,
        end_time=end_time,
        dock_number=data.dock_number,
        slots_needed=slots_needed,
        status=BookingStatus.BOOKED,
        created_at=now,
        notes=data.notes,
    )
    db.add(booking)

    # Mettre a jour le statut de la commande
    order.status = PurchaseOrderStatus.BOOKED
    await db.flush()

    supplier = await db.get(Supplier, booking.supplier_id)
    base = await db.get(BaseLogistics, booking.base_id)
    return BookingRead(
        id=booking.id, purchase_order_id=booking.purchase_order_id,
        base_id=booking.base_id, supplier_id=booking.supplier_id,
        booking_date=booking.booking_date, start_time=booking.start_time,
        end_time=booking.end_time, dock_number=booking.dock_number,
        slots_needed=booking.slots_needed,
        status="BOOKED", created_at=now,
        notes=booking.notes,
        supplier_name=supplier.name if supplier else None,
        base_name=base.name if base else None,
        order_ref=order.order_ref, eqp_count=order.eqp_count,
    )


@router.put("/bookings/{booking_id}", response_model=BookingRead)
async def update_booking(
    booking_id: int,
    data: BookingUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Modifier une reservation / Update a booking."""
    booking = await db.get(ReceptionBooking, booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Reservation non trouvee")

    if user.supplier_id and booking.supplier_id != user.supplier_id:
        raise HTTPException(status_code=403, detail="Acces interdit")

    now = _now_iso()

    if data.status is not None:
        new_status = BookingStatus(data.status)
        booking.status = new_status
        if new_status == BookingStatus.ARRIVED and not booking.arrived_at:
            booking.arrived_at = now
        elif new_status in (BookingStatus.COMPLETED, BookingStatus.NO_SHOW):
            booking.completed_at = now
            # Mettre a jour la commande
            order = await db.get(PurchaseOrder, booking.purchase_order_id)
            if order and new_status == BookingStatus.COMPLETED:
                order.status = PurchaseOrderStatus.RECEIVED
        elif new_status == BookingStatus.CANCELLED:
            order = await db.get(PurchaseOrder, booking.purchase_order_id)
            if order:
                order.status = PurchaseOrderStatus.PENDING  # Re-ouvrir pour re-booking

    if data.notes is not None:
        booking.notes = data.notes

    await db.flush()

    supplier = await db.get(Supplier, booking.supplier_id)
    base = await db.get(BaseLogistics, booking.base_id)
    order = await db.get(PurchaseOrder, booking.purchase_order_id)
    return BookingRead(
        id=booking.id, purchase_order_id=booking.purchase_order_id,
        base_id=booking.base_id, supplier_id=booking.supplier_id,
        booking_date=booking.booking_date, start_time=booking.start_time,
        end_time=booking.end_time, dock_number=booking.dock_number,
        slots_needed=booking.slots_needed,
        status=booking.status.value if isinstance(booking.status, BookingStatus) else booking.status,
        created_at=booking.created_at, arrived_at=booking.arrived_at,
        completed_at=booking.completed_at, notes=booking.notes,
        supplier_name=supplier.name if supplier else None,
        base_name=base.name if base else None,
        order_ref=order.order_ref if order else None,
        eqp_count=order.eqp_count if order else None,
    )
