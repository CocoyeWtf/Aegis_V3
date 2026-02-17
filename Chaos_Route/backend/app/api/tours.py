"""Routes Tournées / Tour API routes."""

from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.contract import Contract
from app.models.distance_matrix import DistanceMatrix
from app.models.parameter import Parameter
from app.models.pdv import PDV
from app.models.tour import Tour
from app.models.tour_stop import TourStop
from app.models.volume import Volume
from app.models.base_logistics import BaseLogistics
from app.models.user import User
from app.schemas.tour import TourCreate, TourRead, TourSchedule, TourUpdate
from app.api.deps import require_permission, get_user_region_ids

router = APIRouter()

# -- Constantes par défaut / Default constants --
DEFAULT_DOCK_TIME_MINUTES = 10
DEFAULT_UNLOAD_TIME_PER_EQP_MINUTES = 3


def _parse_time(t: str) -> datetime:
    """Parse HH:MM string to datetime (date-agnostic)."""
    return datetime.strptime(t, "%H:%M")


def _format_time(dt: datetime) -> str:
    """Format datetime to HH:MM string."""
    return dt.strftime("%H:%M")


def _add_minutes(time_str: str, minutes: int) -> str:
    """Ajouter des minutes à un HH:MM / Add minutes to HH:MM."""
    dt = _parse_time(time_str) + timedelta(minutes=minutes)
    return _format_time(dt)


async def _get_param(db: AsyncSession, key: str, default: str) -> str:
    """Lire un paramètre système / Read a system parameter."""
    result = await db.execute(select(Parameter).where(Parameter.key == key))
    param = result.scalar_one_or_none()
    return param.value if param else default


async def _get_distance(
    db: AsyncSession,
    origin_type: str, origin_id: int,
    dest_type: str, dest_id: int,
) -> DistanceMatrix | None:
    """Chercher distance dans le distancier (bidirectionnel) / Lookup distance (bidirectional)."""
    result = await db.execute(
        select(DistanceMatrix).where(
            DistanceMatrix.origin_type == origin_type,
            DistanceMatrix.origin_id == origin_id,
            DistanceMatrix.destination_type == dest_type,
            DistanceMatrix.destination_id == dest_id,
        )
    )
    entry = result.scalar_one_or_none()
    if entry:
        return entry
    result = await db.execute(
        select(DistanceMatrix).where(
            DistanceMatrix.origin_type == dest_type,
            DistanceMatrix.origin_id == dest_id,
            DistanceMatrix.destination_type == origin_type,
            DistanceMatrix.destination_id == origin_id,
        )
    )
    return result.scalar_one_or_none()


