"""Routes booking reception V2 / Supplier reception booking API routes V2.
Config quais par type, bookings, check-in, dock events, refusal, import XLS.
"""

import math
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.reception_booking import (
    DockConfig, DockSchedule, DockType,
    Booking, BookingOrder, BookingCheckin, BookingDockEvent, BookingRefusal,
    BookingStatus, DockEventType, OrderImport,
)
from app.models.base_logistics import BaseLogistics
from app.models.user import User
from app.schemas.reception_booking import (
    DockConfigCreate, DockConfigRead, DockConfigUpdate,
    BookingCreate, BookingRead, BookingUpdate, BookingMoveSlot,
    BookingCheckinCreate, BookingCheckinRead,
    BookingRefusalCreate,
    SlotAvailability, OrderImportRead, OrderImportResult,
)
from app.api.deps import require_permission, get_current_user

router = APIRouter()

DAY_LABELS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"]

# Polyvalence : FRAIS peut recevoir du GEL / FRAIS docks can receive GEL
DOCK_COMPAT = {DockType.FRAIS: [DockType.FRAIS, DockType.GEL]}


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _add_minutes(time_str: str, minutes: int) -> str:
    h, m = map(int, time_str.split(":"))
    total = h * 60 + m + minutes
    return f"{total // 60:02d}:{total % 60:02d}"


def _time_to_minutes(time_str: str) -> int:
    h, m = map(int, time_str.split(":"))
    return h * 60 + m


def _calc_duration(pallet_count: int, config: DockConfig) -> int:
    """Calculer duree creneau / Calculate slot duration.
    duree = setup + (palettes / productivite_h * 60) + depart, arrondi 15 min sup.
    """
    unloading = (pallet_count / config.pallets_per_hour) * 60
    raw = config.setup_minutes + unloading + config.departure_minutes
    return int(math.ceil(raw / 15) * 15)


# ─── DockConfig CRUD ───

@router.get("/dock-configs/", response_model=list[DockConfigRead])
async def list_dock_configs(
    base_id: int | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("reception-booking", "read")),
):
    """Lister les configs quais / List dock configs."""
    query = select(DockConfig).options(selectinload(DockConfig.schedules))
    if base_id:
        query = query.where(DockConfig.base_id == base_id)
    result = await db.execute(query)
    configs = result.scalars().all()
    enriched = []
    for cfg in configs:
        base = await db.get(BaseLogistics, cfg.base_id)
        dt = cfg.dock_type.value if isinstance(cfg.dock_type, DockType) else cfg.dock_type
        enriched.append(DockConfigRead(
            id=cfg.id, base_id=cfg.base_id, dock_type=dt,
            dock_count=cfg.dock_count, pallets_per_hour=cfg.pallets_per_hour,
            setup_minutes=cfg.setup_minutes, departure_minutes=cfg.departure_minutes,
            schedules=[{
                "id": s.id, "dock_config_id": s.dock_config_id,
                "day_of_week": s.day_of_week, "open_time": s.open_time, "close_time": s.close_time,
            } for s in cfg.schedules],
            base_name=base.name if base else None,
        ))
    return enriched


