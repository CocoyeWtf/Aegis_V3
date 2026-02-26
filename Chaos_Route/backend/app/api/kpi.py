"""Routes KPI — taux de ponctualité / KPI routes — punctuality rate."""

from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.tour import Tour, TourStatus
from app.models.tour_stop import TourStop
from app.models.volume import Volume
from app.models.pdv import PDV
from app.models.support_scan import SupportScan
from app.models.user import User
from app.api.deps import require_permission, get_user_region_ids

router = APIRouter()


def _compute_deadline(volume: Volume, pdv: PDV, fallback_date: str | None = None) -> datetime | None:
    """Calculer la deadline d'un volume / Compute volume deadline.

    SUIVI : dispatch_date + 2j, 06h si SAS correspondant, 09h sinon.
    MEAV  : samedi précédant la semaine de promo_start_date, 23h59.
    Fallback : activity_type vide → SUIVI, dispatch_date vide → tour.date.
    """
    act = (volume.activity_type or "").strip().upper()

    # Fallback : si pas d'activité, traiter comme SUIVI / Default to SUIVI
    if not act:
        act = "SUIVI"

    if act == "SUIVI":
        # Fallback dispatch_date → tour.date / Fallback to tour date
        dispatch_str = volume.dispatch_date or fallback_date
        if not dispatch_str:
            return None
        try:
            dispatch = datetime.strptime(dispatch_str, "%Y-%m-%d")
        except ValueError:
            return None
        deadline_date = dispatch + timedelta(days=2)

        # Vérifier SAS correspondant à la température / Check matching SAS
        temp = (volume.temperature_class.value if hasattr(volume.temperature_class, "value")
                else str(volume.temperature_class or "")).upper()
        has_sas = False
        if temp == "SEC":
            has_sas = bool(pdv.has_sas_sec)
        elif temp == "FRAIS":
            has_sas = bool(pdv.has_sas_frais)
        elif temp == "GEL":
            has_sas = bool(pdv.has_sas_gel)

        hour = 6 if has_sas else 9
        return deadline_date.replace(hour=hour, minute=0, second=0, microsecond=0)

    elif act == "MEAV":
        if not volume.promo_start_date:
            return None
        try:
            promo_start = datetime.strptime(volume.promo_start_date, "%Y-%m-%d")
        except ValueError:
            return None
        # Lundi de la semaine de promo / Monday of promo week
        promo_monday = promo_start - timedelta(days=promo_start.weekday())
        # Samedi précédent = lundi - 2 jours / Previous Saturday = monday - 2 days
        deadline_date = promo_monday - timedelta(days=2)
        return deadline_date.replace(hour=23, minute=59, second=0, microsecond=0)

    return None


def _parse_time_to_minutes(time_str: str | None) -> int | None:
    """Convertir HH:MM en minutes depuis minuit / Convert HH:MM to minutes since midnight."""
    if not time_str:
        return None
    try:
        parts = time_str.split(":")
        return int(parts[0]) * 60 + int(parts[1])
    except (ValueError, IndexError):
        return None


