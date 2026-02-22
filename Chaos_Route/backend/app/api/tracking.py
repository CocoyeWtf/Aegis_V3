"""Routes suivi temps reel web / Real-time web tracking routes."""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.delivery_alert import DeliveryAlert
from app.models.gps_position import GPSPosition
from app.models.pdv import PDV
from app.models.stop_event import StopEvent
from app.models.tour import Tour, TourStatus
from app.models.tour_stop import TourStop
from app.models.base_logistics import BaseLogistics
from app.models.user import User
from app.schemas.mobile import DeliveryAlertRead, DriverPositionRead, GPSPositionRead, TrackingDashboard
from app.api.deps import require_permission, get_user_region_ids

router = APIRouter()


@router.get("/positions", response_model=list[DriverPositionRead])
async def get_latest_positions(
    date: str | None = None,
    base_id: int | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("tracking", "read")),
):
    """Derniere position GPS par tour actif / Latest GPS position per active tour."""
    target_date = date or datetime.now(timezone.utc).strftime("%Y-%m-%d")

    # Trouver les tours actifs / Find active tours
    query = select(Tour).where(
        Tour.delivery_date == target_date,
        Tour.status.in_([TourStatus.IN_PROGRESS, TourStatus.VALIDATED, TourStatus.RETURNING]),
    )
    if base_id is not None:
        query = query.where(Tour.base_id == base_id)

    # Scope region
    region_ids = get_user_region_ids(user)
    if region_ids is not None:
        query = query.join(BaseLogistics, Tour.base_id == BaseLogistics.id).where(
            BaseLogistics.region_id.in_(region_ids)
        )

    result = await db.execute(query)
    tours = result.scalars().all()

    positions = []
    for tour in tours:
        # Derniere position GPS / Latest GPS position
        gps_result = await db.execute(
            select(GPSPosition)
            .where(GPSPosition.tour_id == tour.id)
            .order_by(GPSPosition.timestamp.desc())
            .limit(1)
        )
        gps = gps_result.scalar_one_or_none()
        if not gps:
            continue

        # Compter les stops livres / Count delivered stops
        stops_total = await db.scalar(
            select(func.count(TourStop.id)).where(TourStop.tour_id == tour.id)
        ) or 0
        stops_delivered = await db.scalar(
            select(func.count(TourStop.id)).where(
                TourStop.tour_id == tour.id,
                TourStop.delivery_status == "DELIVERED",
            )
        ) or 0

        positions.append(DriverPositionRead(
            tour_id=tour.id,
            tour_code=tour.code,
            driver_name=tour.driver_name,
            latitude=gps.latitude,
            longitude=gps.longitude,
            speed=gps.speed,
            accuracy=gps.accuracy,
            timestamp=gps.timestamp,
            stops_total=stops_total,
            stops_delivered=stops_delivered,
        ))

    return positions


@router.get("/tour/{tour_id}/trail", response_model=list[GPSPositionRead])
async def get_tour_trail(
    tour_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("tracking", "read")),
):
    """Trace GPS complete d'un tour / Full GPS trail for a tour."""
    result = await db.execute(
        select(GPSPosition)
        .where(GPSPosition.tour_id == tour_id)
        .order_by(GPSPosition.timestamp)
    )
    return result.scalars().all()


@router.get("/tour/{tour_id}/events")
async def get_tour_events(
    tour_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("tracking", "read")),
):
    """Tous les stop events d'un tour / All stop events for a tour."""
    # Trouver les stop_ids du tour
    stops_result = await db.execute(
        select(TourStop.id).where(TourStop.tour_id == tour_id)
    )
    stop_ids = [row[0] for row in stops_result.all()]
    if not stop_ids:
        return []

    result = await db.execute(
        select(StopEvent)
        .where(StopEvent.tour_stop_id.in_(stop_ids))
        .order_by(StopEvent.timestamp)
    )
    events = result.scalars().all()
    return [
        {
            "id": e.id,
            "tour_stop_id": e.tour_stop_id,
            "event_type": e.event_type.value if hasattr(e.event_type, "value") else e.event_type,
            "scanned_pdv_code": e.scanned_pdv_code,
            "latitude": e.latitude,
            "longitude": e.longitude,
            "timestamp": e.timestamp,
            "notes": e.notes,
            "forced": e.forced,
        }
        for e in events
    ]