@router.post("/dock-configs/", response_model=DockConfigRead, status_code=201)
async def create_dock_config(
    data: DockConfigCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("reception-booking", "create")),
):
    """Creer une config quai / Create dock config."""
    existing = await db.execute(
        select(DockConfig).where(
            DockConfig.base_id == data.base_id,
            DockConfig.dock_type == DockType(data.dock_type),
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail=f"Config {data.dock_type} existe deja pour cette base")

    cfg = DockConfig(
        base_id=data.base_id, dock_type=DockType(data.dock_type),
        dock_count=data.dock_count, pallets_per_hour=data.pallets_per_hour,
        setup_minutes=data.setup_minutes, departure_minutes=data.departure_minutes,
    )
    db.add(cfg)
    await db.flush()

    for sched in data.schedules:
        db.add(DockSchedule(
            dock_config_id=cfg.id, day_of_week=sched.day_of_week,
            open_time=sched.open_time, close_time=sched.close_time,
        ))
    await db.flush()

    base = await db.get(BaseLogistics, cfg.base_id)
    await db.refresh(cfg, ["schedules"])
    return DockConfigRead(
        id=cfg.id, base_id=cfg.base_id, dock_type=data.dock_type,
        dock_count=cfg.dock_count, pallets_per_hour=cfg.pallets_per_hour,
        setup_minutes=cfg.setup_minutes, departure_minutes=cfg.departure_minutes,
        schedules=[{
            "id": s.id, "dock_config_id": s.dock_config_id,
            "day_of_week": s.day_of_week, "open_time": s.open_time, "close_time": s.close_time,
        } for s in cfg.schedules],
        base_name=base.name if base else None,
    )


@router.put("/dock-configs/{config_id}", response_model=DockConfigRead)
async def update_dock_config(
    config_id: int,
    data: DockConfigUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("reception-booking", "update")),
):
    """Modifier une config quai / Update dock config."""
    cfg = await db.get(DockConfig, config_id, options=[selectinload(DockConfig.schedules)])
    if not cfg:
        raise HTTPException(status_code=404, detail="Config non trouvee")

    if data.dock_count is not None:
        cfg.dock_count = data.dock_count
    if data.pallets_per_hour is not None:
        cfg.pallets_per_hour = data.pallets_per_hour
    if data.setup_minutes is not None:
        cfg.setup_minutes = data.setup_minutes
    if data.departure_minutes is not None:
        cfg.departure_minutes = data.departure_minutes

    if data.schedules is not None:
        await db.execute(delete(DockSchedule).where(DockSchedule.dock_config_id == config_id))
        for sched in data.schedules:
            db.add(DockSchedule(
                dock_config_id=config_id, day_of_week=sched.day_of_week,
                open_time=sched.open_time, close_time=sched.close_time,
            ))

    await db.flush()
    await db.refresh(cfg, ["schedules"])
    base = await db.get(BaseLogistics, cfg.base_id)
    dt = cfg.dock_type.value if isinstance(cfg.dock_type, DockType) else cfg.dock_type
    return DockConfigRead(
        id=cfg.id, base_id=cfg.base_id, dock_type=dt,
        dock_count=cfg.dock_count, pallets_per_hour=cfg.pallets_per_hour,
        setup_minutes=cfg.setup_minutes, departure_minutes=cfg.departure_minutes,
        schedules=[{
            "id": s.id, "dock_config_id": s.dock_config_id,
            "day_of_week": s.day_of_week, "open_time": s.open_time, "close_time": s.close_time,
        } for s in cfg.schedules],
        base_name=base.name if base else None,
    )


@router.delete("/dock-configs/{config_id}", status_code=204)
async def delete_dock_config(
    config_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("reception-booking", "delete")),
):
    cfg = await db.get(DockConfig, config_id)
    if not cfg:
        raise HTTPException(status_code=404, detail="Config non trouvee")
    await db.delete(cfg)


# ─── Slot availability ───