async def calculate_tour_times(
    departure_time: str,
    stops_data: list[dict],
    base_id: int,
    db: AsyncSession,
) -> tuple[list[dict], str, int]:
    """
    Calculer les temps à chaque arrêt / Calculate times at each stop.

    Returns: (enriched_stops, return_time, total_duration_minutes)
    """
    default_dock = int(await _get_param(db, "default_dock_time_minutes", str(DEFAULT_DOCK_TIME_MINUTES)))
    default_unload = int(await _get_param(db, "default_unload_time_per_eqp_minutes", str(DEFAULT_UNLOAD_TIME_PER_EQP_MINUTES)))

    current_time = _parse_time(departure_time)
    prev_type = "BASE"
    prev_id = base_id
    enriched = []

    for stop in stops_data:
        pdv_id = stop["pdv_id"]
        eqp_count = stop["eqp_count"]

        dist_entry = await _get_distance(db, prev_type, prev_id, "PDV", pdv_id)
        travel_minutes = dist_entry.duration_minutes if dist_entry else 0
        distance_km = float(dist_entry.distance_km) if dist_entry else 0.0

        arrival = current_time + timedelta(minutes=travel_minutes)

        pdv_result = await db.execute(select(PDV).where(PDV.id == pdv_id))
        pdv = pdv_result.scalar_one_or_none()
        dock_time = pdv.dock_time_minutes if (pdv and pdv.dock_time_minutes) else default_dock
        unload_per_eqp = pdv.unload_time_per_eqp_minutes if (pdv and pdv.unload_time_per_eqp_minutes) else default_unload
        unload_duration = dock_time + (eqp_count * unload_per_eqp)

        departure = arrival + timedelta(minutes=unload_duration)

        enriched.append({
            "pdv_id": pdv_id,
            "sequence_order": stop["sequence_order"],
            "eqp_count": eqp_count,
            "arrival_time": _format_time(arrival),
            "departure_time": _format_time(departure),
            "distance_from_previous_km": round(distance_km, 2),
            "duration_from_previous_minutes": travel_minutes,
        })

        current_time = departure
        prev_type = "PDV"
        prev_id = pdv_id

    if enriched:
        last_pdv_id = enriched[-1]["pdv_id"]
        return_dist = await _get_distance(db, "PDV", last_pdv_id, "BASE", base_id)
        return_minutes = return_dist.duration_minutes if return_dist else 0
        return_dt = current_time + timedelta(minutes=return_minutes)
        return_time = _format_time(return_dt)
    else:
        return_time = departure_time

    start_dt = _parse_time(departure_time)
    end_dt = _parse_time(return_time)
    total_minutes = int((end_dt - start_dt).total_seconds() / 60)
    if total_minutes < 0:
        total_minutes += 24 * 60

    return enriched, return_time, total_minutes


async def _calculate_cost(
    total_km: float,
    total_duration_minutes: int,
    contract: Contract,
) -> float:
    """Calculer le coût du tour via contrat / Calculate tour cost from contract."""
    cost = float(contract.fixed_daily_cost or 0)
    cost += total_km * float(contract.cost_per_km or 0)
    hours = total_duration_minutes / 60
    cost += hours * float(contract.cost_per_hour or 0)
    if contract.min_hours_per_day and hours < float(contract.min_hours_per_day):
        cost = max(cost, float(contract.min_hours_per_day) * float(contract.cost_per_hour or 0) + float(contract.fixed_daily_cost or 0))
    if contract.min_km_per_day and total_km < float(contract.min_km_per_day):
        cost = max(cost, float(contract.min_km_per_day) * float(contract.cost_per_km or 0) + float(contract.fixed_daily_cost or 0))
    return round(cost, 2)


# =========================================================================
# CRUD Endpoints
# =========================================================================

