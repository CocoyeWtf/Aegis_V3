"""Endpoints mobile chauffeur / Mobile driver endpoints.

Auth par appareil (X-Device-ID header) — pas de JWT pour le chauffeur.
"""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request

from app.config import settings
from app.rate_limit import limiter
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.audit import AuditLog
from app.models.delivery_alert import AlertSeverity, AlertType, DeliveryAlert
from app.models.device_assignment import DeviceAssignment
from app.models.gps_position import GPSPosition
from app.models.mobile_device import MobileDevice
from app.models.pdv import PDV
from app.models.stop_event import StopEvent, StopEventType
from app.models.support_scan import SupportScan
from app.models.tour import Tour, TourStatus
from app.models.tour_stop import TourStop
from app.models.base_logistics import BaseLogistics
from app.models.contract import Contract
from app.models.pickup_request import PickupLabel, PickupRequest, LabelStatus
from app.schemas.mobile import (
    AvailableTourRead,
    DriverTourRead,
    DriverTourStopRead,
    GPSBatchCreate,
    PickupRefusalCreate,
    PickupSummaryItem,
    ReturnToBaseCreate,
    SelfAssignCreate,
    StopClosureCreate,
    StopEventCreate,
    SupportScanCreate,
    SupportScanRead,
)
from app.schemas.pickup import PickupLabelRead
from app.api.deps import get_authenticated_device, require_device_tour_access
from app.api.ws_tracking import manager

router = APIRouter()


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _build_tour_stops(
    stops: list, pdv_map: dict[int, "PDV"],
    support_counts: dict[int, int] | None = None,
    pickup_label_counts: dict[int, int] | None = None,
    pickup_summary_map: dict[int, list[PickupSummaryItem]] | None = None,
) -> list[DriverTourStopRead]:
    """Construire la liste de stops pour le chauffeur / Build driver stop list."""
    counts = support_counts or {}
    plcounts = pickup_label_counts or {}
    ps_map = pickup_summary_map or {}
    result = []
    for s in sorted(stops, key=lambda x: x.sequence_order):
        pdv = pdv_map.get(s.pdv_id)
        result.append(DriverTourStopRead(
            id=s.id,
            sequence_order=s.sequence_order,
            eqp_count=s.eqp_count,
            pdv_code=pdv.code if pdv else None,
            pdv_name=pdv.name if pdv else None,
            pdv_address=pdv.address if pdv else None,
            pdv_city=pdv.city if pdv else None,
            pdv_latitude=pdv.latitude if pdv else None,
            pdv_longitude=pdv.longitude if pdv else None,
            delivery_status=s.delivery_status or "PENDING",
            arrival_time=s.arrival_time,
            departure_time=s.departure_time,
            actual_arrival_time=s.actual_arrival_time,
            actual_departure_time=s.actual_departure_time,
            pickup_cardboard=s.pickup_cardboard,
            pickup_containers=s.pickup_containers,
            pickup_returns=s.pickup_returns,
            pickup_consignment=getattr(s, "pickup_consignment", False),
            scanned_supports_count=counts.get(s.id, 0),
            pending_pickup_labels_count=plcounts.get(s.id, 0),
            pickup_summary=ps_map.get(s.id, []),
        ))
    return result