@router.get("/availability/", response_model=list[SlotAvailability])
async def get_slot_availability(
    base_id: int,
    date: str,
    dock_type: str | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Creneaux disponibles par type de quai / Available slots per dock type."""
    # Jour de la semaine (0=Lundi) / Day of week
    from datetime import date as date_type
    d = date_type.fromisoformat(date)
    dow = d.weekday()  # 0=Monday

    query = select(DockConfig).where(DockConfig.base_id == base_id).options(selectinload(DockConfig.schedules))
    if dock_type:
        query = query.where(DockConfig.dock_type == DockType(dock_type))
    result = await db.execute(query)
    configs = result.scalars().all()

    # Bookings existants pour ce jour / Existing bookings for this date
    bookings_result = await db.execute(
        select(Booking).where(
            Booking.base_id == base_id,
            Booking.booking_date == date,
            Booking.status.notin_([BookingStatus.CANCELLED, BookingStatus.REFUSED]),
        )
    )
    bookings = bookings_result.scalars().all()

    slots = []
    for cfg in configs:
        dt = cfg.dock_type.value if isinstance(cfg.dock_type, DockType) else cfg.dock_type
        # Trouver les horaires du jour / Find schedule for this day
        schedule = next((s for s in cfg.schedules if s.day_of_week == dow), None)
        if not schedule:
            continue

        opening = _time_to_minutes(schedule.open_time)
        closing = _time_to_minutes(schedule.close_time)

        current = opening
        while current + 15 <= closing:
            start = f"{current // 60:02d}:{current % 60:02d}"
            end = f"{(current + 15) // 60:02d}:{(current + 15) % 60:02d}"

            # Trouver les quais occupes (meme type ou compatible)
            occupied_docks = set()
            for b in bookings:
                b_dt = b.dock_type.value if isinstance(b.dock_type, DockType) else b.dock_type
                if b_dt != dt:
                    # Check compatibilite FRAIS/GEL
                    compat = DOCK_COMPAT.get(DockType(dt), [DockType(dt)])
                    if DockType(b_dt) not in compat:
                        continue
                if b.dock_number is None:
                    continue
                b_start = _time_to_minutes(b.start_time)
                b_end = _time_to_minutes(b.end_time)
                if b_start < current + 15 and b_end > current:
                    occupied_docks.add(b.dock_number)

            available = [d for d in range(1, cfg.dock_count + 1) if d not in occupied_docks]
            slots.append(SlotAvailability(
                start_time=start, end_time=end, dock_type=dt,
                available_docks=available, total_docks=cfg.dock_count,
            ))

            current += 15

    return slots


# ─── Bookings CRUD ───

@router.get("/bookings/", response_model=list[BookingRead])
async def list_bookings(
    base_id: int | None = None,
    date: str | None = None,
    dock_type: str | None = None,
    status_filter: str | None = Query(None, alias="status"),
    limit: int = Query(default=200, le=2000),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Lister les bookings / List bookings."""
    query = (
        select(Booking)
        .options(
            selectinload(Booking.orders),
            selectinload(Booking.checkin),
            selectinload(Booking.dock_events),
            selectinload(Booking.refusal),
        )
    )
    if base_id:
        query = query.where(Booking.base_id == base_id)
    if date:
        query = query.where(Booking.booking_date == date)
    if dock_type:
        query = query.where(Booking.dock_type == DockType(dock_type))
    if status_filter:
        query = query.where(Booking.status == BookingStatus(status_filter))

    query = query.order_by(Booking.booking_date.asc(), Booking.start_time.asc())
    query = query.offset(offset).limit(limit)

    result = await db.execute(query)
    return [_booking_to_read(b) for b in result.scalars().all()]


def _booking_to_read(b: Booking) -> BookingRead:
    return BookingRead(
        id=b.id, base_id=b.base_id,
        dock_type=b.dock_type.value if isinstance(b.dock_type, DockType) else b.dock_type,
        dock_number=b.dock_number, booking_date=b.booking_date,
        start_time=b.start_time, end_time=b.end_time,
        pallet_count=b.pallet_count,
        estimated_duration_minutes=b.estimated_duration_minutes,
        status=b.status.value if isinstance(b.status, BookingStatus) else b.status,
        is_locked=b.is_locked, supplier_name=b.supplier_name,
        temperature_type=b.temperature_type, notes=b.notes,
        created_by_user_id=b.created_by_user_id, created_at=b.created_at,
        orders=[{
            "id": o.id, "booking_id": o.booking_id, "order_number": o.order_number,
            "pallet_count": o.pallet_count, "cnuf": o.cnuf, "filiale": o.filiale,
            "operation": o.operation, "delivery_date_required": o.delivery_date_required,
            "delivery_time_requested": o.delivery_time_requested,
            "supplier_name": o.supplier_name, "article_count": o.article_count,
            "reconciled": o.reconciled,
        } for o in (b.orders or [])],
        checkin={
            "id": b.checkin.id, "booking_id": b.checkin.booking_id,
            "license_plate": b.checkin.license_plate, "phone_number": b.checkin.phone_number,
            "driver_name": b.checkin.driver_name, "checkin_time": b.checkin.checkin_time,
        } if b.checkin else None,
        dock_events=[{
            "id": e.id, "booking_id": e.booking_id,
            "event_type": e.event_type.value if isinstance(e.event_type, DockEventType) else e.event_type,
            "dock_number": e.dock_number, "timestamp": e.timestamp, "user_id": e.user_id,
        } for e in (b.dock_events or [])],
        refusal={
            "id": b.refusal.id, "booking_id": b.refusal.booking_id,
            "reason": b.refusal.reason, "refused_by_user_id": b.refusal.refused_by_user_id,
            "timestamp": b.refusal.timestamp, "notes": b.refusal.notes,
        } if b.refusal else None,
    )


@router.post("/bookings/", response_model=BookingRead, status_code=201)
async def create_booking(
    data: BookingCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("reception-booking", "create")),
):
    """Creer un booking / Create a booking."""
    # Charger config du type de quai / Load dock type config
    cfg_result = await db.execute(
        select(DockConfig).where(
            DockConfig.base_id == data.base_id,
            DockConfig.dock_type == DockType(data.dock_type),
        )
    )
    cfg = cfg_result.scalar_one_or_none()

    # Fallback : FRAIS pour du GEL (polyvalence)
    if not cfg and data.dock_type == "GEL":
        cfg_result = await db.execute(
            select(DockConfig).where(
                DockConfig.base_id == data.base_id,
                DockConfig.dock_type == DockType.FRAIS,
            )
        )
        cfg = cfg_result.scalar_one_or_none()

    if not cfg:
        raise HTTPException(status_code=400, detail=f"Pas de config quai {data.dock_type} pour cette base")

    duration = _calc_duration(data.pallet_count, cfg)
    end_time = _add_minutes(data.start_time, duration)

    # Verifier collision si dock_number specifie / Check collision if dock specified
    if data.dock_number:
        await _check_collision(db, data.base_id, data.booking_date, data.dock_number,
                               data.start_time, end_time, exclude_id=None)

    now = _now_iso()
    booking = Booking(
        base_id=data.base_id, dock_type=DockType(data.dock_type),
        dock_number=data.dock_number, booking_date=data.booking_date,
        start_time=data.start_time, end_time=end_time,
        pallet_count=data.pallet_count, estimated_duration_minutes=duration,
        status=BookingStatus.CONFIRMED if data.dock_number else BookingStatus.DRAFT,
        is_locked=data.is_locked, supplier_name=data.supplier_name,
        temperature_type=data.temperature_type, notes=data.notes,
        created_by_user_id=user.id, created_at=now,
    )
    db.add(booking)
    await db.flush()

    for order_data in data.orders:
        db.add(BookingOrder(
            booking_id=booking.id, order_number=order_data.order_number,
            pallet_count=order_data.pallet_count, cnuf=order_data.cnuf,
            filiale=order_data.filiale, operation=order_data.operation,
            delivery_date_required=order_data.delivery_date_required,
            delivery_time_requested=order_data.delivery_time_requested,
            supplier_name=order_data.supplier_name,
        ))

    await db.flush()
    result = await db.execute(
        select(Booking).where(Booking.id == booking.id)
        .options(selectinload(Booking.orders), selectinload(Booking.checkin),
                 selectinload(Booking.dock_events), selectinload(Booking.refusal))
    )
    return _booking_to_read(result.scalar_one())