@router.get("/", response_model=list[TourRead])
async def list_tours(
    date: str | None = None,
    base_id: int | None = None,
    status: str | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("tour-planning", "read")),
):
    """Lister les tours avec filtres / List tours with filters."""
    query = select(Tour).options(selectinload(Tour.stops))
    if date is not None:
        query = query.where(Tour.date == date)
    if base_id is not None:
        query = query.where(Tour.base_id == base_id)
    if status is not None:
        query = query.where(Tour.status == status)
    # Scope région via BaseLogistics / Region scope via BaseLogistics join
    user_region_ids = get_user_region_ids(user)
    if user_region_ids is not None:
        query = query.join(BaseLogistics, Tour.base_id == BaseLogistics.id).where(
            BaseLogistics.region_id.in_(user_region_ids)
        )
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/available-contracts", response_model=list)
async def available_contracts_for_tours(
    date: str = Query(...),
    base_id: int = Query(...),
    after_time: str = Query(default="00:00"),
    vehicle_type: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("tour-planning", "read")),
):
    """Contrats disponibles à une date/heure / Available contracts at a date/time."""
    from app.models.contract_schedule import ContractSchedule

    base_result = await db.execute(select(BaseLogistics).where(BaseLogistics.id == base_id))
    base = base_result.scalar_one_or_none()
    if not base:
        raise HTTPException(status_code=404, detail="Base not found")

    contracts_result = await db.execute(
        select(Contract).where(Contract.region_id == base.region_id)
    )
    all_contracts = contracts_result.scalars().all()

    sched_result = await db.execute(
        select(ContractSchedule.contract_id).where(
            ContractSchedule.date == date,
            ContractSchedule.is_available == False,
        )
    )
    unavailable_ids = {row[0] for row in sched_result.all()}
    available = [c for c in all_contracts if c.id not in unavailable_ids]

    if vehicle_type:
        available = [c for c in available if c.vehicle_type and c.vehicle_type.value == vehicle_type]

    return [
        {
            "id": c.id,
            "code": c.code,
            "transporter_name": c.transporter_name,
            "vehicle_code": c.vehicle_code,
            "vehicle_name": c.vehicle_name,
            "temperature_type": c.temperature_type.value if (c.temperature_type and hasattr(c.temperature_type, 'value')) else c.temperature_type,
            "vehicle_type": c.vehicle_type.value if (c.vehicle_type and hasattr(c.vehicle_type, 'value')) else c.vehicle_type,
            "capacity_eqp": c.capacity_eqp,
            "capacity_weight_kg": c.capacity_weight_kg,
            "fixed_daily_cost": float(c.fixed_daily_cost) if c.fixed_daily_cost else None,
            "cost_per_km": float(c.cost_per_km) if c.cost_per_km else None,
            "cost_per_hour": float(c.cost_per_hour) if c.cost_per_hour else None,
            "has_tailgate": c.has_tailgate,
            "tailgate_type": c.tailgate_type.value if (c.tailgate_type and hasattr(c.tailgate_type, 'value')) else c.tailgate_type,
            "start_date": c.start_date,
            "end_date": c.end_date,
            "region_id": c.region_id,
        }
        for c in available
    ]


@router.get("/timeline")
async def tour_timeline(
    date: str = Query(...),
    base_id: int = Query(...),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("tour-planning", "read")),
):
    """Timeline du jour : tous les tours avec leurs stops / Day timeline: all tours with stops."""
    result = await db.execute(
        select(Tour)
        .where(Tour.date == date, Tour.base_id == base_id)
        .options(selectinload(Tour.stops))
        .order_by(Tour.departure_time)
    )
    tours = result.scalars().all()

    contract_ids = list({t.contract_id for t in tours if t.contract_id is not None})
    contracts_map: dict[int, Contract] = {}
    if contract_ids:
        c_result = await db.execute(select(Contract).where(Contract.id.in_(contract_ids)))
        for c in c_result.scalars().all():
            contracts_map[c.id] = c

    timeline = []
    for tour in tours:
        c = contracts_map.get(tour.contract_id) if tour.contract_id else None
        vt = tour.vehicle_type
        timeline.append({
            "tour_id": tour.id,
            "code": tour.code,
            "contract_id": tour.contract_id,
            "vehicle_type": vt.value if (vt and hasattr(vt, 'value')) else vt,
            "capacity_eqp": tour.capacity_eqp,
            "vehicle_code": c.vehicle_code if c else None,
            "vehicle_name": c.vehicle_name if c else None,
            "contract_code": c.code if c else None,
            "transporter_name": c.transporter_name if c else None,
            "departure_time": tour.departure_time,
            "return_time": tour.return_time,
            "total_eqp": tour.total_eqp,
            "total_km": float(tour.total_km) if tour.total_km else None,
            "total_cost": float(tour.total_cost) if tour.total_cost else None,
            "total_duration_minutes": tour.total_duration_minutes,
            "status": tour.status.value if hasattr(tour.status, 'value') else tour.status,
            "stops": [
                {
                    "id": s.id,
                    "pdv_id": s.pdv_id,
                    "sequence_order": s.sequence_order,
                    "eqp_count": s.eqp_count,
                    "arrival_time": s.arrival_time,
                    "departure_time": s.departure_time,
                }
                for s in tour.stops
            ],
        })

    return timeline