@router.get("/punctuality")
async def get_punctuality_kpi(
    date_from: str = Query(..., description="Date début (YYYY-MM-DD)"),
    date_to: str = Query(..., description="Date fin (YYYY-MM-DD)"),
    pdv_id: int | None = Query(None),
    activity_type: str | None = Query(None, description="SUIVI ou MEAV"),
    region_id: int | None = Query(None),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("dashboard", "read")),
):
    """Taux de ponctualité planifié et réel / Planned and actual punctuality rate."""

    # 1. Charger les tours complétés/en retour dans la plage / Load completed/returning tours
    tour_query = (
        select(Tour)
        .where(
            Tour.status.in_([TourStatus.COMPLETED, TourStatus.RETURNING, TourStatus.IN_PROGRESS]),
        )
    )

    # Filtrer par date (delivery_date ou date) / Filter by date
    # On utilise delivery_date si renseigné, sinon tour.date
    tour_query = tour_query.where(Tour.date >= date_from, Tour.date <= date_to)

    # Filtre région / Region filter
    user_regions = get_user_region_ids(user)
    if region_id:
        from app.models.base_logistics import BaseLogistics
        base_ids_q = select(BaseLogistics.id).where(BaseLogistics.region_id == region_id)
        tour_query = tour_query.where(Tour.base_id.in_(base_ids_q))
    elif user_regions:
        from app.models.base_logistics import BaseLogistics
        base_ids_q = select(BaseLogistics.id).where(BaseLogistics.region_id.in_(user_regions))
        tour_query = tour_query.where(Tour.base_id.in_(base_ids_q))

    result = await db.execute(tour_query)
    tours = result.scalars().all()

    if not tours:
        return {
            "summary": {
                "total_stops": 0, "with_deadline": 0,
                "planned": {"on_time": 0, "late": 0, "pct": 0},
                "actual": {"on_time": 0, "late": 0, "no_scan": 0, "pct": 0},
            },
            "by_activity": {},
            "by_date": [],
            "by_pdv": [],
        }

    tour_ids = [t.id for t in tours]
    tour_map = {t.id: t for t in tours}

    # 2. Charger les stops livrés / Load delivered stops
    stop_query = (
        select(TourStop)
        .where(TourStop.tour_id.in_(tour_ids))
    )
    if pdv_id:
        stop_query = stop_query.where(TourStop.pdv_id == pdv_id)

    result = await db.execute(stop_query)
    stops = result.scalars().all()

    # 3. Charger les volumes / Load volumes (inclut ceux sans activity_type → fallback SUIVI)
    vol_query = (
        select(Volume)
        .where(Volume.tour_id.in_(tour_ids))
    )
    if pdv_id:
        vol_query = vol_query.where(Volume.pdv_id == pdv_id)
    if activity_type:
        if activity_type.upper() == "SUIVI":
            # Inclure aussi les vides (fallback SUIVI) / Include empty (fallback SUIVI)
            vol_query = vol_query.where(
                (Volume.activity_type == "SUIVI") | (Volume.activity_type.is_(None)) | (Volume.activity_type == "")
            )
        else:
            vol_query = vol_query.where(Volume.activity_type == activity_type.upper())

    result = await db.execute(vol_query)
    all_volumes = result.scalars().all()

    # Indexer volumes par (tour_id, pdv_id) / Index volumes by (tour_id, pdv_id)
    vol_index: dict[tuple[int, int], list[Volume]] = {}
    for v in all_volumes:
        key = (v.tour_id, v.pdv_id)
        vol_index.setdefault(key, []).append(v)

    # 4. Charger les PDVs nécessaires / Load required PDVs
    pdv_ids = list({s.pdv_id for s in stops})
    if pdv_ids:
        result = await db.execute(select(PDV).where(PDV.id.in_(pdv_ids)))
        pdv_map = {p.id: p for p in result.scalars().all()}
    else:
        pdv_map = {}

    # 5. Premier scan par stop / First scan per stop
    scan_query = (
        select(SupportScan.tour_stop_id, func.min(SupportScan.timestamp))
        .where(SupportScan.tour_stop_id.in_([s.id for s in stops]))
        .group_by(SupportScan.tour_stop_id)
    )
    result = await db.execute(scan_query)
    first_scans: dict[int, str] = {row[0]: row[1] for row in result.all()}

    # 6. Calcul ponctualité / Compute punctuality
    # Accumulateurs
    total_stops = 0
    with_deadline = 0
    planned_on_time = 0
    planned_late = 0
    actual_on_time = 0
    actual_late = 0
    actual_no_scan = 0

    by_activity: dict[str, dict] = {}
    by_date_agg: dict[str, dict] = {}
    by_pdv_agg: dict[int, dict] = {}

    for stop in stops:
        tour = tour_map.get(stop.tour_id)
        if not tour:
            continue
        pdv = pdv_map.get(stop.pdv_id)
        if not pdv:
            continue

        vols = vol_index.get((stop.tour_id, stop.pdv_id), [])
        if not vols:
            continue

        total_stops += 1

        # Trouver la deadline la plus stricte / Find strictest deadline
        strictest_deadline: datetime | None = None
        strictest_activity: str | None = None
        # Fallback date = tour.date pour les volumes sans dispatch_date
        fallback_date = tour.date
        for v in vols:
            dl = _compute_deadline(v, pdv, fallback_date=fallback_date)
            if dl is not None:
                if strictest_deadline is None or dl < strictest_deadline:
                    strictest_deadline = dl
                    act_raw = (v.activity_type or "").strip().upper()
                    strictest_activity = act_raw if act_raw else "SUIVI"

        if strictest_deadline is None:
            continue

        with_deadline += 1
        act_key = strictest_activity or "UNKNOWN"

        # Date du tour pour agrégation / Tour date for aggregation
        tour_date = tour.delivery_date or tour.date

        # Init agrégateurs / Init aggregators
        if act_key not in by_activity:
            by_activity[act_key] = {
                "total": 0,
                "planned": {"on_time": 0, "late": 0},
                "actual": {"on_time": 0, "late": 0, "no_scan": 0},
            }
        by_activity[act_key]["total"] += 1

        if tour_date not in by_date_agg:
            by_date_agg[tour_date] = {"total": 0, "planned_ok": 0, "actual_ok": 0, "actual_counted": 0}
        by_date_agg[tour_date]["total"] += 1

        if stop.pdv_id not in by_pdv_agg:
            by_pdv_agg[stop.pdv_id] = {
                "pdv_code": pdv.code, "pdv_name": pdv.name,
                "total": 0, "planned_ok": 0, "actual_ok": 0, "actual_counted": 0,
            }
        by_pdv_agg[stop.pdv_id]["total"] += 1

        # --- Ponctualité planifiée / Planned punctuality ---
        delivery_date_str = tour.delivery_date or tour.date
        arrival_minutes = _parse_time_to_minutes(stop.arrival_time)
        if delivery_date_str and arrival_minutes is not None:
            try:
                planned_dt = datetime.strptime(delivery_date_str, "%Y-%m-%d").replace(
                    hour=arrival_minutes // 60,
                    minute=arrival_minutes % 60,
                )
                if planned_dt <= strictest_deadline:
                    planned_on_time += 1
                    by_activity[act_key]["planned"]["on_time"] += 1
                    by_date_agg[tour_date]["planned_ok"] += 1
                    by_pdv_agg[stop.pdv_id]["planned_ok"] += 1
                else:
                    planned_late += 1
                    by_activity[act_key]["planned"]["late"] += 1
            except ValueError:
                planned_late += 1
                by_activity[act_key]["planned"]["late"] += 1
        else:
            planned_late += 1
            by_activity[act_key]["planned"]["late"] += 1

        # --- Ponctualité réelle / Actual punctuality ---
        first_scan_ts = first_scans.get(stop.id)
        if not first_scan_ts:
            actual_no_scan += 1
            by_activity[act_key]["actual"]["no_scan"] += 1
        else:
            by_date_agg[tour_date]["actual_counted"] += 1
            by_pdv_agg[stop.pdv_id]["actual_counted"] += 1
            try:
                # ISO 8601 : YYYY-MM-DDTHH:MM:SS ou YYYY-MM-DDTHH:MM:SSZ
                actual_dt = datetime.fromisoformat(first_scan_ts)
                # Retirer le timezone pour comparer avec la deadline naïve / Strip tz for naive comparison
                if actual_dt.tzinfo is not None:
                    actual_dt = actual_dt.replace(tzinfo=None)
                if actual_dt <= strictest_deadline:
                    actual_on_time += 1
                    by_activity[act_key]["actual"]["on_time"] += 1
                    by_date_agg[tour_date]["actual_ok"] += 1
                    by_pdv_agg[stop.pdv_id]["actual_ok"] += 1
                else:
                    actual_late += 1
                    by_activity[act_key]["actual"]["late"] += 1
            except (ValueError, TypeError):
                actual_no_scan += 1
                by_activity[act_key]["actual"]["no_scan"] += 1

    # 7. Construire la réponse / Build response
    def pct(ok: int, total: int) -> float:
        return round(ok / total * 100, 1) if total > 0 else 0

    planned_total = planned_on_time + planned_late
    actual_total = actual_on_time + actual_late

    summary = {
        "total_stops": total_stops,
        "with_deadline": with_deadline,
        "planned": {"on_time": planned_on_time, "late": planned_late, "pct": pct(planned_on_time, planned_total)},
        "actual": {"on_time": actual_on_time, "late": actual_late, "no_scan": actual_no_scan, "pct": pct(actual_on_time, actual_total)},
    }

    by_activity_resp = {}
    for act, data in by_activity.items():
        p_total = data["planned"]["on_time"] + data["planned"]["late"]
        a_total = data["actual"]["on_time"] + data["actual"]["late"]
        by_activity_resp[act] = {
            "total": data["total"],
            "planned": {**data["planned"], "pct": pct(data["planned"]["on_time"], p_total)},
            "actual": {**data["actual"], "pct": pct(data["actual"]["on_time"], a_total)},
        }

    by_date_resp = sorted([
        {
            "date": d,
            "total": agg["total"],
            "planned_pct": pct(agg["planned_ok"], agg["total"]),
            "actual_pct": pct(agg["actual_ok"], agg["actual_counted"]) if agg["actual_counted"] > 0 else 0,
        }
        for d, agg in by_date_agg.items()
    ], key=lambda x: x["date"])

    by_pdv_resp = sorted([
        {
            "pdv_id": pid,
            "pdv_code": agg["pdv_code"],
            "pdv_name": agg["pdv_name"],
            "total": agg["total"],
            "planned_pct": pct(agg["planned_ok"], agg["total"]),
            "actual_pct": pct(agg["actual_ok"], agg["actual_counted"]) if agg["actual_counted"] > 0 else 0,
        }
        for pid, agg in by_pdv_agg.items()
    ], key=lambda x: x["planned_pct"])

    return {
        "summary": summary,
        "by_activity": by_activity_resp,
        "by_date": by_date_resp,
        "by_pdv": by_pdv_resp,
    }