async def _check_collision(db: AsyncSession, base_id: int, date: str, dock_number: int,
                           start_time: str, end_time: str, exclude_id: int | None):
    """Verifier collision sur un quai / Check dock collision."""
    query = select(Booking).where(
        Booking.base_id == base_id,
        Booking.booking_date == date,
        Booking.dock_number == dock_number,
        Booking.status.notin_([BookingStatus.CANCELLED, BookingStatus.REFUSED]),
    )
    if exclude_id:
        query = query.where(Booking.id != exclude_id)
    result = await db.execute(query)
    existing = result.scalars().all()

    new_start = _time_to_minutes(start_time)
    new_end = _time_to_minutes(end_time)
    for b in existing:
        b_start = _time_to_minutes(b.start_time)
        b_end = _time_to_minutes(b.end_time)
        if b_start < new_end and b_end > new_start:
            raise HTTPException(
                status_code=409,
                detail=f"Quai {dock_number} occupe de {b.start_time} a {b.end_time}"
            )


@router.put("/bookings/{booking_id}", response_model=BookingRead)
async def update_booking(
    booking_id: int,
    data: BookingUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("reception-booking", "update")),
):
    """Modifier un booking / Update a booking."""
    result = await db.execute(
        select(Booking).where(Booking.id == booking_id)
        .options(selectinload(Booking.orders), selectinload(Booking.checkin),
                 selectinload(Booking.dock_events), selectinload(Booking.refusal))
    )
    booking = result.scalar_one_or_none()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking non trouve")

    if data.status is not None:
        booking.status = BookingStatus(data.status)
    if data.dock_number is not None:
        booking.dock_number = data.dock_number
    if data.is_locked is not None:
        booking.is_locked = data.is_locked
    if data.supplier_name is not None:
        booking.supplier_name = data.supplier_name
    if data.notes is not None:
        booking.notes = data.notes
    if data.dock_type is not None:
        booking.dock_type = DockType(data.dock_type)
    if data.booking_date is not None:
        booking.booking_date = data.booking_date
    if data.start_time is not None:
        booking.start_time = data.start_time

    # Recalculer si palettes ou heure changent / Recalculate if pallets or time change
    need_recalc = False
    if data.pallet_count is not None and data.pallet_count != booking.pallet_count:
        booking.pallet_count = data.pallet_count
        need_recalc = True
    if data.start_time is not None or data.dock_type is not None:
        need_recalc = True

    if need_recalc:
        cfg_result = await db.execute(
            select(DockConfig).where(
                DockConfig.base_id == booking.base_id,
                DockConfig.dock_type == booking.dock_type,
            )
        )
        cfg = cfg_result.scalar_one_or_none()
        if cfg:
            duration = _calc_duration(booking.pallet_count, cfg)
            booking.estimated_duration_minutes = duration
            booking.end_time = _add_minutes(booking.start_time, duration)

    await db.flush()
    await db.refresh(booking, ["orders", "checkin", "dock_events", "refusal"])
    return _booking_to_read(booking)