async def _build_tour_read(tour: Tour, db: AsyncSession) -> DriverTourRead:
    """Construire la vue tour complete / Build full tour read view."""
    from collections import defaultdict
    from app.models.support_type import SupportType

    base = await db.get(BaseLogistics, tour.base_id)
    contract = await db.get(Contract, tour.contract_id) if tour.contract_id else None

    pdv_ids = [s.pdv_id for s in tour.stops]
    pdv_map: dict[int, PDV] = {}
    if pdv_ids:
        pdv_result = await db.execute(select(PDV).where(PDV.id.in_(pdv_ids)))
        pdv_map = {p.id: p for p in pdv_result.scalars().all()}

    # Compter les supports scannes par stop / Count scanned supports per stop
    stop_ids = [s.id for s in tour.stops]
    support_counts: dict[int, int] = {}
    pickup_label_counts: dict[int, int] = {}
    pickup_summary_map: dict[int, list[PickupSummaryItem]] = {}
    if stop_ids:
        from sqlalchemy import func, case
        count_result = await db.execute(
            select(SupportScan.tour_stop_id, func.count(SupportScan.id))
            .where(SupportScan.tour_stop_id.in_(stop_ids))
            .group_by(SupportScan.tour_stop_id)
        )
        support_counts = dict(count_result.all())

        # Compter les etiquettes de reprise par stop / Count pickup labels per stop
        pl_result = await db.execute(
            select(PickupLabel.tour_stop_id, func.count(PickupLabel.id))
            .where(
                PickupLabel.tour_stop_id.in_(stop_ids),
                PickupLabel.status.in_([LabelStatus.PLANNED, LabelStatus.PENDING]),
            )
            .group_by(PickupLabel.tour_stop_id)
        )
        pickup_label_counts = dict(pl_result.all())

        # Resume reprises par (stop, type support) / Pickup summary per (stop, support type)
        summary_result = await db.execute(
            select(
                PickupLabel.tour_stop_id,
                SupportType.code,
                SupportType.name,
                func.count(PickupLabel.id).label("total"),
                func.sum(case(
                    (PickupLabel.status.in_([LabelStatus.PLANNED, LabelStatus.PENDING]), 1),
                    else_=0,
                )).label("pending"),
            )
            .join(PickupRequest, PickupLabel.pickup_request_id == PickupRequest.id)
            .join(SupportType, PickupRequest.support_type_id == SupportType.id)
            .where(PickupLabel.tour_stop_id.in_(stop_ids))
            .group_by(PickupLabel.tour_stop_id, SupportType.code, SupportType.name)
        )
        summary_raw: dict[int, list[PickupSummaryItem]] = defaultdict(list)
        for row in summary_result.all():
            summary_raw[row[0]].append(PickupSummaryItem(
                support_type_code=row[1],
                support_type_name=row[2],
                total_labels=row[3],
                pending_labels=row[4],
            ))
        pickup_summary_map = dict(summary_raw)

    status_val = tour.status.value if hasattr(tour.status, "value") else tour.status
    return DriverTourRead(
        id=tour.id,
        code=tour.code,
        date=tour.date,
        delivery_date=tour.delivery_date,
        departure_time=tour.departure_time,
        return_time=tour.return_time,
        total_eqp=tour.total_eqp,
        status=status_val,
        base_code=base.code if base else None,
        base_name=base.name if base else None,
        vehicle_code=contract.vehicle_code if contract else None,
        vehicle_name=contract.vehicle_name if contract else None,
        stops=_build_tour_stops(tour.stops, pdv_map, support_counts, pickup_label_counts, pickup_summary_map),
    )


@router.get("/my-tours", response_model=list[DriverTourRead])
async def my_tours(
    date: str | None = None,
    db: AsyncSession = Depends(get_db),
    device: MobileDevice = Depends(get_authenticated_device),
):
    """Tours assignes a cet appareil / Tours assigned to this device."""
    target_date = date or datetime.now(timezone.utc).strftime("%Y-%m-%d")

    # Chercher via DeviceAssignment + filtre par date du TOUR (pas de l'assignment)
    # pour cohérence avec available-tours qui cherche par Tour.delivery_date/date
    assignment_result = await db.execute(
        select(DeviceAssignment.tour_id)
        .join(Tour, Tour.id == DeviceAssignment.tour_id)
        .where(
            DeviceAssignment.device_id == device.id,
            or_(Tour.delivery_date == target_date, Tour.date == target_date),
        )
    )
    tour_ids = [row[0] for row in assignment_result.all()]

    if not tour_ids:
        return []

    result = await db.execute(
        select(Tour)
        .where(Tour.id.in_(tour_ids))
        .options(selectinload(Tour.stops))
    )
    tours = result.scalars().all()

    return [await _build_tour_read(tour, db) for tour in tours]


