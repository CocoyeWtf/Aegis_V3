"""Routes KPI — taux de ponctualité CDC et opérationnelle / KPI routes — CDC and operational punctuality rate."""

from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.tour import Tour, TourStatus
from app.models.tour_stop import TourStop
from app.models.tour_surcharge import TourSurcharge, SurchargeStatus
from app.models.surcharge_type import SurchargeType
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
    """Taux de ponctualité CDC et opérationnelle / CDC and operational punctuality rate."""

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
                "cdc": {"on_time": 0, "late": 0, "no_scan": 0, "pct": 0},
                "operational": {"on_time": 0, "late": 0, "no_scan": 0, "pct": 0},
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
    # Accumulateurs CDC (scan vs deadline cahier des charges) / CDC accumulators
    total_stops = 0
    with_deadline = 0
    cdc_on_time = 0
    cdc_late = 0
    cdc_no_scan = 0
    # Accumulateurs opérationnels (scan vs heure planifiée) / Operational accumulators
    oper_on_time = 0
    oper_late = 0
    oper_no_scan = 0

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
                "cdc": {"on_time": 0, "late": 0, "no_scan": 0},
                "operational": {"on_time": 0, "late": 0, "no_scan": 0},
            }
        by_activity[act_key]["total"] += 1

        if tour_date not in by_date_agg:
            by_date_agg[tour_date] = {
                "total": 0,
                "cdc_ok": 0, "cdc_counted": 0,
                "oper_ok": 0, "oper_counted": 0,
            }
        by_date_agg[tour_date]["total"] += 1

        if stop.pdv_id not in by_pdv_agg:
            by_pdv_agg[stop.pdv_id] = {
                "pdv_code": pdv.code, "pdv_name": pdv.name,
                "total": 0,
                "cdc_ok": 0, "cdc_counted": 0,
                "oper_ok": 0, "oper_counted": 0,
            }
        by_pdv_agg[stop.pdv_id]["total"] += 1

        # Premier scan pour ce stop / First scan for this stop
        first_scan_ts = first_scans.get(stop.id)
        scan_dt: datetime | None = None
        if first_scan_ts:
            try:
                scan_dt = datetime.fromisoformat(first_scan_ts)
                if scan_dt.tzinfo is not None:
                    scan_dt = scan_dt.replace(tzinfo=None)
            except (ValueError, TypeError):
                scan_dt = None

        # --- Ponctualité CDC (scan vs deadline cahier des charges) ---
        if scan_dt is None:
            cdc_no_scan += 1
            by_activity[act_key]["cdc"]["no_scan"] += 1
        else:
            by_date_agg[tour_date]["cdc_counted"] += 1
            by_pdv_agg[stop.pdv_id]["cdc_counted"] += 1
            if scan_dt <= strictest_deadline:
                cdc_on_time += 1
                by_activity[act_key]["cdc"]["on_time"] += 1
                by_date_agg[tour_date]["cdc_ok"] += 1
                by_pdv_agg[stop.pdv_id]["cdc_ok"] += 1
            else:
                cdc_late += 1
                by_activity[act_key]["cdc"]["late"] += 1

        # --- Ponctualité opérationnelle (scan vs heure d'arrivée planifiée) ---
        delivery_date_str = tour.delivery_date or tour.date
        arrival_minutes = _parse_time_to_minutes(stop.arrival_time)
        planned_arrival_dt: datetime | None = None
        if delivery_date_str and arrival_minutes is not None:
            try:
                planned_arrival_dt = datetime.strptime(delivery_date_str, "%Y-%m-%d").replace(
                    hour=arrival_minutes // 60,
                    minute=arrival_minutes % 60,
                )
            except ValueError:
                planned_arrival_dt = None

        if scan_dt is None:
            oper_no_scan += 1
            by_activity[act_key]["operational"]["no_scan"] += 1
        elif planned_arrival_dt is None:
            # Pas d'heure planifiée → compté en retard / No planned time → counted as late
            oper_late += 1
            by_activity[act_key]["operational"]["late"] += 1
            by_date_agg[tour_date]["oper_counted"] += 1
            by_pdv_agg[stop.pdv_id]["oper_counted"] += 1
        else:
            by_date_agg[tour_date]["oper_counted"] += 1
            by_pdv_agg[stop.pdv_id]["oper_counted"] += 1
            if scan_dt <= planned_arrival_dt:
                oper_on_time += 1
                by_activity[act_key]["operational"]["on_time"] += 1
                by_date_agg[tour_date]["oper_ok"] += 1
                by_pdv_agg[stop.pdv_id]["oper_ok"] += 1
            else:
                oper_late += 1
                by_activity[act_key]["operational"]["late"] += 1

    # 7. Construire la réponse / Build response
    def pct(ok: int, total: int) -> float:
        return round(ok / total * 100, 1) if total > 0 else 0

    cdc_total = cdc_on_time + cdc_late
    oper_total = oper_on_time + oper_late

    summary = {
        "total_stops": total_stops,
        "with_deadline": with_deadline,
        "cdc": {"on_time": cdc_on_time, "late": cdc_late, "no_scan": cdc_no_scan, "pct": pct(cdc_on_time, cdc_total)},
        "operational": {"on_time": oper_on_time, "late": oper_late, "no_scan": oper_no_scan, "pct": pct(oper_on_time, oper_total)},
    }

    by_activity_resp = {}
    for act, data in by_activity.items():
        c_total = data["cdc"]["on_time"] + data["cdc"]["late"]
        o_total = data["operational"]["on_time"] + data["operational"]["late"]
        by_activity_resp[act] = {
            "total": data["total"],
            "cdc": {**data["cdc"], "pct": pct(data["cdc"]["on_time"], c_total)},
            "operational": {**data["operational"], "pct": pct(data["operational"]["on_time"], o_total)},
        }

    by_date_resp = sorted([
        {
            "date": d,
            "total": agg["total"],
            "cdc_pct": pct(agg["cdc_ok"], agg["cdc_counted"]) if agg["cdc_counted"] > 0 else 0,
            "operational_pct": pct(agg["oper_ok"], agg["oper_counted"]) if agg["oper_counted"] > 0 else 0,
        }
        for d, agg in by_date_agg.items()
    ], key=lambda x: x["date"])

    by_pdv_resp = sorted([
        {
            "pdv_id": pid,
            "pdv_code": agg["pdv_code"],
            "pdv_name": agg["pdv_name"],
            "total": agg["total"],
            "cdc_pct": pct(agg["cdc_ok"], agg["cdc_counted"]) if agg["cdc_counted"] > 0 else 0,
            "operational_pct": pct(agg["oper_ok"], agg["oper_counted"]) if agg["oper_counted"] > 0 else 0,
        }
        for pid, agg in by_pdv_agg.items()
    ], key=lambda x: x["cdc_pct"])

    return {
        "summary": summary,
        "by_activity": by_activity_resp,
        "by_date": by_date_resp,
        "by_pdv": by_pdv_resp,
    }