@router.post("/bookings/{booking_id}/move", response_model=BookingRead)
async def move_booking(
    booking_id: int,
    data: BookingMoveSlot,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("reception-booking", "update")),
):
    """Deplacer un booking (drag & drop) / Move a booking (drag & drop)."""
    result = await db.execute(
        select(Booking).where(Booking.id == booking_id)
        .options(selectinload(Booking.orders), selectinload(Booking.checkin),
                 selectinload(Booking.dock_events), selectinload(Booking.refusal))
    )
    booking = result.scalar_one_or_none()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking non trouve")

    if booking.is_locked:
        raise HTTPException(status_code=422, detail="Booking verrouille (risque rupture) — non deplacable")

    end_time = _add_minutes(data.start_time, booking.estimated_duration_minutes)

    if data.dock_number:
        await _check_collision(db, booking.base_id, data.booking_date, data.dock_number,
                               data.start_time, end_time, exclude_id=booking.id)

    booking.booking_date = data.booking_date
    booking.start_time = data.start_time
    booking.end_time = end_time
    if data.dock_number is not None:
        booking.dock_number = data.dock_number

    await db.flush()
    await db.refresh(booking, ["orders", "checkin", "dock_events", "refusal"])
    return _booking_to_read(booking)


@router.delete("/bookings/{booking_id}", status_code=204)
async def delete_booking(
    booking_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("reception-booking", "delete")),
):
    booking = await db.get(Booking, booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking non trouve")
    await db.delete(booking)


# ─── Groupage — Fusionner des bookings ───

@router.post("/bookings/{booking_id}/merge/{other_id}", response_model=BookingRead)
async def merge_bookings(
    booking_id: int,
    other_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("reception-booking", "update")),
):
    """Grouper un booking dans un autre / Merge booking into another."""
    main_result = await db.execute(
        select(Booking).where(Booking.id == booking_id)
        .options(selectinload(Booking.orders), selectinload(Booking.checkin),
                 selectinload(Booking.dock_events), selectinload(Booking.refusal))
    )
    main = main_result.scalar_one_or_none()
    other = await db.get(Booking, other_id, options=[selectinload(Booking.orders)])
    if not main or not other:
        raise HTTPException(status_code=404, detail="Booking non trouve")

    # Transferer les commandes vers le booking principal / Transfer orders to main booking
    for order in other.orders:
        order.booking_id = main.id

    # Recalculer palettes + duree / Recalculate pallets + duration
    main.pallet_count += other.pallet_count
    cfg_result = await db.execute(
        select(DockConfig).where(
            DockConfig.base_id == main.base_id,
            DockConfig.dock_type == main.dock_type,
        )
    )
    cfg = cfg_result.scalar_one_or_none()
    if cfg:
        duration = _calc_duration(main.pallet_count, cfg)
        main.estimated_duration_minutes = duration
        main.end_time = _add_minutes(main.start_time, duration)

    other.status = BookingStatus.CANCELLED
    other.notes = f"Fusionne dans booking #{main.id}"

    await db.flush()
    await db.refresh(main, ["orders", "checkin", "dock_events", "refusal"])
    return _booking_to_read(main)