@router.get("/available-tours", response_model=list[AvailableTourRead])
async def available_tours(
    date: str | None = None,
    db: AsyncSession = Depends(get_db),
    device: MobileDevice = Depends(get_authenticated_device),
):
    """Tours disponibles pour affectation / Available tours for assignment.

    Retourne les tours VALIDATED de la meme base que l'appareil, non encore affectes.
    """
    target_date = date or datetime.now(timezone.utc).strftime("%Y-%m-%d")

    # Tours deja affectes (filtre par date du TOUR, coherent avec my-tours)
    assigned_result = await db.execute(
        select(DeviceAssignment.tour_id)
        .join(Tour, Tour.id == DeviceAssignment.tour_id)
        .where(or_(Tour.delivery_date == target_date, Tour.date == target_date))
    )
    assigned_tour_ids = {row[0] for row in assigned_result.all()}

    # Tours DRAFT ou VALIDATED pour cette date et cette base / DRAFT or VALIDATED tours for this date and base
    # Chercher par delivery_date OU date (fallback si delivery_date NULL)
    query = select(Tour).where(
        or_(Tour.delivery_date == target_date, Tour.date == target_date),
        Tour.status.in_([TourStatus.DRAFT, TourStatus.VALIDATED]),
    )
    if device.base_id:
        query = query.where(Tour.base_id == device.base_id)

    result = await db.execute(query.options(selectinload(Tour.stops)))
    tours = result.scalars().all()

    available = []
    for tour in tours:
        if tour.id in assigned_tour_ids:
            continue
        contract = await db.get(Contract, tour.contract_id) if tour.contract_id else None
        available.append(AvailableTourRead(
            id=tour.id,
            code=tour.code,
            delivery_date=tour.delivery_date,
            departure_time=tour.departure_time,
            total_eqp=tour.total_eqp,
            stops_count=len(tour.stops),
            driver_name=tour.driver_name,
            vehicle_code=contract.vehicle_code if contract else None,
        ))
    return available


