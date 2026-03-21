"""Routes booking reception V2 / Supplier reception booking API routes V2.
Config quais par type, bookings, check-in, dock events, refusal, import XLS.
"""

import json
import math
import uuid
import calendar
from datetime import datetime, date as date_type, timezone
from typing import NamedTuple

from fastapi import APIRouter, Depends, HTTPException, Query, Request, UploadFile
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.reception_booking import (
    DockConfig, DockSchedule, DockScheduleOverride, DockType,
    Booking, BookingOrder, BookingCheckin, BookingDockEvent, BookingRefusal,
    BookingStatus, DockEventType, OrderImport, PickupStatus,
)
from app.models.carrier import Carrier
from app.models.base_logistics import BaseLogistics
from app.models.user import User
from app.models.audit import AuditLog
from app.schemas.reception_booking import (
    DockConfigCreate, DockConfigRead, DockConfigUpdate,
    DockScheduleOverrideCreate, DockScheduleOverrideRead, DockScheduleOverrideUpdate,
    DayAvailabilitySummary, SuggestedSlot, BookingKpi,
    BookingCreate, BookingRead, BookingUpdate, BookingMoveSlot, PickupAssign,
    BookingCheckinCreate, BookingCheckinRead,
    BookingRefusalCreate,
    SlotAvailability, OrderImportRead, OrderImportResult,
)
from app.api.deps import require_permission, get_current_user
from app.rate_limit import limiter

router = APIRouter()

DAY_LABELS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"]


async def _log_booking_audit(
    db: AsyncSession, booking_id: int, action: str, user: User,
    changes: dict | None = None,
) -> None:
    """Enregistrer une action booking / Log a booking action to audit."""
    db.add(AuditLog(
        entity_type="booking",
        entity_id=booking_id,
        action=action,
        changes=json.dumps(changes, ensure_ascii=False) if changes else None,
        user=user.username,
        timestamp=_now_iso(),
    ))


def _user_has_permission(user: User, resource: str, action: str) -> bool:
    """Verifier si l'utilisateur a une permission specifique / Check if user has a specific permission."""
    if user.is_superadmin:
        return True
    for role in user.roles:
        for perm in role.permissions:
            if (perm.resource == resource and perm.action == action) or (perm.resource == "*" and perm.action == "*"):
                return True
    return False


def _user_can_edit_booking(user: User, booking: Booking) -> bool:
    """Verifier si l'utilisateur peut modifier ce booking / Check if user can edit this booking.
    Createur du booking OU permission booking-appros:update OU superadmin.
    """
    if user.is_superadmin:
        return True
    if booking.created_by_user_id == user.id:
        return True
    return _user_has_permission(user, "booking-appros", "update")

# Polyvalence : FRAIS peut recevoir du GEL / FRAIS docks can receive GEL
DOCK_COMPAT = {DockType.FRAIS: [DockType.FRAIS, DockType.GEL]}


def _now_iso() -> str:
    """Heure locale Belgique / Local Belgian time."""
    from zoneinfo import ZoneInfo
    return datetime.now(ZoneInfo("Europe/Brussels")).isoformat(timespec="seconds")


def _add_minutes(time_str: str, minutes: int) -> str:
    h, m = map(int, time_str.split(":"))
    total = h * 60 + m + minutes
    return f"{total // 60:02d}:{total % 60:02d}"


def _time_to_minutes(time_str: str) -> int:
    h, m = map(int, time_str.split(":"))
    return h * 60 + m


class ResolvedSchedule(NamedTuple):
    """Horaire resolu pour une date donnee / Resolved schedule for a given date."""
    open_time: str
    close_time: str
    dock_count: int
    is_override: bool


def _resolve_schedule(cfg: DockConfig, date_str: str) -> ResolvedSchedule | None:
    """Resoudre l'horaire pour une date (override > template semaine) /
    Resolve schedule for a date (override takes precedence over weekly template)."""
    # Chercher un override pour cette date
    override = None
    for ov in (cfg.overrides if hasattr(cfg, 'overrides') and cfg.overrides else []):
        if ov.override_date == date_str:
            override = ov
            break

    if override and override.is_closed:
        return None  # Ferme ce jour / Closed this day

    # Template semaine / Weekly template
    d = date_type.fromisoformat(date_str)
    dow = (d.weekday())  # 0=Lundi
    schedule = None
    for s in (cfg.schedules or []):
        if s.day_of_week == dow:
            schedule = s
            break

    if not schedule and not override:
        return None  # Pas configure pour ce jour / Not configured for this day

    # Merger override + template
    open_t = (override.open_time if override and override.open_time else
              (schedule.open_time if schedule else None))
    close_t = (override.close_time if override and override.close_time else
               (schedule.close_time if schedule else None))
    dock_ct = (override.dock_count if override and override.dock_count is not None else
               cfg.dock_count)

    if not open_t or not close_t:
        return None

    return ResolvedSchedule(
        open_time=open_t, close_time=close_t,
        dock_count=dock_ct, is_override=override is not None,
    )


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
    user: User = Depends(get_current_user),
):
    """Lister les configs quais / List dock configs."""
    query = select(DockConfig).options(selectinload(DockConfig.schedules), selectinload(DockConfig.overrides))
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
    user: User = Depends(require_permission("booking-reception", "create")),
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
    user: User = Depends(require_permission("booking-reception", "update")),
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
    user: User = Depends(require_permission("booking-reception", "delete")),
):
    cfg = await db.get(DockConfig, config_id)
    if not cfg:
        raise HTTPException(status_code=404, detail="Config non trouvee")
    await db.delete(cfg)


# ─── Schedule Overrides CRUD (exceptions calendrier) ───