@router.get("/{tour_id}", response_model=TourRead)
async def get_tour(
    tour_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("tour-planning", "read")),
):
    result = await db.execute(
        select(Tour).where(Tour.id == tour_id).options(selectinload(Tour.stops))
    )
    tour = result.scalar_one_or_none()
    if not tour:
        raise HTTPException(status_code=404, detail="Tour not found")
    return tour


@router.post("/", response_model=TourRead, status_code=201)
async def create_tour(
    data: TourCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("tour-planning", "create")),
):
    """Créer un tour avec calcul automatique des temps / Create a tour with automatic time calculation."""
    stops_input = [
        {
            "pdv_id": s.pdv_id,
            "sequence_order": s.sequence_order,
            "eqp_count": s.eqp_count,
        }
        for s in data.stops
    ]

    if data.departure_time:
        enriched_stops, return_time, total_duration = await calculate_tour_times(
            data.departure_time, stops_input, data.base_id, db
        )
    else:
        enriched_stops = stops_input
        return_time = None
        total_duration = None

    contract = await db.get(Contract, data.contract_id) if data.contract_id else None

    total_km = data.total_km or 0
    if data.departure_time and enriched_stops:
        total_km = sum(s.get("distance_from_previous_km", 0) for s in enriched_stops)
        if enriched_stops:
            last_pdv_id = enriched_stops[-1]["pdv_id"]
            return_dist = await _get_distance(db, "PDV", last_pdv_id, "BASE", data.base_id)
            if return_dist:
                total_km += float(return_dist.distance_km)
        total_km = round(total_km, 2)

    total_cost = data.total_cost or 0
    if contract and data.departure_time:
        total_cost = await _calculate_cost(total_km, total_duration or 0, contract)

    tour = Tour(
        date=data.date,
        code=data.code,
        vehicle_type=data.vehicle_type,
        capacity_eqp=data.capacity_eqp,
        contract_id=data.contract_id,
        departure_time=data.departure_time,
        return_time=return_time,
        total_km=total_km,
        total_duration_minutes=total_duration,
        total_eqp=data.total_eqp,
        total_cost=total_cost,
        status=data.status,
        base_id=data.base_id,
    )
    db.add(tour)
    await db.flush()

    pdv_ids = []
    for stop_data in enriched_stops:
        stop = TourStop(
            tour_id=tour.id,
            pdv_id=stop_data["pdv_id"],
            sequence_order=stop_data["sequence_order"],
            eqp_count=stop_data["eqp_count"],
            arrival_time=stop_data.get("arrival_time"),
            departure_time=stop_data.get("departure_time"),
            distance_from_previous_km=stop_data.get("distance_from_previous_km"),
            duration_from_previous_minutes=stop_data.get("duration_from_previous_minutes"),
        )
        db.add(stop)
        pdv_ids.append(stop_data["pdv_id"])

    if pdv_ids:
        vol_result = await db.execute(
            select(Volume).where(
                Volume.pdv_id.in_(pdv_ids),
                Volume.date.in_([data.date, data.date.replace("-", "")]),
                Volume.tour_id.is_(None),
            )
        )
        for vol in vol_result.scalars().all():
            vol.tour_id = tour.id

    await db.flush()
    result = await db.execute(
        select(Tour).where(Tour.id == tour.id).options(selectinload(Tour.stops))
    )
    return result.scalar_one()


@router.put("/{tour_id}", response_model=TourRead)
async def update_tour(
    tour_id: int,
    data: TourUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("tour-planning", "update")),
):
    tour = await db.get(Tour, tour_id)
    if not tour:
        raise HTTPException(status_code=404, detail="Tour not found")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(tour, key, value)
    await db.flush()
    result = await db.execute(
        select(Tour).where(Tour.id == tour.id).options(selectinload(Tour.stops))
    )
    return result.scalar_one()