@router.get("/alerts", response_model=list[DeliveryAlertRead])
async def get_alerts(
    date: str | None = None,
    severity: str | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("tracking", "read")),
):
    """Alertes actives / Active alerts."""
    query = select(DeliveryAlert).where(DeliveryAlert.acknowledged_at.is_(None))
    if severity is not None:
        query = query.where(DeliveryAlert.severity == severity)
    if date is not None:
        # Filtrer par date de creation / Filter by creation date
        query = query.where(DeliveryAlert.created_at.like(f"{date}%"))
    query = query.order_by(DeliveryAlert.created_at.desc())
    result = await db.execute(query)
    return result.scalars().all()


@router.put("/alerts/{alert_id}/acknowledge", response_model=DeliveryAlertRead)
async def acknowledge_alert(
    alert_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("tracking", "update")),
):
    """Acquitter une alerte / Acknowledge an alert."""
    alert = await db.get(DeliveryAlert, alert_id)
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    alert.acknowledged_at = datetime.now(timezone.utc).isoformat(timespec="seconds")
    alert.acknowledged_by = user.id
    await db.flush()
    return alert


@router.get("/active-stops")
async def get_active_stops(
    date: str | None = None,
    base_id: int | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("tracking", "read")),
):
    """Stops des tours actifs avec infos PDV / Active tour stops with PDV info."""
    target_date = date or datetime.now(timezone.utc).strftime("%Y-%m-%d")

    # Meme filtre que get_latest_positions / Same filter as get_latest_positions
    query = (
        select(Tour)
        .where(
            Tour.delivery_date == target_date,
            Tour.status.in_([TourStatus.IN_PROGRESS, TourStatus.VALIDATED, TourStatus.RETURNING]),
        )
        .options(selectinload(Tour.stops).selectinload(TourStop.pdv))
    )
    if base_id is not None:
        query = query.where(Tour.base_id == base_id)

    # Scope region
    region_ids = get_user_region_ids(user)
    if region_ids is not None:
        query = query.join(BaseLogistics, Tour.base_id == BaseLogistics.id).where(
            BaseLogistics.region_id.in_(region_ids)
        )

    result = await db.execute(query)
    tours = result.scalars().unique().all()

    data = []
    for tour in tours:
        stops_data = []
        for stop in tour.stops:
            pdv = stop.pdv
            stops_data.append({
                "stop_id": stop.id,
                "sequence_order": stop.sequence_order,
                "delivery_status": stop.delivery_status or "PENDING",
                "arrival_time": stop.arrival_time,
                "eqp_count": stop.eqp_count,
                "pdv_code": pdv.code if pdv else None,
                "pdv_name": pdv.name if pdv else None,
                "pdv_city": pdv.city if pdv else None,
                "pdv_latitude": pdv.latitude if pdv else None,
                "pdv_longitude": pdv.longitude if pdv else None,
                "pdv_delivery_window_start": pdv.delivery_window_start if pdv else None,
                "pdv_delivery_window_end": pdv.delivery_window_end if pdv else None,
            })
        data.append({
            "tour_id": tour.id,
            "tour_code": tour.code,
            "driver_name": tour.driver_name,
            "departure_time": tour.departure_time,
            "stops": stops_data,
        })

    return data


@router.get("/dashboard", response_model=TrackingDashboard)
async def get_dashboard(
    date: str | None = None,
    base_id: int | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("tracking", "read")),
):
    """Stats resume (actifs, completes, retards, alertes) / Dashboard summary stats."""
    target_date = date or datetime.now(timezone.utc).strftime("%Y-%m-%d")

    base_query = select(Tour).where(Tour.delivery_date == target_date)
    if base_id is not None:
        base_query = base_query.where(Tour.base_id == base_id)

    # Scope region
    region_ids = get_user_region_ids(user)
    if region_ids is not None:
        base_query = base_query.join(BaseLogistics, Tour.base_id == BaseLogistics.id).where(
            BaseLogistics.region_id.in_(region_ids)
        )

    result = await db.execute(base_query)
    tours = result.scalars().all()

    active = sum(1 for t in tours if t.status in (TourStatus.IN_PROGRESS, TourStatus.VALIDATED, TourStatus.RETURNING))
    completed = sum(1 for t in tours if t.status == TourStatus.COMPLETED)

    # Alertes actives non acquittees
    alert_count = await db.scalar(
        select(func.count(DeliveryAlert.id)).where(
            DeliveryAlert.acknowledged_at.is_(None),
            DeliveryAlert.created_at.like(f"{target_date}%"),
        )
    ) or 0

    return TrackingDashboard(
        active_tours=active,
        completed_tours=completed,
        delayed_tours=0,  # Sera calcule plus tard / Will be computed later
        active_alerts=alert_count,
    )