@router.get("/schedule-overrides/", response_model=list[DockScheduleOverrideRead])
async def list_schedule_overrides(
    base_id: int | None = None,
    dock_config_id: int | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Lister les exceptions horaires / List schedule overrides."""
    query = select(DockScheduleOverride)
    if dock_config_id:
        query = query.where(DockScheduleOverride.dock_config_id == dock_config_id)
    elif base_id:
        cfg_ids = (await db.execute(
            select(DockConfig.id).where(DockConfig.base_id == base_id)
        )).scalars().all()
        if cfg_ids:
            query = query.where(DockScheduleOverride.dock_config_id.in_(cfg_ids))
        else:
            return []
    if date_from:
        query = query.where(DockScheduleOverride.override_date >= date_from)
    if date_to:
        query = query.where(DockScheduleOverride.override_date <= date_to)
    result = await db.execute(query.order_by(DockScheduleOverride.override_date))
    return result.scalars().all()


@router.post("/schedule-overrides/", response_model=DockScheduleOverrideRead, status_code=201)
async def create_schedule_override(
    data: DockScheduleOverrideCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("booking-reception", "create")),
):
    """Creer une exception horaire / Create a schedule override."""
    cfg = await db.get(DockConfig, data.dock_config_id)
    if not cfg:
        raise HTTPException(status_code=404, detail="Config quai non trouvee")
    # Verifier doublon
    existing = await db.execute(
        select(DockScheduleOverride).where(
            DockScheduleOverride.dock_config_id == data.dock_config_id,
            DockScheduleOverride.override_date == data.override_date,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Une exception existe deja pour cette date et ce type de quai")
    ov = DockScheduleOverride(**data.model_dump())
    db.add(ov)
    await db.flush()
    return ov


@router.put("/schedule-overrides/{override_id}", response_model=DockScheduleOverrideRead)
async def update_schedule_override(
    override_id: int,
    data: DockScheduleOverrideUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("booking-reception", "update")),
):
    """Modifier une exception horaire / Update a schedule override."""
    ov = await db.get(DockScheduleOverride, override_id)
    if not ov:
        raise HTTPException(status_code=404, detail="Exception non trouvee")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(ov, k, v)
    await db.flush()
    return ov


@router.delete("/schedule-overrides/{override_id}", status_code=204)
async def delete_schedule_override(
    override_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("booking-reception", "delete")),
):
    """Supprimer une exception horaire / Delete a schedule override."""
    ov = await db.get(DockScheduleOverride, override_id)
    if not ov:
        raise HTTPException(status_code=404, detail="Exception non trouvee")
    await db.delete(ov)


# ─── Disponibilite calendrier / Calendar availability ───

@router.get("/calendar-availability/", response_model=list[DayAvailabilitySummary])
async def get_calendar_availability(
    base_id: int,
    year_month: str,
    dock_type: str | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Vue calendrier : dispo par jour et type de quai / Calendar view: availability per day and dock type."""
    # Parse mois
    try:
        year, month = int(year_month[:4]), int(year_month[5:7])
    except (ValueError, IndexError):
        raise HTTPException(status_code=422, detail="Format attendu: YYYY-MM")

    _, days_in_month = calendar.monthrange(year, month)
    date_from = f"{year:04d}-{month:02d}-01"
    date_to = f"{year:04d}-{month:02d}-{days_in_month:02d}"

    # Charger configs + overrides + bookings counts
    cfg_query = select(DockConfig).where(DockConfig.base_id == base_id).options(
        selectinload(DockConfig.schedules), selectinload(DockConfig.overrides)
    )
    if dock_type:
        cfg_query = cfg_query.where(DockConfig.dock_type == DockType(dock_type))
    cfgs = (await db.execute(cfg_query)).scalars().all()

    # Compter bookings par (date, dock_type)
    booking_query = (
        select(Booking.booking_date, Booking.dock_type,
               select(Booking.id).correlate(None).where(False).label("_"))  # placeholder
    )
    # Simplification : charger tous les bookings actifs du mois pour la base
    from sqlalchemy import func
    bk_stats = {}
    bk_result = await db.execute(
        select(
            Booking.booking_date, Booking.dock_type,
            func.count(Booking.id).label("cnt"),
            func.coalesce(func.sum(Booking.pallet_count), 0).label("pal"),
        )
        .where(
            Booking.base_id == base_id,
            Booking.booking_date >= date_from,
            Booking.booking_date <= date_to,
            Booking.status.notin_([BookingStatus.CANCELLED, BookingStatus.REFUSED]),
        )
        .group_by(Booking.booking_date, Booking.dock_type)
    )
    for row in bk_result:
        dt_val = row.dock_type.value if isinstance(row.dock_type, DockType) else row.dock_type
        bk_stats[(row.booking_date, dt_val)] = (row.cnt, row.pal)

    # Generer un DayAvailabilitySummary par (date, dock_type)
    result = []
    for day in range(1, days_in_month + 1):
        date_str = f"{year:04d}-{month:02d}-{day:02d}"
        for cfg in cfgs:
            resolved = _resolve_schedule(cfg, date_str)
            dt_val = cfg.dock_type.value if isinstance(cfg.dock_type, DockType) else cfg.dock_type
            bk_cnt, bk_pal = bk_stats.get((date_str, dt_val), (0, 0))

            if resolved is None:
                # Verifier si ferme par override ou juste pas configure
                has_ov = any(ov.override_date == date_str for ov in (cfg.overrides or []))
                result.append(DayAvailabilitySummary(
                    date=date_str, dock_type=dt_val,
                    is_closed=has_ov, open_time=None, close_time=None,
                    dock_count=0, has_override=has_ov,
                    booking_count=bk_cnt, pallet_total=bk_pal,
                ))
            else:
                result.append(DayAvailabilitySummary(
                    date=date_str, dock_type=dt_val,
                    is_closed=False,
                    open_time=resolved.open_time, close_time=resolved.close_time,
                    dock_count=resolved.dock_count, has_override=resolved.is_override,
                    booking_count=bk_cnt, pallet_total=bk_pal,
                ))
    return result


# ─── KPI / Stats ───

@router.get("/kpi/", response_model=BookingKpi)
async def get_booking_kpi(
    base_id: int,
    date_from: str,
    date_to: str,
    dock_type: str | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """KPI booking : taux exploitation, retards, temps d'attente / Booking KPIs."""
    from sqlalchemy import func as sqlfunc
    from zoneinfo import ZoneInfo

    # ── Charger configs pour calculer capacite theorique / Load configs for theoretical capacity ──
    cfg_query = select(DockConfig).where(DockConfig.base_id == base_id).options(
        selectinload(DockConfig.schedules), selectinload(DockConfig.overrides)
    )
    if dock_type:
        cfg_query = cfg_query.where(DockConfig.dock_type == DockType(dock_type))
    cfgs = (await db.execute(cfg_query)).scalars().all()

    # ── Charger tous les bookings de la periode / Load all bookings for the period ──
    bk_query = select(Booking).where(
        Booking.base_id == base_id,
        Booking.booking_date >= date_from,
        Booking.booking_date <= date_to,
    ).options(selectinload(Booking.checkin), selectinload(Booking.dock_events))
    if dock_type:
        bk_query = bk_query.where(Booking.dock_type == DockType(dock_type))
    all_bookings = (await bk_query.execute(bk_query) if False else
                    (await db.execute(bk_query)).scalars().all())

    # ── Capacite theorique par jour / Theoretical capacity per day ──
    MAX_PAL_PER_TRUCK = 33
    total_max_pallets = 0
    total_max_trucks = 0
    daily_capacity: dict[str, int] = {}  # date → max_pallets

    d_from = date_type.fromisoformat(date_from)
    d_to = date_type.fromisoformat(date_to)
    current = d_from
    while current <= d_to:
        date_str = current.isoformat()
        day_max_pal = 0
        day_max_trucks = 0
        for cfg in cfgs:
            resolved = _resolve_schedule(cfg, date_str)
            if not resolved:
                continue
            window_min = _time_to_minutes(resolved.close_time) - _time_to_minutes(resolved.open_time)
            if window_min <= 0:
                continue
            # Duree d'un camion 33 palettes sur ce type de quai
            dur_33 = _calc_duration(MAX_PAL_PER_TRUCK, cfg)
            if dur_33 <= 0:
                continue
            trucks_per_dock = window_min // dur_33
            day_trucks = trucks_per_dock * resolved.dock_count
            day_pal = day_trucks * MAX_PAL_PER_TRUCK
            day_max_pal += day_pal
            day_max_trucks += day_trucks

        daily_capacity[date_str] = day_max_pal
        total_max_pallets += day_max_pal
        total_max_trucks += day_max_trucks
        current = date_type.fromordinal(current.toordinal() + 1)

    # ── Stats reelles / Actual stats ──
    active_bookings = [b for b in all_bookings if b.status not in (BookingStatus.CANCELLED, BookingStatus.REFUSED, BookingStatus.NO_SHOW)]
    actual_pallets = sum(b.pallet_count for b in active_bookings)
    actual_trucks = len(active_bookings)

    utilization = (actual_pallets / total_max_pallets * 100) if total_max_pallets > 0 else 0.0

    # ── Temps d'attente et duree a quai / Wait times and dock duration ──
    wait_times: list[float] = []
    dock_times: list[float] = []
    delays: list[float] = []
    supplier_delays: dict[str, list[float]] = {}
    carrier_delays: dict[str, list[float]] = {}

    for b in all_bookings:
        if b.status in (BookingStatus.CANCELLED,):
            continue

        # Retard arrivee : checkin_time vs start_time prevu / Arrival delay
        if b.checkin and b.start_time:
            try:
                checkin_str = b.checkin.checkin_time
                # Extraire l'heure du timestamp ISO
                checkin_hour = checkin_str[11:16] if len(checkin_str) > 16 else checkin_str[:5]
                delay = _time_to_minutes(checkin_hour) - _time_to_minutes(b.start_time)
                delays.append(delay)
                # Par fournisseur
                supplier = b.supplier_name or 'Inconnu'
                supplier_delays.setdefault(supplier, []).append(delay)
                # Par plaque (transporteur)
                plate = b.checkin.license_plate or 'Inconnue'
                carrier_delays.setdefault(plate, []).append(delay)
            except (ValueError, IndexError):
                pass

        # Temps entre events dock / Time between dock events
        events = sorted(b.dock_events or [], key=lambda e: e.timestamp)
        ev_map: dict[str, str] = {}
        for ev in events:
            et = ev.event_type.value if hasattr(ev.event_type, 'value') else ev.event_type
            ev_map[et] = ev.timestamp

        # Attente : checkin → at_dock
        if b.checkin and 'AT_DOCK' in ev_map:
            try:
                ci_h = b.checkin.checkin_time[11:16]
                ad_h = ev_map['AT_DOCK'][11:16]
                wait = _time_to_minutes(ad_h) - _time_to_minutes(ci_h)
                if wait >= 0:
                    wait_times.append(wait)
            except (ValueError, IndexError):
                pass

        # Duree a quai : at_dock → dock_left ou departed
        dock_end_key = 'DOCK_LEFT' if 'DOCK_LEFT' in ev_map else ('DEPARTED' if 'DEPARTED' in ev_map else None)
        if 'AT_DOCK' in ev_map and dock_end_key:
            try:
                ad_h = ev_map['AT_DOCK'][11:16]
                dl_h = ev_map[dock_end_key][11:16]
                dur = _time_to_minutes(dl_h) - _time_to_minutes(ad_h)
                if dur >= 0:
                    dock_times.append(dur)
            except (ValueError, IndexError):
                pass

    avg_wait = round(sum(wait_times) / len(wait_times), 1) if wait_times else None
    avg_dock = round(sum(dock_times) / len(dock_times), 1) if dock_times else None
    avg_delay = round(sum(delays) / len(delays), 1) if delays else None

    # ── Top retardataires (retard moyen > 0) / Top latecomers ──
    late_suppliers = []
    for name, dlist in supplier_delays.items():
        avg_d = sum(dlist) / len(dlist)
        if avg_d > 0:
            late_suppliers.append({"name": name, "avg_delay_min": round(avg_d, 1), "count": len(dlist)})
    late_suppliers.sort(key=lambda x: -x["avg_delay_min"])

    late_carriers = []
    for plate, dlist in carrier_delays.items():
        avg_d = sum(dlist) / len(dlist)
        if avg_d > 0:
            late_carriers.append({"plate": plate, "avg_delay_min": round(avg_d, 1), "count": len(dlist)})
    late_carriers.sort(key=lambda x: -x["avg_delay_min"])

    # ── Stats par jour / Daily stats ──
    daily_stats = []
    bookings_by_date: dict[str, list] = {}
    for b in active_bookings:
        bookings_by_date.setdefault(b.booking_date, []).append(b)

    current = d_from
    while current <= d_to:
        ds = current.isoformat()
        day_bks = bookings_by_date.get(ds, [])
        day_pal = sum(b.pallet_count for b in day_bks)
        day_cap = daily_capacity.get(ds, 0)
        daily_stats.append({
            "date": ds,
            "pallets": day_pal,
            "trucks": len(day_bks),
            "utilization_pct": round(day_pal / day_cap * 100, 1) if day_cap > 0 else 0,
        })
        current = date_type.fromordinal(current.toordinal() + 1)

    # Compteurs statuts
    status_counts = {}
    for b in all_bookings:
        s = b.status.value if hasattr(b.status, 'value') else b.status
        status_counts[s] = status_counts.get(s, 0) + 1

    return BookingKpi(
        period_from=date_from, period_to=date_to,
        theoretical_max_pallets=total_max_pallets,
        actual_pallets=actual_pallets,
        utilization_pct=round(utilization, 1),
        theoretical_max_trucks=total_max_trucks,
        actual_trucks=actual_trucks,
        avg_wait_minutes=avg_wait,
        avg_dock_minutes=avg_dock,
        avg_delay_minutes=avg_delay,
        total_bookings=len(all_bookings),
        completed=status_counts.get('COMPLETED', 0),
        refused=status_counts.get('REFUSED', 0),
        no_show=status_counts.get('NO_SHOW', 0),
        cancelled=status_counts.get('CANCELLED', 0),
        late_suppliers=late_suppliers[:10],
        late_carriers=late_carriers[:10],
        daily_stats=daily_stats,
    )


# ─── Suggested slots (creneaux recommandes) ───

@router.get("/suggested-slots/", response_model=list[SuggestedSlot])
async def get_suggested_slots(
    base_id: int,
    date: str,
    dock_type: str,
    pallet_count: int,
    max_results: int = Query(default=3, le=10),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Proposer les meilleurs creneaux pour un booking / Suggest best slots for a booking.
    Score base sur : combler les trous, grouper sur peu de quais, debut de journee."""

    # Charger config + schedules + overrides
    cfg_result = await db.execute(
        select(DockConfig).where(
            DockConfig.base_id == base_id, DockConfig.dock_type == DockType(dock_type),
        ).options(selectinload(DockConfig.schedules), selectinload(DockConfig.overrides))
    )
    cfg = cfg_result.scalar_one_or_none()
    if not cfg:
        return []

    resolved = _resolve_schedule(cfg, date)
    if not resolved:
        return []

    duration = _calc_duration(pallet_count, cfg)
    dock_count = resolved.dock_count
    open_min = _time_to_minutes(resolved.open_time)
    close_min = _time_to_minutes(resolved.close_time)

    # Charger bookings existants du jour pour ce type / Load existing bookings
    bk_result = await db.execute(
        select(Booking).where(
            Booking.base_id == base_id,
            Booking.booking_date == date,
            Booking.dock_type == DockType(dock_type),
            Booking.status.notin_([BookingStatus.CANCELLED, BookingStatus.REFUSED]),
        )
    )
    existing = bk_result.scalars().all()

    # Construire occupation par quai : liste de (start_min, end_min) / Build occupation per dock
    dock_occ: dict[int, list[tuple[int, int]]] = {d: [] for d in range(1, dock_count + 1)}
    for b in existing:
        if b.dock_number and b.dock_number in dock_occ:
            dock_occ[b.dock_number].append((_time_to_minutes(b.start_time), _time_to_minutes(b.end_time)))
    for d in dock_occ:
        dock_occ[d].sort()

    # Scanner tous les slots possibles par pas de 15 min / Scan all possible slots in 15min steps
    candidates: list[tuple[int, int, int, str]] = []  # (score, start_min, dock_num, reason)

    for dock_num in range(1, dock_count + 1):
        occ = dock_occ[dock_num]
        slot_start = open_min

        while slot_start + duration <= close_min:
            slot_end = slot_start + duration

            # Verifier pas de collision / Check no collision
            collision = False
            for (bs, be) in occ:
                if bs < slot_end and be > slot_start:
                    collision = True
                    break
            if collision:
                slot_start += 15
                continue

            # ── Calcul du score / Score calculation ──
            score = 50  # Base
            reason_parts = []

            # 1. Accolé à un booking existant (pas de trou) → +20
            touches_before = any(be == slot_start for (_, be) in occ)
            touches_after = any(bs == slot_end for (bs, _) in occ)
            if touches_before and touches_after:
                score += 30
                reason_parts.append("comble un trou")
            elif touches_before or touches_after:
                score += 20
                reason_parts.append("accole")

            # 2. Debut de journee (premier slot) → +10
            if slot_start == open_min and not occ:
                score += 10
                reason_parts.append("debut journee")

            # 3. Quai le plus rempli (grouper) → +15 max
            fill_ratio = len(occ) / max(1, (close_min - open_min) // 15)
            if fill_ratio > 0.3:
                score += min(15, int(fill_ratio * 20))
                reason_parts.append("quai bien rempli")

            # 4. Eviter le debut (laisser marge) si deja des bookings → -5 pour le tout premier slot
            # 5. Penaliser les creneaux tardifs → -1 par heure apres midi
            hours_after_noon = max(0, (slot_start - 720) / 60)
            if hours_after_noon > 0:
                score -= min(10, int(hours_after_noon * 2))

            reason = ", ".join(reason_parts) if reason_parts else "creneau libre"
            candidates.append((score, slot_start, dock_num, reason))
            slot_start += 15

    # Trier par score desc, deduplicquer par heure (garder le meilleur quai) / Sort and deduplicate
    candidates.sort(key=lambda c: (-c[0], c[1]))
    seen_times: set[int] = set()
    results: list[SuggestedSlot] = []
    for score, start_min, dock_num, reason in candidates:
        if start_min in seen_times:
            continue
        seen_times.add(start_min)
        results.append(SuggestedSlot(
            start_time=f"{start_min // 60:02d}:{start_min % 60:02d}",
            end_time=f"{(start_min + duration) // 60:02d}:{(start_min + duration) % 60:02d}",
            dock_number=dock_num,
            score=min(100, max(0, score)),
            reason=reason,
        ))
        if len(results) >= max_results:
            break

    return results


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
        is_pickup=b.is_pickup or False, pickup_date=b.pickup_date,
        pickup_address=b.pickup_address, pickup_status=b.pickup_status,
        carrier_id=b.carrier_id,
        carrier_name=b.carrier.name if hasattr(b, 'carrier') and b.carrier else None,
        carrier_price=float(b.carrier_price) if b.carrier_price else None,
        carrier_ref=b.carrier_ref, pickup_notes=b.pickup_notes,
        is_internal_fleet=b.is_internal_fleet or False,
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
    user: User = Depends(require_permission("booking-appros", "create")),
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

    # Resoudre le nombre de quais (avec overrides) / Resolve dock count (with overrides)
    cfg_full = await db.execute(
        select(DockConfig).where(DockConfig.id == cfg.id)
        .options(selectinload(DockConfig.schedules), selectinload(DockConfig.overrides))
    )
    cfg_loaded = cfg_full.scalar_one()
    resolved = _resolve_schedule(cfg_loaded, data.booking_date)
    dock_count = resolved.dock_count if resolved else cfg.dock_count

    # Auto-assignation quai si non precise / Auto-assign dock if not specified
    dock_number = data.dock_number
    if not dock_number:
        dock_number = await _find_free_dock(
            db, data.base_id, data.booking_date, data.dock_type,
            data.start_time, end_time, dock_count,
        )
        if dock_number is None:
            raise HTTPException(status_code=409, detail=f"Aucun quai {data.dock_type} libre sur ce creneau ({data.start_time}-{end_time})")
    else:
        await _check_collision(db, data.base_id, data.booking_date, dock_number,
                               data.start_time, end_time, exclude_id=None)

    now = _now_iso()
    booking = Booking(
        base_id=data.base_id, dock_type=DockType(data.dock_type),
        dock_number=dock_number, booking_date=data.booking_date,
        start_time=data.start_time, end_time=end_time,
        pallet_count=data.pallet_count, estimated_duration_minutes=duration,
        status=BookingStatus.CONFIRMED,
        is_locked=data.is_locked, supplier_name=data.supplier_name,
        temperature_type=data.temperature_type, notes=data.notes,
        created_by_user_id=user.id, created_at=now,
        is_pickup=data.is_pickup,
        pickup_date=data.pickup_date if data.is_pickup else None,
        pickup_address=data.pickup_address if data.is_pickup else None,
        pickup_status=PickupStatus.PENDING.value if data.is_pickup else None,
    )
    db.add(booking)
    await db.flush()

    for order_data in data.orders:
        bo = BookingOrder(
            booking_id=booking.id, order_number=order_data.order_number,
            pallet_count=order_data.pallet_count, cnuf=order_data.cnuf,
            filiale=order_data.filiale, operation=order_data.operation,
            delivery_date_required=order_data.delivery_date_required,
            delivery_time_requested=order_data.delivery_time_requested,
            supplier_name=order_data.supplier_name,
        )
        db.add(bo)
        await db.flush()

        # Reconciliation inverse : enrichir depuis OrderImport si non reconcilie / Reverse reconcile
        oi_result = await db.execute(
            select(OrderImport).where(
                OrderImport.order_number == order_data.order_number,
                OrderImport.reconciled == False,
            ).limit(1)
        )
        oi = oi_result.scalar_one_or_none()
        if oi:
            bo.cnuf = bo.cnuf or oi.cnuf
            bo.filiale = bo.filiale or oi.filiale
            bo.operation = bo.operation or oi.operation
            bo.pallet_count = bo.pallet_count or oi.pallet_count
            bo.delivery_date_required = bo.delivery_date_required or oi.delivery_date
            bo.delivery_time_requested = bo.delivery_time_requested or oi.delivery_time
            bo.article_count = oi.article_count
            bo.supplier_name = bo.supplier_name or oi.supplier_name
            bo.reconciled = True
            oi.reconciled = True
            oi.booking_id = booking.id

    await db.flush()
    await _log_booking_audit(db, booking.id, "CREATE", user, {
        "dock_type": data.dock_type, "start_time": data.start_time,
        "pallet_count": data.pallet_count, "supplier": data.supplier_name,
    })
    await db.flush()
    result = await db.execute(
        select(Booking).where(Booking.id == booking.id)
        .options(selectinload(Booking.orders), selectinload(Booking.checkin),
                 selectinload(Booking.dock_events), selectinload(Booking.refusal))
    )
    return _booking_to_read(result.scalar_one())


async def _find_free_dock(db: AsyncSession, base_id: int, date: str, dock_type: str,
                          start_time: str, end_time: str, dock_count: int) -> int | None:
    """Trouver le premier quai libre / Find first available dock for the time slot."""
    result = await db.execute(
        select(Booking).where(
            Booking.base_id == base_id,
            Booking.booking_date == date,
            Booking.dock_type == DockType(dock_type),
            Booking.status.notin_([BookingStatus.CANCELLED, BookingStatus.REFUSED]),
        )
    )
    existing = result.scalars().all()
    new_start = _time_to_minutes(start_time)
    new_end = _time_to_minutes(end_time)

    for dock_num in range(1, dock_count + 1):
        is_free = True
        for b in existing:
            if b.dock_number != dock_num:
                continue
            b_start = _time_to_minutes(b.start_time)
            b_end = _time_to_minutes(b.end_time)
            if b_start < new_end and b_end > new_start:
                is_free = False
                break
        if is_free:
            return dock_num
    return None


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
    user: User = Depends(get_current_user),
):
    """Modifier un booking / Update a booking.
    Seul le createur ou un profil avec booking-appros:update peut modifier.
    """
    result = await db.execute(
        select(Booking).where(Booking.id == booking_id)
        .options(selectinload(Booking.orders), selectinload(Booking.checkin),
                 selectinload(Booking.dock_events), selectinload(Booking.refusal))
    )
    booking = result.scalar_one_or_none()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking non trouve")

    if not _user_can_edit_booking(user, booking):
        raise HTTPException(status_code=403, detail="Seul le createur ou un admin peut modifier ce booking")

    # Collecter les changements pour le log / Collect changes for audit
    changes: dict = {}

    if data.status is not None:
        changes["status"] = f"{booking.status} → {data.status}"
        booking.status = BookingStatus(data.status)
    if data.dock_number is not None:
        changes["dock_number"] = f"{booking.dock_number} → {data.dock_number}"
        booking.dock_number = data.dock_number
    if data.is_locked is not None:
        changes["is_locked"] = f"{booking.is_locked} → {data.is_locked}"
        booking.is_locked = data.is_locked
    if data.supplier_name is not None:
        changes["supplier_name"] = f"{booking.supplier_name} → {data.supplier_name}"
        booking.supplier_name = data.supplier_name
    if data.notes is not None:
        changes["notes"] = f"{booking.notes} → {data.notes}"
        booking.notes = data.notes
    if data.dock_type is not None:
        changes["dock_type"] = f"{booking.dock_type} → {data.dock_type}"
        booking.dock_type = DockType(data.dock_type)
    if data.booking_date is not None:
        changes["booking_date"] = f"{booking.booking_date} → {data.booking_date}"
        booking.booking_date = data.booking_date
    if data.start_time is not None:
        changes["start_time"] = f"{booking.start_time} → {data.start_time}"
        booking.start_time = data.start_time

    # Recalculer si palettes ou heure changent / Recalculate if pallets or time change
    need_recalc = False
    if data.pallet_count is not None and data.pallet_count != booking.pallet_count:
        changes["pallet_count"] = f"{booking.pallet_count} → {data.pallet_count}"
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

    if changes:
        await _log_booking_audit(db, booking_id, "UPDATE", user, changes)
    await db.flush()
    await db.refresh(booking, ["orders", "checkin", "dock_events", "refusal"])
    return _booking_to_read(booking)


@router.post("/bookings/{booking_id}/move", response_model=BookingRead)
async def move_booking(
    booking_id: int,
    data: BookingMoveSlot,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("booking-appros", "update")),
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
    user: User = Depends(get_current_user),
):
    booking = await db.get(Booking, booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking non trouve")
    if not _user_can_edit_booking(user, booking):
        raise HTTPException(status_code=403, detail="Seul le createur ou un admin peut supprimer ce booking")
    await _log_booking_audit(db, booking_id, "DELETE", user, {
        "supplier": booking.supplier_name, "dock_type": booking.dock_type.value if hasattr(booking.dock_type, 'value') else booking.dock_type,
        "date": booking.booking_date, "start_time": booking.start_time,
    })
    await db.delete(booking)
    await db.flush()


# ─── Groupage — Fusionner des bookings ───

@router.post("/bookings/{booking_id}/merge/{other_id}", response_model=BookingRead)
async def merge_bookings(
    booking_id: int,
    other_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("booking-appros", "update")),
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


# ─── Transport : gestion enlevements ───

@router.get("/pickups/", response_model=list[BookingRead])
async def list_pickups(
    base_id: int | None = None,
    pickup_status: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Lister les demandes d'enlevement / List pickup requests for transport team."""
    query = (
        select(Booking).where(Booking.is_pickup == True)
        .options(
            selectinload(Booking.orders), selectinload(Booking.checkin),
            selectinload(Booking.dock_events), selectinload(Booking.refusal),
        )
    )
    if base_id:
        query = query.where(Booking.base_id == base_id)
    if pickup_status:
        query = query.where(Booking.pickup_status == pickup_status)
    if date_from:
        query = query.where(Booking.pickup_date >= date_from)
    if date_to:
        query = query.where(Booking.pickup_date <= date_to)
    query = query.order_by(Booking.pickup_date.asc(), Booking.booking_date.asc())
    result = await db.execute(query)
    return [_booking_to_read(b) for b in result.scalars().all()]


@router.put("/pickups/{booking_id}/assign")
async def assign_pickup(
    booking_id: int,
    data: PickupAssign,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("booking-appros", "update")),
):
    """Assigner un transporteur a un enlevement / Assign carrier to a pickup."""
    booking = await db.get(Booking, booking_id)
    if not booking or not booking.is_pickup:
        raise HTTPException(status_code=404, detail="Enlevement non trouve")

    if data.carrier_id:
        carrier = await db.get(Carrier, data.carrier_id)
        if not carrier:
            raise HTTPException(status_code=404, detail="Transporteur non trouve")

    booking.carrier_id = data.carrier_id
    booking.is_internal_fleet = data.is_internal_fleet
    booking.carrier_price = data.carrier_price
    booking.carrier_ref = data.carrier_ref
    booking.pickup_notes = data.pickup_notes
    booking.pickup_status = PickupStatus.ASSIGNED.value

    await _log_booking_audit(db, booking_id, "PICKUP_ASSIGNED", user, {
        "carrier_id": data.carrier_id, "price": data.carrier_price,
        "internal": data.is_internal_fleet,
    })
    await db.flush()
    return {"ok": True}


@router.put("/pickups/{booking_id}/status")
async def update_pickup_status(
    booking_id: int,
    data: dict,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("booking-appros", "update")),
):
    """Mettre a jour le statut enlevement / Update pickup status."""
    booking = await db.get(Booking, booking_id)
    if not booking or not booking.is_pickup:
        raise HTTPException(status_code=404, detail="Enlevement non trouve")

    new_status = data.get("pickup_status")
    if new_status not in [s.value for s in PickupStatus]:
        raise HTTPException(status_code=422, detail=f"Statut invalide: {new_status}")

    old_status = booking.pickup_status
    booking.pickup_status = new_status

    await _log_booking_audit(db, booking_id, "PICKUP_STATUS", user, {
        "from": old_status, "to": new_status,
    })
    await db.flush()
    return {"ok": True}


# ─── Portail fournisseur (public) / Supplier portal (public) ───

@router.get("/supplier-portal/bases/")
async def supplier_portal_bases(db: AsyncSession = Depends(get_db)):
    """Liste des bases pour le portail fournisseur (public) / Bases list for supplier portal."""
    result = await db.execute(select(BaseLogistics).order_by(BaseLogistics.name))
    return [{"id": b.id, "code": b.code, "name": b.name} for b in result.scalars().all()]

@router.get("/supplier-portal/slots/")
async def supplier_portal_slots(
    base_id: int,
    date: str,
    dock_type: str,
    pallet_count: int,
    db: AsyncSession = Depends(get_db),
):
    """Creneaux disponibles pour le portail fournisseur (public) / Available slots for supplier portal."""
    cfg_result = await db.execute(
        select(DockConfig).where(
            DockConfig.base_id == base_id, DockConfig.dock_type == DockType(dock_type),
        ).options(selectinload(DockConfig.schedules), selectinload(DockConfig.overrides))
    )
    cfg = cfg_result.scalar_one_or_none()
    if not cfg:
        return []

    resolved = _resolve_schedule(cfg, date)
    if not resolved:
        return []

    duration = _calc_duration(pallet_count, cfg)
    dock_count = resolved.dock_count
    open_min = _time_to_minutes(resolved.open_time)
    close_min = _time_to_minutes(resolved.close_time)

    # Bookings existants / Existing bookings
    bk_result = await db.execute(
        select(Booking).where(
            Booking.base_id == base_id, Booking.booking_date == date,
            Booking.dock_type == DockType(dock_type),
            Booking.status.notin_([BookingStatus.CANCELLED, BookingStatus.REFUSED]),
        )
    )
    existing = bk_result.scalars().all()

    # Trouver les creneaux libres / Find free slots
    slots = []
    current = open_min
    while current + duration <= close_min:
        slot_end = current + duration
        # Verifier si au moins 1 quai libre / Check at least 1 dock free
        has_free_dock = False
        for dock_num in range(1, dock_count + 1):
            free = True
            for b in existing:
                if b.dock_number != dock_num:
                    continue
                if _time_to_minutes(b.start_time) < slot_end and _time_to_minutes(b.end_time) > current:
                    free = False
                    break
            if free:
                has_free_dock = True
                break
        if has_free_dock:
            slots.append({
                "start_time": f"{current // 60:02d}:{current % 60:02d}",
                "end_time": f"{slot_end // 60:02d}:{slot_end % 60:02d}",
                "duration_minutes": duration,
            })
        current += 15
    return slots


@router.post("/supplier-portal/book/")
@limiter.limit("10/minute")
async def supplier_portal_book(
    request: Request,
    data: dict,
    db: AsyncSession = Depends(get_db),
):
    """Creer un booking depuis le portail fournisseur (public) / Create booking from supplier portal."""
    required = ["base_id", "dock_type", "booking_date", "start_time", "pallet_count", "supplier_name"]
    for field in required:
        if not data.get(field):
            raise HTTPException(status_code=422, detail=f"Champ requis: {field}")

    base_id = int(data["base_id"])
    dock_type_str = data["dock_type"]
    booking_date = data["booking_date"]
    start_time = data["start_time"]
    pallet_count = int(data["pallet_count"])
    supplier_name = data["supplier_name"]
    order_number = data.get("order_number", "")
    notes = data.get("notes", "")

    cfg_result = await db.execute(
        select(DockConfig).where(
            DockConfig.base_id == base_id, DockConfig.dock_type == DockType(dock_type_str),
        ).options(selectinload(DockConfig.schedules), selectinload(DockConfig.overrides))
    )
    cfg = cfg_result.scalar_one_or_none()
    if not cfg:
        raise HTTPException(status_code=400, detail=f"Pas de config quai {dock_type_str} pour cette base")

    duration = _calc_duration(pallet_count, cfg)
    end_time = _add_minutes(start_time, duration)

    resolved = _resolve_schedule(cfg, booking_date)
    dock_count = resolved.dock_count if resolved else cfg.dock_count

    dock_number = await _find_free_dock(db, base_id, booking_date, dock_type_str, start_time, end_time, dock_count)
    if dock_number is None:
        raise HTTPException(status_code=409, detail="Aucun quai libre sur ce creneau")

    booking = Booking(
        base_id=base_id, dock_type=DockType(dock_type_str),
        dock_number=dock_number, booking_date=booking_date,
        start_time=start_time, end_time=end_time,
        pallet_count=pallet_count, estimated_duration_minutes=duration,
        status=BookingStatus.CONFIRMED,
        supplier_name=supplier_name, notes=notes or None,
        created_at=_now_iso(),
    )
    db.add(booking)
    await db.flush()

    if order_number:
        db.add(BookingOrder(booking_id=booking.id, order_number=order_number))
        await db.flush()

    return {
        "ok": True, "booking_id": booking.id,
        "dock_number": dock_number, "start_time": start_time, "end_time": end_time,
        "message": f"Booking confirme — Quai {dock_number}, {start_time}-{end_time}",
    }


# ─── Check-in borne chauffeur ───

@router.post("/checkin/", response_model=BookingCheckinRead, status_code=201)
@limiter.limit("20/minute")
async def driver_checkin(
    request: Request,
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
    user: User = Depends(require_permission("booking-reception", "update")),
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
    await _log_booking_audit(db, booking_id, "AT_DOCK", user, {"dock_number": dock_number})

    # Envoyer SMS au chauffeur avec le numero de quai / Send SMS to driver with dock number
    if booking.checkin and booking.checkin.phone_number:
        from app.api.sms import queue_sms
        base = await db.get(BaseLogistics, booking.base_id)
        base_name = base.name if base else "la base"
        sms_body = f"Quai {dock_number} - Presentez-vous au quai n{dock_number}. {base_name}. Ref: {booking.supplier_name or booking_id}"
        await queue_sms(db, booking.checkin.phone_number, sms_body, booking_id=booking_id)

    await db.flush()
    return {"ok": True}


@router.post("/bookings/{booking_id}/unloading")
async def mark_unloading(
    booking_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("booking-reception", "update")),
):
    """Debut dechargement / Start unloading (reception)."""
    booking = await db.get(Booking, booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking non trouve")
    if booking.status != BookingStatus.AT_DOCK:
        raise HTTPException(status_code=422, detail=f"Statut actuel: {booking.status.value} — doit etre AT_DOCK")

    booking.status = BookingStatus.UNLOADING
    db.add(BookingDockEvent(
        booking_id=booking_id, event_type=DockEventType.UNLOADING,
        dock_number=booking.dock_number, timestamp=_now_iso(), user_id=user.id,
    ))
    await _log_booking_audit(db, booking_id, "UNLOADING", user, {"dock_number": booking.dock_number})
    await db.flush()
    return {"ok": True}


@router.post("/bookings/{booking_id}/dock-left")
async def mark_dock_left(
    booking_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("booking-reception", "update")),
):
    """Parti du quai / Left dock (reception)."""
    booking = await db.get(Booking, booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking non trouve")
    if booking.status not in (BookingStatus.AT_DOCK, BookingStatus.UNLOADING):
        raise HTTPException(status_code=422, detail=f"Statut actuel: {booking.status.value} — doit etre AT_DOCK ou UNLOADING")

    booking.status = BookingStatus.DOCK_LEFT
    db.add(BookingDockEvent(
        booking_id=booking_id, event_type=DockEventType.DOCK_LEFT,
        dock_number=booking.dock_number, timestamp=_now_iso(), user_id=user.id,
    ))
    await _log_booking_audit(db, booking_id, "DOCK_LEFT", user, {"dock_number": booking.dock_number})
    await db.flush()
    return {"ok": True}


@router.post("/bookings/{booking_id}/site-departure")
async def mark_site_departure(
    booking_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("booking-gate", "update")),
):
    """Parti du site / Left site (guard post)."""
    booking = await db.get(Booking, booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking non trouve")
    if booking.status != BookingStatus.DOCK_LEFT:
        raise HTTPException(status_code=422, detail=f"Statut actuel: {booking.status.value} — doit etre DOCK_LEFT")

    booking.status = BookingStatus.COMPLETED
    db.add(BookingDockEvent(
        booking_id=booking_id, event_type=DockEventType.SITE_LEFT,
        dock_number=booking.dock_number, timestamp=_now_iso(), user_id=user.id,
    ))
    await _log_booking_audit(db, booking_id, "SITE_LEFT", user, {"dock_number": booking.dock_number})
    await db.flush()
    return {"ok": True}


# Legacy endpoint — garde la compatibilite / Keep backward compat
@router.post("/bookings/{booking_id}/departed")
async def mark_departed(
    booking_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("booking-reception", "update")),
):
    """LEGACY — redirige vers dock-left / Legacy — redirects to dock-left."""
    booking = await db.get(Booking, booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking non trouve")

    booking.status = BookingStatus.DOCK_LEFT
    db.add(BookingDockEvent(
        booking_id=booking_id, event_type=DockEventType.DOCK_LEFT,
        dock_number=booking.dock_number, timestamp=_now_iso(), user_id=user.id,
    ))
    await _log_booking_audit(db, booking_id, "DOCK_LEFT", user, {"dock_number": booking.dock_number})
    await db.flush()
    return {"ok": True}


# ─── Refus ───

@router.post("/bookings/{booking_id}/refuse")
async def refuse_booking(
    booking_id: int,
    data: BookingRefusalCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("booking-reception", "update")),
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
    await _log_booking_audit(db, booking_id, "REFUSED", user, {"reason": data.reason})
    await db.flush()
    return {"ok": True, "message": "Booking refuse — notification appro"}


# ─── Import commandes XLS ───

@router.post("/import-orders/", response_model=OrderImportResult)
async def import_orders(
    file: UploadFile,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("booking-appros", "create")),
):
    """Import du carnet de commandes XLS / Import order book XLS.
    Sheet 'Lst Rd Ouvert Detail', groupement par Rd."""
    import xlrd

    # Validation securite upload / Upload security validation
    if file.filename:
        ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""
        if ext not in ("xls", "xlsx"):
            raise HTTPException(status_code=400, detail="Type de fichier non autorise (xls/xlsx uniquement)")

    content = await file.read()
    if len(content) > 5 * 1024 * 1024:  # 5 Mo max
        raise HTTPException(status_code=400, detail="Fichier trop volumineux (max 5 Mo)")
    if len(content) < 100:
        raise HTTPException(status_code=400, detail="Fichier vide ou trop petit")

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
    from zoneinfo import ZoneInfo
    today = datetime.now(ZoneInfo("Europe/Brussels")).strftime("%Y-%m-%d")
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
    user: User = Depends(require_permission("booking-appros", "read")),
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
