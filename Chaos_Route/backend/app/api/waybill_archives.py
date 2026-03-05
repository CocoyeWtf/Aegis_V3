"""Routes Archives CMR / CMR Waybill Archive API routes.

Gestion des lettres de voiture CMR : émission, archivage, registre.
CMR waybill management: issuance, archiving, registry.
"""

import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.tour import Tour
from app.models.tour_stop import TourStop
from app.models.base_logistics import BaseLogistics
from app.models.contract import Contract
from app.models.carrier import Carrier
from app.models.pdv import PDV
from app.models.volume import Volume
from app.models.vehicle import Vehicle
from app.models.waybill_archive import WaybillArchive, CMRStatus
from app.models.user import User
from app.schemas.waybill_archive import WaybillArchiveCreate, WaybillArchiveRead, WaybillArchiveUpdate
from app.api.deps import require_permission, get_user_region_ids

router = APIRouter()


async def _generate_cmr_number(db: AsyncSession) -> str:
    """Génère le prochain numéro CMR / Generate next CMR number.

    Format: CMR-YYYY-NNNNNN (séquentiel par année / sequential per year)
    """
    year = datetime.now(timezone.utc).year
    prefix = f"CMR-{year}-"
    result = await db.execute(
        select(func.max(WaybillArchive.cmr_number)).where(
            WaybillArchive.cmr_number.like(f"{prefix}%")
        )
    )
    last = result.scalar_one_or_none()
    if last:
        seq = int(last.split("-")[-1]) + 1
    else:
        seq = 1
    return f"{prefix}{seq:06d}"


async def _build_waybill_snapshot(tour: Tour, db: AsyncSession) -> dict:
    """Construit le snapshot complet du CMR / Build complete CMR snapshot.

    Capture toutes les données au moment de l'émission — immutable après.
    Captures all data at issuance time — immutable afterward.
    """
    base = await db.get(BaseLogistics, tour.base_id)
    contract = await db.get(Contract, tour.contract_id) if tour.contract_id else None

    carrier = None
    if contract and contract.carrier_id:
        carrier = await db.get(Carrier, contract.carrier_id)

    # Véhicule principal + tracteur / Main vehicle + tractor
    vehicle = await db.get(Vehicle, tour.vehicle_id) if tour.vehicle_id else None
    tractor = await db.get(Vehicle, tour.tractor_id) if tour.tractor_id else None

    # Stops + PDVs + Volumes
    stop_result = await db.execute(
        select(TourStop).where(TourStop.tour_id == tour.id).order_by(TourStop.sequence_order)
    )
    stops = stop_result.scalars().all()

    pdv_ids = [s.pdv_id for s in stops]
    pdvs_map: dict[int, PDV] = {}
    if pdv_ids:
        pdv_result = await db.execute(select(PDV).where(PDV.id.in_(pdv_ids)))
        for p in pdv_result.scalars().all():
            pdvs_map[p.id] = p

    volumes_map: dict[int, list[Volume]] = {}
    if pdv_ids:
        vol_result = await db.execute(select(Volume).where(Volume.tour_id == tour.id))
        for v in vol_result.scalars().all():
            volumes_map.setdefault(v.pdv_id, []).append(v)

    stops_data = []
    total_eqp = 0
    total_weight = 0.0
    for stop in stops:
        pdv = pdvs_map.get(stop.pdv_id)
        vols = volumes_map.get(stop.pdv_id, [])
        weight = sum(float(v.weight_kg or 0) for v in vols)
        temp_classes = list({v.temperature_class for v in vols if v.temperature_class})
        total_eqp += stop.eqp_count
        total_weight += weight
        stops_data.append({
            "sequence": stop.sequence_order,
            "pdv_code": pdv.code if pdv else f"#{stop.pdv_id}",
            "pdv_name": pdv.name if pdv else "",
            "address": pdv.address if pdv else "",
            "postal_code": pdv.postal_code if pdv else "",
            "city": pdv.city if pdv else "",
            "eqp_count": stop.eqp_count,
            "weight_kg": round(weight, 2),
            "temperature_classes": temp_classes,
            "pickup_cardboard": getattr(stop, "pickup_cardboard", False),
            "pickup_containers": getattr(stop, "pickup_containers", False),
            "pickup_returns": getattr(stop, "pickup_returns", False),
            "pickup_consignment": getattr(stop, "pickup_consignment", False),
        })

    # Dispatch info
    dispatch_date = None
    dispatch_time = None
    for vols in volumes_map.values():
        for v in vols:
            if v.dispatch_date:
                dispatch_date = v.dispatch_date
                dispatch_time = v.dispatch_time
                break
        if dispatch_date:
            break

    return {
        "tour_id": tour.id,
        "tour_code": tour.code,
        "date": tour.date,
        "delivery_date": tour.delivery_date,
        "dispatch_date": dispatch_date,
        "dispatch_time": dispatch_time,
        "departure_time": tour.departure_time,
        "return_time": tour.return_time,
        "driver_name": tour.driver_name,
        "trailer_number": tour.trailer_number,
        "dock_door_number": tour.dock_door_number,
        "remarks": tour.remarks,
        "base": {
            "code": base.code if base else "",
            "name": base.name if base else "",
            "address": base.address if base else "",
            "postal_code": base.postal_code if base else "",
            "city": base.city if base else "",
        } if base else None,
        "contract": {
            "code": contract.code,
            "transporter_name": carrier.name if carrier else contract.transporter_name,
            "vehicle_code": contract.vehicle_code,
            "vehicle_name": contract.vehicle_name,
            "temperature_type": contract.temperature_type.value if contract.temperature_type else None,
            "vehicle_type": contract.vehicle_type.value if contract.vehicle_type else None,
            "capacity_weight_kg": contract.capacity_weight_kg,
            "carrier_address": carrier.address if carrier else None,
            "carrier_postal_code": carrier.postal_code if carrier else None,
            "carrier_city": carrier.city if carrier else None,
            "carrier_country": carrier.country if carrier else None,
            "carrier_transport_license": carrier.transport_license if carrier else None,
            "carrier_vat_number": carrier.vat_number if carrier else None,
            "carrier_siren": carrier.siren if carrier else None,
            "carrier_phone": carrier.phone if carrier else None,
        } if contract else None,
        "vehicle_license_plate": vehicle.license_plate if vehicle else None,
        "tractor_license_plate": tractor.license_plate if tractor else None,
        "stops": stops_data,
        "total_eqp": total_eqp,
        "total_weight_kg": round(total_weight, 2),
    }


