"""Routes PDV / Point of Sale API routes."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.pdv import PDV
from app.models.tour import Tour
from app.models.tour_stop import TourStop
from app.models.volume import Volume
from app.models.base_logistics import BaseLogistics
from app.models.user import User
from app.schemas.pdv import PDVCreate, PDVRead, PDVUpdate
from app.api.deps import require_permission, get_user_region_ids

router = APIRouter()


@router.get("/", response_model=list[PDVRead])
async def list_pdvs(
    region_id: int | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("pdvs", "read")),
):
    """Lister les PDV / List points of sale."""
    query = select(PDV)
    if region_id is not None:
        query = query.where(PDV.region_id == region_id)
    user_region_ids = get_user_region_ids(user)
    if user_region_ids is not None:
        query = query.where(PDV.region_id.in_(user_region_ids))
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/delivery-schedule/")
async def get_delivery_schedule(
    date_from: str = Query(..., description="Date début YYYY-MM-DD"),
    date_to: str = Query(..., description="Date fin YYYY-MM-DD"),
    base_id: int | None = None,
    pdv_id: int | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("pdvs", "read")),
):
    """Planning livraisons PDV / PDV delivery schedule.
    Jointure Tour → TourStop → PDV + agrégation volumes par température.
    """
    # Date effective = delivery_date si renseigné, sinon date / Effective date = delivery_date or date
    effective_date = func.coalesce(Tour.delivery_date, Tour.date)

    # Requête tours validés+ dans la plage de dates / Query validated+ tours in date range
    query = (
        select(Tour)
        .where(effective_date >= date_from, effective_date <= date_to)
        .where(Tour.status.in_(["VALIDATED", "IN_PROGRESS", "RETURNING", "COMPLETED"]))
        .options(selectinload(Tour.stops))
    )
    if base_id is not None:
        query = query.where(Tour.base_id == base_id)

    # Region scoping
    user_region_ids = get_user_region_ids(user)

    result = await db.execute(query)
    tours = result.scalars().all()

    # Collecter tous les PDV ids et base ids / Collect all PDV and base IDs
    all_pdv_ids: set[int] = set()
    all_base_ids: set[int] = set()
    tour_ids: list[int] = []
    for tour in tours:
        tour_ids.append(tour.id)
        all_base_ids.add(tour.base_id)
        for stop in tour.stops:
            all_pdv_ids.add(stop.pdv_id)

    if not all_pdv_ids:
        return []

    # Charger PDVs (avec filtre region scoping) / Load PDVs with region scoping
    pdv_query = select(PDV).where(PDV.id.in_(all_pdv_ids))
    if user_region_ids is not None:
        pdv_query = pdv_query.where(PDV.region_id.in_(user_region_ids))
    if pdv_id is not None:
        pdv_query = pdv_query.where(PDV.id == pdv_id)
    pdv_result = await db.execute(pdv_query)
    pdvs_map: dict[int, PDV] = {p.id: p for p in pdv_result.scalars().all()}

    if not pdvs_map:
        return []

    # Charger bases / Load bases
    base_result = await db.execute(select(BaseLogistics).where(BaseLogistics.id.in_(all_base_ids)))
    bases_map: dict[int, BaseLogistics] = {b.id: b for b in base_result.scalars().all()}

    # Charger volumes par tour_id / Load volumes grouped by tour_id
    volumes_by_tour_pdv: dict[tuple[int, int], list[Volume]] = {}
    if tour_ids:
        vol_result = await db.execute(
            select(Volume).where(Volume.tour_id.in_(tour_ids))
        )
        for v in vol_result.scalars().all():
            key = (v.tour_id, v.pdv_id)
            volumes_by_tour_pdv.setdefault(key, []).append(v)

    # Construire la réponse flat / Build flat response
    entries = []
    for tour in tours:
        base = bases_map.get(tour.base_id)
        for stop in sorted(tour.stops, key=lambda s: s.sequence_order):
            pdv = pdvs_map.get(stop.pdv_id)
            if not pdv:
                continue
            vols = volumes_by_tour_pdv.get((tour.id, stop.pdv_id), [])
            eqp = stop.eqp_count if stop.eqp_count else sum(v.eqp_count for v in vols)
            temp_classes = sorted({v.temperature_class for v in vols if v.temperature_class})
            entries.append({
                "pdv_id": pdv.id,
                "pdv_code": pdv.code,
                "pdv_name": pdv.name,
                "delivery_date": tour.delivery_date or tour.date,
                "tour_code": tour.code,
                "tour_id": tour.id,
                "departure_time": tour.departure_time or "",
                "arrival_time": stop.arrival_time or "",
                "eqp_count": eqp,
                "temperature_classes": temp_classes,
                "tour_status": tour.status,
                "base_code": base.code if base else "",
                "base_name": base.name if base else "",
            })

    # Tri par pdv_code → delivery_date → arrival_time / Sort by pdv_code → date → arrival
    entries.sort(key=lambda e: (e["pdv_code"], e["delivery_date"], e["arrival_time"]))
    return entries


@router.get("/{pdv_id}", response_model=PDVRead)
async def get_pdv(
    pdv_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("pdvs", "read")),
):
    pdv = await db.get(PDV, pdv_id)
    if not pdv:
        raise HTTPException(status_code=404, detail="PDV not found")
    return pdv


@router.post("/", response_model=PDVRead, status_code=201)
async def create_pdv(
    data: PDVCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("pdvs", "create")),
):
    pdv = PDV(**data.model_dump())
    db.add(pdv)
    await db.flush()
    await db.refresh(pdv)
    return pdv


@router.put("/{pdv_id}", response_model=PDVRead)
async def update_pdv(
    pdv_id: int,
    data: PDVUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("pdvs", "update")),
):
    pdv = await db.get(PDV, pdv_id)
    if not pdv:
        raise HTTPException(status_code=404, detail="PDV not found")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(pdv, key, value)
    await db.flush()
    await db.refresh(pdv)
    return pdv


@router.delete("/{pdv_id}", status_code=204)
async def delete_pdv(
    pdv_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("pdvs", "delete")),
):
    pdv = await db.get(PDV, pdv_id)
    if not pdv:
        raise HTTPException(status_code=404, detail="PDV not found")
    await db.delete(pdv)