# ─── Check-in borne chauffeur ───

@router.post("/checkin/", response_model=BookingCheckinRead, status_code=201)
async def driver_checkin(
    data: BookingCheckinCreate,
    db: AsyncSession = Depends(get_db),
):
    """Check-in chauffeur a la borne / Driver check-in at kiosk.
    Pas d'auth — endpoint public pour la borne."""
    # Trouver le booking par numero de commande / Find booking by order number
    order_result = await db.execute(
        select(BookingOrder).where(BookingOrder.order_number == data.order_number)
    )
    order = order_result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Numero de commande non trouve")

    booking = await db.get(Booking, order.booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Reservation non trouvee")

    if booking.status not in (BookingStatus.DRAFT, BookingStatus.CONFIRMED):
        raise HTTPException(status_code=422, detail=f"Statut actuel: {booking.status.value} — check-in impossible")

    now = _now_iso()
    checkin = BookingCheckin(
        booking_id=booking.id, license_plate=data.license_plate,
        phone_number=data.phone_number, driver_name=data.driver_name,
        checkin_time=now,
    )
    db.add(checkin)
    booking.status = BookingStatus.CHECKED_IN
    await db.flush()

    return BookingCheckinRead(
        id=checkin.id, booking_id=checkin.booking_id,
        license_plate=checkin.license_plate, phone_number=checkin.phone_number,
        driver_name=checkin.driver_name, checkin_time=checkin.checkin_time,
    )


# ─── Dock events (reception) ───

@router.post("/bookings/{booking_id}/at-dock")
async def mark_at_dock(
    booking_id: int,
    data: dict,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("reception-booking", "update")),
):
    """Chauffeur a quai / Driver at dock."""
    booking = await db.get(Booking, booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking non trouve")

    dock_number = data.get("dock_number", booking.dock_number)
    if not dock_number:
        raise HTTPException(status_code=422, detail="Numero de quai requis")

    booking.dock_number = dock_number
    booking.status = BookingStatus.AT_DOCK

    db.add(BookingDockEvent(
        booking_id=booking_id, event_type=DockEventType.AT_DOCK,
        dock_number=dock_number, timestamp=_now_iso(), user_id=user.id,
    ))
    await db.flush()
    return {"ok": True}


@router.post("/bookings/{booking_id}/departed")
async def mark_departed(
    booking_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("reception-booking", "update")),
):
    """Chauffeur parti du quai / Driver departed from dock."""
    booking = await db.get(Booking, booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking non trouve")

    booking.status = BookingStatus.COMPLETED
    db.add(BookingDockEvent(
        booking_id=booking_id, event_type=DockEventType.DEPARTED,
        dock_number=booking.dock_number, timestamp=_now_iso(), user_id=user.id,
    ))
    await db.flush()
    return {"ok": True}


# ─── Refus ───

@router.post("/bookings/{booking_id}/refuse")
async def refuse_booking(
    booking_id: int,
    data: BookingRefusalCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("reception-booking", "update")),
):
    """Refuser un booking (motif obligatoire) / Refuse a booking (reason mandatory)."""
    booking = await db.get(Booking, booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking non trouve")

    booking.status = BookingStatus.REFUSED
    db.add(BookingRefusal(
        booking_id=booking_id, reason=data.reason,
        refused_by_user_id=user.id, timestamp=_now_iso(),
        notes=data.notes,
    ))
    await db.flush()
    return {"ok": True, "message": "Booking refuse — notification appro"}


# ─── Import commandes XLS ───

@router.post("/import-orders/", response_model=OrderImportResult)
async def import_orders(
    file: UploadFile,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("reception-booking", "create")),
):
    """Import du carnet de commandes XLS / Import order book XLS.
    Sheet 'Lst Rd Ouvert Detail', groupement par Rd."""
    import xlrd

    content = await file.read()
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Fichier trop volumineux (max 10 Mo)")

    try:
        wb = xlrd.open_workbook(file_contents=content)
    except Exception:
        raise HTTPException(status_code=400, detail="Fichier XLS invalide")

    sheet_name = "Lst Rd Ouvert Detail"
    if sheet_name not in wb.sheet_names():
        sheet_name = wb.sheet_names()[0]

    s = wb.sheet_by_name(sheet_name)
    if s.nrows < 2:
        raise HTTPException(status_code=400, detail="Fichier vide")

    # Lire les headers / Read headers
    headers = [str(s.cell_value(0, c)).strip().lower() for c in range(s.ncols)]
    col_map = {}
    for i, h in enumerate(headers):
        if "base" in h:
            col_map["base"] = i
        elif h == "rd":
            col_map["rd"] = i
        elif "cnuf" in h:
            col_map["cnuf"] = i
        elif "filiale" in h:
            col_map["filiale"] = i
        elif "operation" in h:
            col_map["operation"] = i
        elif "nbpalco" in h:
            col_map["nbpalco"] = i
        elif "date" in h and "livr" in h:
            col_map["date"] = i
        elif "hdebliv" in h:
            col_map["hdebliv"] = i
        elif "itm8" in h:
            col_map["itm8"] = i

    if "rd" not in col_map:
        raise HTTPException(status_code=400, detail="Colonne 'Rd' non trouvee")

    # Grouper par Rd / Group by Rd
    orders_dict: dict[str, dict] = {}
    errors = []
    for r in range(1, s.nrows):
        try:
            rd = str(s.cell_value(r, col_map["rd"])).strip()
            if not rd:
                continue

            base_code = str(s.cell_value(r, col_map.get("base", 0))).strip() if "base" in col_map else ""
            cnuf = str(s.cell_value(r, col_map.get("cnuf", 0))).strip() if "cnuf" in col_map else ""
            filiale = str(s.cell_value(r, col_map.get("filiale", 0))).strip() if "filiale" in col_map else ""
            operation = str(s.cell_value(r, col_map.get("operation", 0))).strip() if "operation" in col_map else ""

            nbpalco = 0
            if "nbpalco" in col_map:
                v = s.cell_value(r, col_map["nbpalco"])
                nbpalco = int(float(v)) if v else 0

            delivery_date = None
            if "date" in col_map:
                dv = s.cell_value(r, col_map["date"])
                if dv:
                    try:
                        dt = xlrd.xldate_as_datetime(float(dv), wb.datemode)
                        delivery_date = dt.strftime("%Y-%m-%d")
                    except Exception:
                        delivery_date = str(dv)

            hdebliv = None
            if "hdebliv" in col_map:
                hv = str(s.cell_value(r, col_map["hdebliv"])).strip()
                if hv and len(hv) >= 3:
                    hv = hv.replace(".", "").zfill(4)
                    hdebliv = f"{hv[:2]}:{hv[2:4]}"

            if rd not in orders_dict:
                orders_dict[rd] = {
                    "base_code": base_code or orders_dict.get(rd, {}).get("base_code", ""),
                    "rd": rd, "cnuf": cnuf, "filiale": filiale, "operation": operation,
                    "pallet_count": 0, "delivery_date": delivery_date,
                    "delivery_time": hdebliv, "article_count": 0,
                }
            else:
                # Completer les champs vides / Fill empty fields
                if base_code and not orders_dict[rd]["base_code"]:
                    orders_dict[rd]["base_code"] = base_code
                if cnuf and not orders_dict[rd]["cnuf"]:
                    orders_dict[rd]["cnuf"] = cnuf
                if filiale and not orders_dict[rd]["filiale"]:
                    orders_dict[rd]["filiale"] = filiale

            orders_dict[rd]["pallet_count"] += nbpalco
            orders_dict[rd]["article_count"] += 1

        except Exception as e:
            errors.append(f"Ligne {r + 1}: {e}")

    # Inserer / Insert
    batch_id = str(uuid.uuid4())[:8]
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    imported = 0
    reconciled = 0

    for rd, data_dict in orders_dict.items():
        oi = OrderImport(
            import_batch_id=batch_id,
            base_code=data_dict["base_code"],
            order_number=rd,
            cnuf=data_dict["cnuf"],
            filiale=data_dict["filiale"],
            operation=data_dict["operation"],
            pallet_count=data_dict["pallet_count"],
            delivery_date=data_dict["delivery_date"],
            delivery_time=data_dict["delivery_time"],
            article_count=data_dict["article_count"],
            import_date=today,
        )

        # Reconciliation : chercher un BookingOrder avec ce numero / Reconcile with existing booking
        bo_result = await db.execute(
            select(BookingOrder).where(BookingOrder.order_number == rd)
        )
        bo = bo_result.scalar_one_or_none()
        if bo:
            bo.cnuf = data_dict["cnuf"]
            bo.filiale = data_dict["filiale"]
            bo.operation = data_dict["operation"]
            bo.pallet_count = data_dict["pallet_count"]
            bo.delivery_date_required = data_dict["delivery_date"]
            bo.delivery_time_requested = data_dict["delivery_time"]
            bo.article_count = data_dict["article_count"]
            bo.reconciled = True
            oi.reconciled = True
            oi.booking_id = bo.booking_id
            reconciled += 1

        db.add(oi)
        imported += 1

    await db.flush()

    return OrderImportResult(
        imported=imported, reconciled=reconciled, errors=errors, batch_id=batch_id,
    )


@router.get("/imports/", response_model=list[OrderImportRead])
async def list_imports(
    batch_id: str | None = None,
    reconciled: bool | None = None,
    limit: int = Query(default=200, le=2000),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("reception-booking", "read")),
):
    """Lister les imports / List imported orders."""
    query = select(OrderImport)
    if batch_id:
        query = query.where(OrderImport.import_batch_id == batch_id)
    if reconciled is not None:
        query = query.where(OrderImport.reconciled == reconciled)
    query = query.order_by(OrderImport.id.desc()).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()