# ─── Endpoints intégrés aux tours / Tour-integrated endpoints ───


@router.post("/tours/{tour_id}/cmr/", response_model=WaybillArchiveRead, status_code=201)
async def issue_cmr(
    tour_id: int,
    data: WaybillArchiveCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("waybill-archives", "create")),
):
    """Émettre un CMR pour un tour / Issue a CMR for a tour.

    Crée l'archive, capture le snapshot, assigne un numéro CMR.
    Creates the archive, captures the snapshot, assigns a CMR number.
    """
    # Vérifier qu'il n'y a pas déjà un CMR pour ce tour / Check no CMR exists for this tour
    existing = await db.execute(
        select(WaybillArchive).where(WaybillArchive.tour_id == tour_id)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Un CMR existe déjà pour ce tour")

    tour_result = await db.execute(
        select(Tour).where(Tour.id == tour_id).options(selectinload(Tour.stops))
    )
    tour = tour_result.scalar_one_or_none()
    if not tour:
        raise HTTPException(status_code=404, detail="Tour not found")

    # Construire le snapshot / Build snapshot
    snapshot = await _build_waybill_snapshot(tour, db)
    cmr_number = await _generate_cmr_number(db)
    now = datetime.now(timezone.utc).isoformat()

    # Déterminer la region_id via la base / Determine region_id via base
    base = await db.get(BaseLogistics, tour.base_id)
    region_id = base.region_id if base else 1

    archive = WaybillArchive(
        cmr_number=cmr_number,
        tour_id=tour_id,
        region_id=region_id,
        status=CMRStatus.ISSUED,
        snapshot_json=json.dumps(snapshot, ensure_ascii=False, default=str),
        establishment_place=data.establishment_place or (snapshot["base"]["city"] if snapshot["base"] else None),
        establishment_date=tour.date,
        issued_at=now,
        issued_by_id=user.id,
        attached_documents=data.attached_documents,
        sender_instructions=data.sender_instructions,
        payment_instructions=data.payment_instructions,
        cash_on_delivery=data.cash_on_delivery,
        special_agreements=data.special_agreements,
    )
    db.add(archive)
    await db.flush()
    await db.refresh(archive)
    return archive


@router.get("/tours/{tour_id}/cmr")
async def get_tour_cmr(
    tour_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("waybill-archives", "read")),
):
    """Récupérer le CMR d'un tour / Get CMR for a tour."""
    result = await db.execute(
        select(WaybillArchive).where(WaybillArchive.tour_id == tour_id)
    )
    archive = result.scalar_one_or_none()
    if not archive:
        raise HTTPException(status_code=404, detail="Aucun CMR pour ce tour")
    return WaybillArchiveRead.model_validate(archive)


