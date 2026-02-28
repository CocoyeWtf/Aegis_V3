"""
Endpoints de rapports opérationnels / Operational report endpoints.
Lecture seule, données agrégées à partir des tournées existantes.
Read-only, aggregated data from existing tours.
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.base_logistics import BaseLogistics
from app.models.pdv import PDV
from app.models.tour import Tour
from app.models.tour_stop import TourStop
from app.models.user import User
from app.models.vehicle import Vehicle
from app.api.deps import require_permission, get_user_region_ids

router = APIRouter()


def _compute_punctuality(stops: list, pdv_map: dict | None = None) -> float:
    """Calcule le taux de ponctualité / Compute punctuality rate.

    Un stop est ponctuel si actual_arrival_time est dans la fenêtre de livraison du PDV.
    A stop is on-time if actual_arrival_time falls within the PDV's delivery window.
    Retourne un pourcentage (0-100). Stops sans données = ignorés.
    """
    on_time = 0
    total = 0

    for stop in stops:
        if not stop.actual_arrival_time:
            continue

        # Extraire l'heure d'arrivée réelle / Extract actual arrival hour
        arrival = stop.actual_arrival_time
        # Format ISO: YYYY-MM-DDTHH:MM:SS ou HH:MM
        if "T" in arrival:
            arrival_hm = arrival.split("T")[1][:5]
        else:
            arrival_hm = arrival[:5]

        # Récupérer la fenêtre PDV / Get PDV delivery window
        pdv = pdv_map.get(stop.pdv_id) if pdv_map else None
        if pdv and pdv.delivery_window_start and pdv.delivery_window_end:
            if pdv.delivery_window_start <= arrival_hm <= pdv.delivery_window_end:
                on_time += 1
            total += 1
        elif stop.arrival_time:
            # Fallback: comparer avec l'heure planifiée (±30 min tolérance)
            total += 1
            if arrival_hm <= stop.arrival_time or _time_diff_minutes(stop.arrival_time, arrival_hm) <= 30:
                on_time += 1
        else:
            # Pas de référence, considéré ponctuel / No reference, considered on-time
            continue

    return round(on_time / total * 100, 1) if total > 0 else 100.0


def _time_diff_minutes(planned: str, actual: str) -> int:
    """Différence en minutes entre deux heures HH:MM / Minute difference between two HH:MM times."""
    try:
        ph, pm = int(planned[:2]), int(planned[3:5])
        ah, am = int(actual[:2]), int(actual[3:5])
        return (ah * 60 + am) - (ph * 60 + pm)
    except (ValueError, IndexError):
        return 0


async def _load_tours_in_period(
    db: AsyncSession,
    user: User,
    date_from: str,
    date_to: str,
    base_id: int | None = None,
) -> list:
    """Charge les tournées dans la période avec filtres / Load tours in period with filters."""
    query = (
        select(Tour)
        .options(selectinload(Tour.stops))
        .where(Tour.date >= date_from, Tour.date <= date_to)
    )

    if base_id:
        query = query.where(Tour.base_id == base_id)

    # Region scoping
    user_region_ids = get_user_region_ids(user)
    if user_region_ids is not None:
        query = query.join(BaseLogistics, Tour.base_id == BaseLogistics.id).where(
            BaseLogistics.region_id.in_(user_region_ids)
        )

    result = await db.execute(query)
    return list(result.scalars().unique().all())


@router.get("/daily")
async def report_daily(
    date_from: str = Query(...),
    date_to: str = Query(...),
    base_id: int | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("reports", "read")),
):
    """Rapport quotidien / Daily report — agrégation par date."""
    tours = await _load_tours_in_period(db, user, date_from, date_to, base_id)

    # Batch-load PDVs pour ponctualité / Batch-load PDVs for punctuality
    all_pdv_ids = {s.pdv_id for t in tours for s in t.stops}
    pdv_map = {}
    if all_pdv_ids:
        result = await db.execute(select(PDV).where(PDV.id.in_(all_pdv_ids)))
        pdv_map = {p.id: p for p in result.scalars().all()}

    # Grouper par date / Group by date
    by_date: dict[str, list] = {}
    for tour in tours:
        by_date.setdefault(tour.date, []).append(tour)

    days = []
    totals = {
        "nb_tours": 0, "nb_pdv": 0, "total_eqp": 0, "total_km": 0.0,
        "total_cost": 0.0, "total_weight_kg": 0.0,
    }
    all_fill_rates = []
    all_stops_for_punctuality = []

    for date_str in sorted(by_date.keys()):
        date_tours = by_date[date_str]
        nb_tours = len(date_tours)
        pdv_ids = set()
        total_eqp = 0
        total_km = 0.0
        total_cost = 0.0
        total_weight = 0.0
        fill_rates = []
        day_stops = []

        for t in date_tours:
            for s in t.stops:
                pdv_ids.add(s.pdv_id)
                day_stops.append(s)
            total_eqp += t.total_eqp or 0
            total_km += t.total_km or 0.0
            total_cost += t.total_cost or 0.0
            total_weight += t.total_weight_kg or 0.0
            if t.capacity_eqp and t.total_eqp:
                fill_rates.append(round(t.total_eqp / t.capacity_eqp * 100, 1))

        avg_fill = round(sum(fill_rates) / len(fill_rates), 1) if fill_rates else 0.0
        punctuality = _compute_punctuality(day_stops, pdv_map)

        days.append({
            "date": date_str,
            "nb_tours": nb_tours,
            "nb_pdv": len(pdv_ids),
            "total_eqp": total_eqp,
            "total_km": round(total_km, 1),
            "total_cost": round(total_cost, 2),
            "total_weight_kg": round(total_weight, 1),
            "avg_fill_rate_pct": avg_fill,
            "punctuality_pct": punctuality,
        })

        totals["nb_tours"] += nb_tours
        totals["nb_pdv"] += len(pdv_ids)
        totals["total_eqp"] += total_eqp
        totals["total_km"] += total_km
        totals["total_cost"] += total_cost
        totals["total_weight_kg"] += total_weight
        all_fill_rates.extend(fill_rates)
        all_stops_for_punctuality.extend(day_stops)

    totals["total_km"] = round(totals["total_km"], 1)
    totals["total_cost"] = round(totals["total_cost"], 2)
    totals["total_weight_kg"] = round(totals["total_weight_kg"], 1)
    totals["avg_fill_rate_pct"] = round(sum(all_fill_rates) / len(all_fill_rates), 1) if all_fill_rates else 0.0
    totals["punctuality_pct"] = _compute_punctuality(all_stops_for_punctuality, pdv_map)

    return {
        "period": {"date_from": date_from, "date_to": date_to},
        "days": days,
        "totals": totals,
    }


@router.get("/driver")
async def report_driver(
    date_from: str = Query(...),
    date_to: str = Query(...),
    base_id: int | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("reports", "read")),
):
    """Rapport chauffeurs / Driver report — agrégation par chauffeur."""
    tours = await _load_tours_in_period(db, user, date_from, date_to, base_id)

    # Batch-load PDVs pour ponctualité
    all_pdv_ids = {s.pdv_id for t in tours for s in t.stops}
    pdv_map = {}
    if all_pdv_ids:
        result = await db.execute(select(PDV).where(PDV.id.in_(all_pdv_ids)))
        pdv_map = {p.id: p for p in result.scalars().all()}

    # Filtrer tours avec chauffeur / Filter tours with driver
    driver_tours = [t for t in tours if t.driver_name]

    # Grouper par chauffeur / Group by driver
    by_driver: dict[str, list] = {}
    for tour in driver_tours:
        by_driver.setdefault(tour.driver_name, []).append(tour)

    drivers = []
    for driver_name in sorted(by_driver.keys()):
        dtours = by_driver[driver_name]
        nb_tours = len(dtours)
        total_km = sum(t.total_km or 0 for t in dtours)
        total_eqp = sum(t.total_eqp or 0 for t in dtours)
        nb_stops = sum(len(t.stops) for t in dtours)
        total_duration = sum(t.total_duration_minutes or 0 for t in dtours)
        avg_duration = round(total_duration / nb_tours, 0) if nb_tours else 0

        all_stops = [s for t in dtours for s in t.stops]
        punctuality = _compute_punctuality(all_stops, pdv_map)

        drivers.append({
            "driver_name": driver_name,
            "nb_tours": nb_tours,
            "total_km": round(total_km, 1),
            "total_eqp": total_eqp,
            "nb_stops": nb_stops,
            "total_duration_minutes": total_duration,
            "avg_duration_minutes": int(avg_duration),
            "punctuality_pct": punctuality,
        })

    return {
        "period": {"date_from": date_from, "date_to": date_to},
        "drivers": drivers,
    }


@router.get("/pdv")
async def report_pdv(
    date_from: str = Query(...),
    date_to: str = Query(...),
    base_id: int | None = Query(default=None),
    pdv_type: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("reports", "read")),
):
    """Rapport PDV / PDV report — agrégation par point de vente."""
    tours = await _load_tours_in_period(db, user, date_from, date_to, base_id)

    # Batch-load PDVs
    all_pdv_ids = {s.pdv_id for t in tours for s in t.stops}
    pdv_map = {}
    if all_pdv_ids:
        query = select(PDV).where(PDV.id.in_(all_pdv_ids))
        if pdv_type:
            query = query.where(PDV.type == pdv_type)
        result = await db.execute(query)
        pdv_map = {p.id: p for p in result.scalars().all()}

    # Grouper stops par PDV / Group stops by PDV
    by_pdv: dict[int, list] = {}
    for tour in tours:
        for stop in tour.stops:
            if stop.pdv_id in pdv_map:  # Filtre pdv_type appliqué via pdv_map
                by_pdv.setdefault(stop.pdv_id, []).append(stop)

    pdvs = []
    for pdv_id in sorted(by_pdv.keys()):
        pdv = pdv_map[pdv_id]
        stops = by_pdv[pdv_id]
        nb_deliveries = len(stops)
        total_eqp = sum(s.eqp_count or 0 for s in stops)
        avg_eqp = round(total_eqp / nb_deliveries, 1) if nb_deliveries else 0
        punctuality = _compute_punctuality(stops, pdv_map)

        nb_incidents = sum(1 for s in stops if s.delivery_status == "SKIPPED")
        nb_forced_closures = sum(1 for s in stops if s.forced_closure)
        nb_missing_supports = sum(s.missing_supports_count or 0 for s in stops)

        pdvs.append({
            "pdv_id": pdv_id,
            "pdv_code": pdv.code,
            "pdv_name": pdv.name,
            "pdv_city": getattr(pdv, "city", None) or "",
            "pdv_type": str(pdv.type) if pdv.type else "",
            "nb_deliveries": nb_deliveries,
            "total_eqp": total_eqp,
            "avg_eqp": avg_eqp,
            "punctuality_pct": punctuality,
            "nb_incidents": nb_incidents,
            "nb_forced_closures": nb_forced_closures,
            "nb_missing_supports": nb_missing_supports,
        })

    return {
        "period": {"date_from": date_from, "date_to": date_to},
        "pdvs": pdvs,
    }


@router.get("/vehicle")
async def report_vehicle(
    date_from: str = Query(...),
    date_to: str = Query(...),
    base_id: int | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("reports", "read")),
):
    """Rapport véhicules / Vehicle report — agrégation par véhicule."""
    tours = await _load_tours_in_period(db, user, date_from, date_to, base_id)

    # Filtrer tours avec véhicule / Filter tours with vehicle
    vehicle_tours = [t for t in tours if t.vehicle_id]

    # Batch-load vehicles
    vehicle_ids = {t.vehicle_id for t in vehicle_tours}
    vehicle_map = {}
    if vehicle_ids:
        result = await db.execute(select(Vehicle).where(Vehicle.id.in_(vehicle_ids)))
        vehicle_map = {v.id: v for v in result.scalars().all()}

    # Grouper par véhicule / Group by vehicle
    by_vehicle: dict[int, list] = {}
    for tour in vehicle_tours:
        by_vehicle.setdefault(tour.vehicle_id, []).append(tour)

    vehicles = []
    for vid in sorted(by_vehicle.keys()):
        v = vehicle_map.get(vid)
        if not v:
            continue
        vtours = by_vehicle[vid]
        nb_tours = len(vtours)
        total_km = sum(t.total_km or 0 for t in vtours)
        total_eqp = sum(t.total_eqp or 0 for t in vtours)
        total_cost = sum(t.total_cost or 0 for t in vtours)

        fill_rates = []
        for t in vtours:
            cap = t.capacity_eqp or (v.capacity_eqp if v.capacity_eqp else None)
            if cap and t.total_eqp:
                fill_rates.append(t.total_eqp / cap * 100)
        avg_fill = round(sum(fill_rates) / len(fill_rates), 1) if fill_rates else 0.0
        cost_per_km = round(total_cost / total_km, 2) if total_km > 0 else 0.0

        vehicles.append({
            "vehicle_id": vid,
            "vehicle_code": v.code,
            "vehicle_name": v.name or "",
            "vehicle_type": str(v.fleet_vehicle_type) if v.fleet_vehicle_type else "",
            "capacity_eqp": v.capacity_eqp or 0,
            "nb_tours": nb_tours,
            "total_km": round(total_km, 1),
            "total_eqp": total_eqp,
            "avg_fill_rate_pct": avg_fill,
            "total_cost": round(total_cost, 2),
            "cost_per_km": cost_per_km,
        })

    return {
        "period": {"date_from": date_from, "date_to": date_to},
        "vehicles": vehicles,
    }