@router.get("/surcharges")
async def get_surcharges_kpi(
    date_from: str = Query(..., description="Date début (YYYY-MM-DD)"),
    date_to: str = Query(..., description="Date fin (YYYY-MM-DD)"),
    base_id: int | None = Query(None),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("dashboard", "read")),
):
    """KPI surcharges par mois et par type (validées uniquement) / Surcharges KPI by month and type (validated only)."""

    # 1. Charger les tours sur la période / Load tours in the period
    tour_query = select(Tour.id, Tour.date, Tour.base_id).where(
        Tour.date >= date_from, Tour.date <= date_to,
    )
    if base_id:
        tour_query = tour_query.where(Tour.base_id == base_id)
    # Scope région / Region scope
    user_regions = get_user_region_ids(user)
    if user_regions:
        from app.models.base_logistics import BaseLogistics
        base_ids_q = select(BaseLogistics.id).where(BaseLogistics.region_id.in_(user_regions))
        tour_query = tour_query.where(Tour.base_id.in_(base_ids_q))

    result = await db.execute(tour_query)
    tour_rows = result.all()
    if not tour_rows:
        return {"by_month": [], "by_type": [], "by_month_and_type": []}

    tour_ids = [r[0] for r in tour_rows]
    tour_date_map = {r[0]: r[1] for r in tour_rows}  # tour_id -> date

    # 2. Charger les surcharges VALIDATED / Load VALIDATED surcharges
    s_result = await db.execute(
        select(TourSurcharge).where(
            TourSurcharge.tour_id.in_(tour_ids),
            TourSurcharge.status == SurchargeStatus.VALIDATED,
        )
    )
    surcharges = s_result.scalars().all()

    if not surcharges:
        return {"by_month": [], "by_type": [], "by_month_and_type": []}

    # 3. Charger les types de surcharge / Load surcharge types
    type_ids = list({s.surcharge_type_id for s in surcharges if s.surcharge_type_id})
    type_map: dict[int, str] = {}
    if type_ids:
        t_result = await db.execute(select(SurchargeType).where(SurchargeType.id.in_(type_ids)))
        for t in t_result.scalars().all():
            type_map[t.id] = t.label

    # 4. Agréger / Aggregate
    by_month: dict[str, dict] = {}
    by_type: dict[int, dict] = {}
    by_month_and_type: dict[tuple[str, int], dict] = {}

    for s in surcharges:
        tour_date = tour_date_map.get(s.tour_id, "")
        month = tour_date[:7] if tour_date else "unknown"
        amount = float(s.amount)
        st_id = s.surcharge_type_id or 0
        st_label = type_map.get(st_id, s.motif or "Non typé")

        # by_month
        if month not in by_month:
            by_month[month] = {"month": month, "count": 0, "total_amount": 0.0}
        by_month[month]["count"] += 1
        by_month[month]["total_amount"] = round(by_month[month]["total_amount"] + amount, 2)

        # by_type
        if st_id not in by_type:
            by_type[st_id] = {"surcharge_type_id": st_id, "label": st_label, "count": 0, "total_amount": 0.0}
        by_type[st_id]["count"] += 1
        by_type[st_id]["total_amount"] = round(by_type[st_id]["total_amount"] + amount, 2)

        # by_month_and_type
        key = (month, st_id)
        if key not in by_month_and_type:
            by_month_and_type[key] = {
                "month": month, "surcharge_type_id": st_id, "label": st_label,
                "count": 0, "total_amount": 0.0,
            }
        by_month_and_type[key]["count"] += 1
        by_month_and_type[key]["total_amount"] = round(by_month_and_type[key]["total_amount"] + amount, 2)

    return {
        "by_month": sorted(by_month.values(), key=lambda x: x["month"]),
        "by_type": sorted(by_type.values(), key=lambda x: x["total_amount"], reverse=True),
        "by_month_and_type": sorted(by_month_and_type.values(), key=lambda x: (x["month"], x["label"])),
    }