@router.post("/assign-tour", response_model=DriverTourRead)
async def assign_tour(
    data: SelfAssignCreate,
    db: AsyncSession = Depends(get_db),
    device: MobileDevice = Depends(get_authenticated_device),
):
    """Affecter un tour a cet appareil / Assign a tour to this device."""
    tour = await db.get(Tour, data.tour_id, options=[selectinload(Tour.stops)])
    if not tour:
        raise HTTPException(status_code=404, detail="Tour not found")

    if tour.status not in (TourStatus.DRAFT, TourStatus.VALIDATED):
        raise HTTPException(status_code=422, detail="Tour already in progress or completed")

    # Verifier que le tour appartient a la base de l'appareil / Verify tour belongs to device's base
    if device.base_id and tour.base_id != device.base_id:
        raise HTTPException(status_code=403, detail="Tour does not belong to this device's base")

    # Auto-valider si DRAFT / Auto-validate if DRAFT
    if tour.status == TourStatus.DRAFT:
        tour.status = TourStatus.VALIDATED

    target_date = tour.delivery_date or tour.date

    # Verifier pas deja affecte / Check not already assigned
    existing = await db.execute(
        select(DeviceAssignment).where(
            DeviceAssignment.tour_id == data.tour_id,
            DeviceAssignment.date == target_date,
        ).limit(1)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Tour already assigned to a device")

    # Utiliser le nom chauffeur du tour si pas fourni / Use tour driver_name if not provided
    driver = data.driver_name or tour.driver_name

    assignment = DeviceAssignment(
        device_id=device.id,
        tour_id=data.tour_id,
        date=target_date,
        driver_name=driver,
        assigned_at=datetime.now(timezone.utc).isoformat(timespec="seconds"),
    )
    db.add(assignment)
    await db.flush()

    tour.device_assignment_id = assignment.id

    # 5A. Audit log — self-assign tour
    db.add(AuditLog(
        entity_type="tour", entity_id=tour.id, action="SELF_ASSIGN",
        changes=f'{{"device_id":{device.id},"device_name":"{device.friendly_name or ""}","driver":"{driver or ""}","tour_code":"{tour.code}"}}',
        user=f"device:{device.id}",
        timestamp=_now_iso(),
    ))

    await db.flush()

    return await _build_tour_read(tour, db)


@router.get("/tour/{tour_id}", response_model=DriverTourRead)
async def get_driver_tour(
    tour_id: int,
    db: AsyncSession = Depends(get_db),
    device: MobileDevice = Depends(require_device_tour_access),
):
    """Detail tour + stops + PDV / Tour detail for driver."""
    result = await db.execute(
        select(Tour).where(Tour.id == tour_id).options(selectinload(Tour.stops))
    )
    tour = result.scalar_one_or_none()
    if not tour:
        raise HTTPException(status_code=404, detail="Tour not found")

    return await _build_tour_read(tour, db)


@router.post("/gps")
@limiter.limit(settings.RATE_LIMIT_GPS)
async def submit_gps_batch(
    request: Request,
    data: GPSBatchCreate,
    db: AsyncSession = Depends(get_db),
    device: MobileDevice = Depends(get_authenticated_device),
):
    """Batch GPS positions / Batch insert GPS positions."""
    # Verifier que l'appareil est assigne a ce tour / Verify device is assigned to this tour
    assignment_result = await db.execute(
        select(DeviceAssignment).where(
            DeviceAssignment.tour_id == data.tour_id,
            DeviceAssignment.device_id == device.id,
        ).limit(1)
    )
    if not assignment_result.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Device not assigned to this tour")

    positions = []
    for pos in data.positions:
        gps = GPSPosition(
            device_id=device.id,
            tour_id=data.tour_id,
            latitude=pos.latitude,
            longitude=pos.longitude,
            accuracy=pos.accuracy,
            speed=pos.speed,
            timestamp=pos.timestamp,
        )
        db.add(gps)
        positions.append({
            "latitude": pos.latitude,
            "longitude": pos.longitude,
            "speed": pos.speed,
            "accuracy": pos.accuracy,
            "timestamp": pos.timestamp,
        })
    await db.flush()

    # Broadcast WebSocket
    tour = await db.get(Tour, data.tour_id)
    if positions:
        last = positions[-1]
        await manager.broadcast({
            "type": "gps_update",
            "tour_id": data.tour_id,
            "tour_code": tour.code if tour else "",
            "driver_name": tour.driver_name if tour else "",
            "latitude": last["latitude"],
            "longitude": last["longitude"],
            "speed": last["speed"],
            "timestamp": last["timestamp"],
        })

    return {"inserted": len(data.positions)}


@router.post("/tour/{tour_id}/stops/{stop_id}/scan-pdv")
async def scan_pdv(
    tour_id: int,
    stop_id: int,
    data: StopEventCreate,
    db: AsyncSession = Depends(get_db),
    device: MobileDevice = Depends(require_device_tour_access),
):
    """Scan QR PDV -> valide code vs attendu / Scan PDV QR code -> validate against expected."""
    stop = await db.get(TourStop, stop_id)
    if not stop or stop.tour_id != tour_id:
        raise HTTPException(status_code=404, detail="Stop not found")

    pdv = await db.get(PDV, stop.pdv_id)
    if not pdv:
        raise HTTPException(status_code=404, detail="PDV not found")

    # Comparer le code scanne vs attendu / Compare scanned vs expected code
    if data.scanned_pdv_code != pdv.code:
        alert = DeliveryAlert(
            tour_id=tour_id,
            tour_stop_id=stop_id,
            alert_type=AlertType.WRONG_PDV,
            severity=AlertSeverity.WARNING,
            message=f"Code scanne: {data.scanned_pdv_code}, attendu: {pdv.code}",
            created_at=_now_iso(),
            device_id=device.id,
        )
        db.add(alert)
        await db.flush()

        await manager.broadcast({
            "type": "alert",
            "alert_type": "WRONG_PDV",
            "tour_id": tour_id,
            "stop_id": stop_id,
            "message": alert.message,
        })

        raise HTTPException(
            status_code=422,
            detail=f"PDV mismatch: scanned {data.scanned_pdv_code}, expected {pdv.code}",
        )

    # Code correct -> creer event ARRIVAL
    event = StopEvent(
        tour_stop_id=stop_id,
        event_type=StopEventType.ARRIVAL,
        scanned_pdv_code=data.scanned_pdv_code,
        latitude=data.latitude,
        longitude=data.longitude,
        accuracy=data.accuracy,
        timestamp=data.timestamp,
        notes=data.notes,
        device_id=device.id,
    )
    db.add(event)

    stop.delivery_status = "ARRIVED"
    stop.actual_arrival_time = data.timestamp

    tour = await db.get(Tour, tour_id)
    if tour and tour.status in (TourStatus.DRAFT, TourStatus.VALIDATED):
        tour.status = TourStatus.IN_PROGRESS

    await db.flush()

    await manager.broadcast({
        "type": "stop_event",
        "event": "ARRIVAL",
        "tour_id": tour_id,
        "stop_id": stop_id,
        "pdv_code": pdv.code,
        "timestamp": data.timestamp,
    })

    return {"status": "ok", "delivery_status": "ARRIVED"}


@router.post("/tour/{tour_id}/stops/{stop_id}/close")
async def close_stop(
    tour_id: int,
    stop_id: int,
    data: StopClosureCreate,
    db: AsyncSession = Depends(get_db),
    device: MobileDevice = Depends(require_device_tour_access),
):
    """Cloture stop (force possible) / Close stop (force possible)."""
    stop = await db.get(TourStop, stop_id)
    if not stop or stop.tour_id != tour_id:
        raise HTTPException(status_code=404, detail="Stop not found")

    # Verifier reprises en attente / Check pending pickups
    if not data.force:
        from sqlalchemy import func
        pending_result = await db.execute(
            select(func.count(PickupLabel.id))
            .where(
                PickupLabel.tour_stop_id == stop_id,
                PickupLabel.status.in_([LabelStatus.PLANNED, LabelStatus.PENDING]),
            )
        )
        pending_count = pending_result.scalar() or 0
        if pending_count > 0:
            raise HTTPException(
                status_code=422,
                detail=f"Reprises en attente ({pending_count}) — scannez ou refusez avant de fermer",
            )

    forced = data.force
    if forced:
        alert = DeliveryAlert(
            tour_id=tour_id,
            tour_stop_id=stop_id,
            alert_type=AlertType.FORCED_CLOSURE,
            severity=AlertSeverity.WARNING,
            message="Cloture forcee par le chauffeur",
            created_at=_now_iso(),
            device_id=device.id,
        )
        db.add(alert)
        stop.forced_closure = True

        await manager.broadcast({
            "type": "alert",
            "alert_type": "FORCED_CLOSURE",
            "tour_id": tour_id,
            "stop_id": stop_id,
            "message": alert.message,
        })

    event = StopEvent(
        tour_stop_id=stop_id,
        event_type=StopEventType.CLOSURE,
        latitude=data.latitude,
        longitude=data.longitude,
        accuracy=data.accuracy,
        timestamp=data.timestamp,
        notes=data.notes,
        forced=forced,
        device_id=device.id,
    )
    db.add(event)

    stop.delivery_status = "DELIVERED"
    stop.actual_departure_time = data.timestamp
    stop.delivery_notes = data.notes

    await db.flush()

    await manager.broadcast({
        "type": "stop_event",
        "event": "CLOSURE",
        "tour_id": tour_id,
        "stop_id": stop_id,
        "timestamp": data.timestamp,
        "forced": forced,
    })

    return {"status": "ok", "delivery_status": "DELIVERED"}


@router.post("/tour/{tour_id}/return")
async def return_to_base(
    tour_id: int,
    data: ReturnToBaseCreate,
    db: AsyncSession = Depends(get_db),
    device: MobileDevice = Depends(require_device_tour_access),
):
    """Retour base / Return to base."""
    tour = await db.get(Tour, tour_id)
    if not tour:
        raise HTTPException(status_code=404, detail="Tour not found")

    tour.status = TourStatus.COMPLETED
    tour.actual_return_time = data.timestamp

    # 5A. Audit log — return to base
    db.add(AuditLog(
        entity_type="tour", entity_id=tour_id, action="RETURN_BASE",
        changes=f'{{"device_id":{device.id},"tour_code":"{tour.code}","timestamp":"{data.timestamp}"}}',
        user=f"device:{device.id}",
        timestamp=_now_iso(),
    ))

    await db.flush()

    await manager.broadcast({
        "type": "tour_status",
        "tour_id": tour_id,
        "tour_code": tour.code,
        "status": "COMPLETED",
        "actual_return_time": data.timestamp,
    })

    return {"status": "ok", "tour_status": "COMPLETED"}


@router.post("/tour/{tour_id}/stops/{stop_id}/scan-support", response_model=SupportScanRead)
async def scan_support(
    tour_id: int,
    stop_id: int,
    data: SupportScanCreate,
    db: AsyncSession = Depends(get_db),
    device: MobileDevice = Depends(require_device_tour_access),
):
    """Scan code barre support (1D) / Scan support barcode."""
    stop = await db.get(TourStop, stop_id)
    if not stop or stop.tour_id != tour_id:
        raise HTTPException(status_code=404, detail="Stop not found")

    # Verifier doublon (meme barcode pour ce stop) / Check duplicate
    existing = await db.execute(
        select(SupportScan).where(
            SupportScan.tour_stop_id == stop_id,
            SupportScan.barcode == data.barcode,
        ).limit(1)
    )
    if existing.scalar_one_or_none():
        # Retourner l'existant sans creer de doublon / Return existing without duplicate
        dup = (await db.execute(
            select(SupportScan).where(
                SupportScan.tour_stop_id == stop_id,
                SupportScan.barcode == data.barcode,
            )
        )).scalar_one()
        return dup

    scan = SupportScan(
        tour_stop_id=stop_id,
        device_id=device.id,
        barcode=data.barcode,
        latitude=data.latitude,
        longitude=data.longitude,
        timestamp=data.timestamp,
        expected_at_stop=True,  # TODO: verifier vs liste attendue quand import supports sera fait
    )
    db.add(scan)
    await db.flush()
    await db.refresh(scan)

    await manager.broadcast({
        "type": "support_scan",
        "tour_id": tour_id,
        "stop_id": stop_id,
        "barcode": data.barcode,
        "timestamp": data.timestamp,
    })

    return scan


@router.get("/tour/{tour_id}/stops/{stop_id}/supports", response_model=list[SupportScanRead])
async def list_stop_supports(
    tour_id: int,
    stop_id: int,
    db: AsyncSession = Depends(get_db),
    device: MobileDevice = Depends(require_device_tour_access),
):
    """Lister les supports scannes pour un stop / List scanned supports for a stop."""
    stop = await db.get(TourStop, stop_id)
    if not stop or stop.tour_id != tour_id:
        raise HTTPException(status_code=404, detail="Stop not found")

    result = await db.execute(
        select(SupportScan)
        .where(SupportScan.tour_stop_id == stop_id)
        .order_by(SupportScan.id)
    )
    return result.scalars().all()


@router.get("/tour/{tour_id}/pickups", response_model=list[PickupLabelRead])
async def list_tour_pickups(
    tour_id: int,
    db: AsyncSession = Depends(get_db),
    device: MobileDevice = Depends(require_device_tour_access),
):
    """Etiquettes de reprise pour les stops du tour / Pickup labels for tour stops."""
    result = await db.execute(
        select(Tour).where(Tour.id == tour_id).options(selectinload(Tour.stops))
    )
    tour = result.scalar_one_or_none()
    if not tour:
        raise HTTPException(status_code=404, detail="Tour not found")

    stop_ids = [
        s.id for s in tour.stops
        if s.pickup_containers or s.pickup_cardboard or s.pickup_returns or getattr(s, "pickup_consignment", False)
    ]
    if not stop_ids:
        return []

    label_result = await db.execute(
        select(PickupLabel)
        .where(PickupLabel.tour_stop_id.in_(stop_ids))
        .order_by(PickupLabel.id)
    )
    return label_result.scalars().all()


@router.post("/pickup-labels/{label_code}/scan", response_model=PickupLabelRead)
async def scan_pickup_label(
    label_code: str,
    db: AsyncSession = Depends(get_db),
    device: MobileDevice = Depends(get_authenticated_device),
):
    """Scan etiquette reprise → PICKED_UP / Scan pickup label → PICKED_UP."""
    result = await db.execute(
        select(PickupLabel)
        .where(PickupLabel.label_code == label_code)
        .options(selectinload(PickupLabel.pickup_request).selectinload(PickupRequest.labels))
    )
    label = result.scalar_one_or_none()
    if not label:
        raise HTTPException(status_code=404, detail="Label not found")

    # Verifier que l'appareil a acces via label → stop → tour → DeviceAssignment
    if label.tour_stop_id:
        stop = await db.get(TourStop, label.tour_stop_id)
        if stop:
            assign_check = await db.execute(
                select(DeviceAssignment).where(
                    DeviceAssignment.tour_id == stop.tour_id,
                    DeviceAssignment.device_id == device.id,
                ).limit(1)
            )
            if not assign_check.scalar_one_or_none():
                raise HTTPException(status_code=403, detail="Device not assigned to this tour")

    if label.status == LabelStatus.PICKED_UP:
        return label  # deja scanne / already scanned
    if label.status == LabelStatus.RECEIVED:
        raise HTTPException(status_code=400, detail="Label already received")

    label.status = LabelStatus.PICKED_UP
    label.picked_up_at = _now_iso()
    label.picked_up_device_id = device.id

    # Auto-progression demande parent / Auto-progress parent request
    from app.api.pickup_requests import _auto_progress_request
    _auto_progress_request(label.pickup_request)

    await db.flush()
    await db.refresh(label)
    return label


@router.post("/tour/{tour_id}/stops/{stop_id}/refuse-pickup")
async def refuse_pickup(
    tour_id: int,
    stop_id: int,
    data: PickupRefusalCreate,
    db: AsyncSession = Depends(get_db),
    device: MobileDevice = Depends(require_device_tour_access),
):
    """Refuser les reprises pour un stop / Refuse pickups for a stop."""
    stop = await db.get(TourStop, stop_id)
    if not stop or stop.tour_id != tour_id:
        raise HTTPException(status_code=404, detail="Stop not found")

    # Chercher les etiquettes PENDING/PLANNED liees au stop
    label_result = await db.execute(
        select(PickupLabel)
        .where(
            PickupLabel.tour_stop_id == stop_id,
            PickupLabel.status.in_([LabelStatus.PLANNED, LabelStatus.PENDING]),
        )
        .options(selectinload(PickupLabel.pickup_request).selectinload(PickupRequest.labels))
    )
    labels = label_result.scalars().all()

    if not labels:
        return {"status": "ok", "refused": 0}

    # Creer alerte PICKUP_REFUSED / Create PICKUP_REFUSED alert
    alert = DeliveryAlert(
        tour_id=tour_id,
        tour_stop_id=stop_id,
        alert_type=AlertType.PICKUP_REFUSED,
        severity=AlertSeverity.WARNING,
        message=data.reason,
        created_at=_now_iso(),
        device_id=device.id,
    )
    db.add(alert)

    # Delier les etiquettes : retour pool non-assigne / Unlink labels: return to unassigned pool
    from app.api.pickup_requests import _auto_progress_request
    requests_seen: set[int] = set()
    for label in labels:
        label.tour_stop_id = None
        label.status = LabelStatus.PENDING
        requests_seen.add(label.pickup_request_id)

    # Auto-progression demandes parentes / Auto-progress parent requests
    for label in labels:
        if label.pickup_request_id in requests_seen:
            _auto_progress_request(label.pickup_request)
            requests_seen.discard(label.pickup_request_id)

    await db.flush()

    # Broadcast WebSocket alert
    await manager.broadcast({
        "type": "alert",
        "alert_type": "PICKUP_REFUSED",
        "tour_id": tour_id,
        "stop_id": stop_id,
        "message": data.reason,
    })

    return {"status": "ok", "refused": len(labels)}