# ─── Registre CMR / CMR Registry ───


@router.get("/waybill-archives/", response_model=list[WaybillArchiveRead])
async def list_waybill_archives(
    status: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    search: str | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("waybill-archives", "read")),
):
    """Liste des CMR archivés / List archived CMRs (registry)."""
    query = select(WaybillArchive).order_by(WaybillArchive.id.desc())

    # Region scoping
    user_region_ids = get_user_region_ids(user)
    if user_region_ids is not None:
        query = query.where(WaybillArchive.region_id.in_(user_region_ids))

    if status:
        query = query.where(WaybillArchive.status == status)
    if date_from:
        query = query.where(WaybillArchive.establishment_date >= date_from)
    if date_to:
        query = query.where(WaybillArchive.establishment_date <= date_to)
    if search:
        query = query.where(
            WaybillArchive.cmr_number.contains(search)
        )

    result = await db.execute(query)
    return result.scalars().all()


@router.get("/waybill-archives/{archive_id}", response_model=WaybillArchiveRead)
async def get_waybill_archive(
    archive_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("waybill-archives", "read")),
):
    """Détail d'un CMR archivé / Get archived CMR detail."""
    archive = await db.get(WaybillArchive, archive_id)
    if not archive:
        raise HTTPException(status_code=404, detail="Archive not found")
    return archive


@router.put("/waybill-archives/{archive_id}", response_model=WaybillArchiveRead)
async def update_waybill_archive(
    archive_id: int,
    data: WaybillArchiveUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("waybill-archives", "update")),
):
    """Mettre à jour les champs éditables d'un CMR / Update editable CMR fields.

    Seuls les champs éditables peuvent être modifiés (réserves, remarques livraison, etc.).
    Le snapshot reste immutable.
    Only editable fields can be modified (reservations, delivery remarks, etc.).
    The snapshot remains immutable.
    """
    archive = await db.get(WaybillArchive, archive_id)
    if not archive:
        raise HTTPException(status_code=404, detail="Archive not found")
    if archive.status == CMRStatus.CANCELLED:
        raise HTTPException(status_code=400, detail="Impossible de modifier un CMR annulé")

    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(archive, key, value)

    archive.updated_at = datetime.now(timezone.utc).isoformat()
    await db.flush()
    await db.refresh(archive)
    return archive


@router.post("/waybill-archives/{archive_id}/deliver", response_model=WaybillArchiveRead)
async def mark_delivered(
    archive_id: int,
    recipient_name: str | None = None,
    delivery_remarks: str | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("waybill-archives", "update")),
):
    """Marquer un CMR comme livré / Mark CMR as delivered (case 24)."""
    archive = await db.get(WaybillArchive, archive_id)
    if not archive:
        raise HTTPException(status_code=404, detail="Archive not found")
    if archive.status != CMRStatus.ISSUED:
        raise HTTPException(status_code=400, detail="Seul un CMR ISSUED peut être marqué livré")

    archive.status = CMRStatus.DELIVERED
    archive.recipient_signed_at = datetime.now(timezone.utc).isoformat()
    if recipient_name:
        archive.recipient_name = recipient_name
    if delivery_remarks:
        archive.delivery_remarks = delivery_remarks
    archive.updated_at = datetime.now(timezone.utc).isoformat()
    await db.flush()
    await db.refresh(archive)
    return archive


@router.post("/waybill-archives/{archive_id}/cancel", response_model=WaybillArchiveRead)
async def cancel_cmr(
    archive_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("waybill-archives", "delete")),
):
    """Annuler un CMR / Cancel a CMR."""
    archive = await db.get(WaybillArchive, archive_id)
    if not archive:
        raise HTTPException(status_code=404, detail="Archive not found")
    if archive.status == CMRStatus.DELIVERED:
        raise HTTPException(status_code=400, detail="Impossible d'annuler un CMR déjà livré")

    archive.status = CMRStatus.CANCELLED
    archive.updated_at = datetime.now(timezone.utc).isoformat()
    await db.flush()
    await db.refresh(archive)
    return archive