@router.put("/{tour_id}/schedule", response_model=TourRead)
async def schedule_tour(
    tour_id: int,
    data: TourSchedule,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("tour-planning", "update")),
):
    """Planifier un tour : assigner contrat + heure de départ / Schedule: assign contract + departure time."""
    result = await db.execute(
        select(Tour).where(Tour.id == tour_id).options(selectinload(Tour.stops))
    )
    tour = result.scalar_one_or_none()
    if not tour:
        raise HTTPException(status_code=404, detail="Tour not found")

    stops_data = [
        {"pdv_id": s.pdv_id, "sequence_order": s.sequence_order, "eqp_count": s.eqp_count}
        for s in sorted(tour.stops, key=lambda s: s.sequence_order)
    ]

    enriched_stops, return_time, total_duration = await calculate_tour_times(
        data.departure_time, stops_data, tour.base_id, db
    )

    other_tours = await db.execute(
        select(Tour).where(
            Tour.date == tour.date,
            Tour.contract_id == data.contract_id,
            Tour.id != tour.id,
            Tour.departure_time.isnot(None),
            Tour.return_time.isnot(None),
        )
    )
    for other in other_tours.scalars().all():
        if other.departure_time and other.return_time:
            if data.departure_time < other.return_time and return_time > other.departure_time:
                raise HTTPException(
                    status_code=409,
                    detail=f"Overlap with tour {other.code} ({other.departure_time}-{other.return_time})",
                )

    contract = await db.get(Contract, data.contract_id)

    total_km = sum(s.get("distance_from_previous_km", 0) for s in enriched_stops)
    if enriched_stops:
        last_pdv_id = enriched_stops[-1]["pdv_id"]
        return_dist = await _get_distance(db, "PDV", last_pdv_id, "BASE", tour.base_id)
        if return_dist:
            total_km += float(return_dist.distance_km)
    total_km = round(total_km, 2)

    total_cost = await _calculate_cost(total_km, total_duration, contract) if contract else 0

    tour.contract_id = data.contract_id
    tour.departure_time = data.departure_time
    tour.return_time = return_time
    tour.total_km = total_km
    tour.total_duration_minutes = total_duration
    tour.total_cost = total_cost

    for stop in tour.stops:
        for enriched in enriched_stops:
            if stop.pdv_id == enriched["pdv_id"] and stop.sequence_order == enriched["sequence_order"]:
                stop.arrival_time = enriched.get("arrival_time")
                stop.departure_time = enriched.get("departure_time")
                stop.distance_from_previous_km = enriched.get("distance_from_previous_km")
                stop.duration_from_previous_minutes = enriched.get("duration_from_previous_minutes")
                break

    await db.flush()
    result = await db.execute(
        select(Tour).where(Tour.id == tour.id).options(selectinload(Tour.stops))
    )
    return result.scalar_one()


@router.delete("/{tour_id}/schedule", response_model=TourRead)
async def unschedule_tour(
    tour_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("tour-planning", "update")),
):
    """Retirer la planification d'un tour / Remove tour scheduling."""
    result = await db.execute(
        select(Tour).where(Tour.id == tour_id).options(selectinload(Tour.stops))
    )
    tour = result.scalar_one_or_none()
    if not tour:
        raise HTTPException(status_code=404, detail="Tour not found")

    tour.contract_id = None
    tour.departure_time = None
    tour.return_time = None
    tour.total_duration_minutes = None
    tour.total_cost = None

    for stop in tour.stops:
        stop.arrival_time = None
        stop.departure_time = None

    await db.flush()
    result = await db.execute(
        select(Tour).where(Tour.id == tour.id).options(selectinload(Tour.stops))
    )
    return result.scalar_one()


@router.delete("/{tour_id}", status_code=204)
async def delete_tour(
    tour_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("tour-planning", "delete")),
):
    """Supprimer un tour et libérer les volumes / Delete a tour and release its volumes."""
    tour = await db.get(Tour, tour_id)
    if not tour:
        raise HTTPException(status_code=404, detail="Tour not found")
    vol_result = await db.execute(select(Volume).where(Volume.tour_id == tour_id))
    for vol in vol_result.scalars().all():
        vol.tour_id = None
    await db.delete(tour)
