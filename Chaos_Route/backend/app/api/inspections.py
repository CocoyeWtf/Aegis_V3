"""Routes inspections vehicule / Vehicle inspection routes."""

import os
import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.inspection_template import InspectionTemplate
from app.models.vehicle import Vehicle
from app.models.vehicle_inspection import (
    InspectionItem,
    InspectionItemResult,
    InspectionPhoto,
    InspectionStatus,
    InspectionType,
    VehicleInspection,
)
from app.models.tour import Tour
from app.models.mobile_device import MobileDevice
from app.models.user import User
from app.schemas.inspection import (
    InspectionCheckResponse,
    InspectionCheckVehicle,
    InspectionCompleteRequest,
    InspectionItemRead,
    InspectionItemsSubmit,
    InspectionPhotoRead,
    InspectionRead,
    InspectionStartRequest,
    InspectionStartResponse,
    InspectionTemplateCreate,
    InspectionTemplateRead,
    InspectionTemplateUpdate,
)
from app.api.deps import get_authenticated_device, require_permission

router = APIRouter()

INSPECTION_PHOTOS_DIR = Path("data/photos/inspections")
MAX_PHOTOS_PER_INSPECTION = 20
MAX_PHOTO_SIZE = 5 * 1024 * 1024  # 5 MB


def _inspection_to_read(insp: VehicleInspection) -> InspectionRead:
    """Convertir inspection ORM en schema Read / Convert ORM to Read schema."""
    return InspectionRead(
        id=insp.id,
        vehicle_id=insp.vehicle_id,
        tour_id=insp.tour_id,
        device_id=insp.device_id,
        inspection_type=insp.inspection_type.value,
        status=insp.status.value,
        driver_name=insp.driver_name,
        km_at_inspection=insp.km_at_inspection,
        latitude=insp.latitude,
        longitude=insp.longitude,
        started_at=insp.started_at,
        completed_at=insp.completed_at,
        remarks=insp.remarks,
        has_critical_defect=insp.has_critical_defect,
        vehicle_code=insp.vehicle.code if insp.vehicle else None,
        vehicle_name=insp.vehicle.name if insp.vehicle else None,
        items=[InspectionItemRead(
            id=it.id, inspection_id=it.inspection_id, template_id=it.template_id,
            label=it.label, category=it.category, result=it.result.value,
            comment=it.comment, is_critical=it.is_critical,
            requires_photo=it.requires_photo,
        ) for it in (insp.items or [])],
        photos=[InspectionPhotoRead(
            id=p.id, inspection_id=p.inspection_id, item_id=p.item_id,
            filename=p.filename, file_size=p.file_size,
            mime_type=p.mime_type, uploaded_at=p.uploaded_at,
        ) for p in (insp.photos or [])],
    )


# ─── Templates CRUD (JWT auth) ───

@router.get("/templates/", response_model=list[InspectionTemplateRead])
async def list_templates(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("inspections", "read")),
):
    result = await db.execute(
        select(InspectionTemplate).order_by(InspectionTemplate.display_order, InspectionTemplate.id)
    )
    return result.scalars().all()


@router.post("/templates/", response_model=InspectionTemplateRead, status_code=201)
async def create_template(
    data: InspectionTemplateCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("inspections", "create")),
):
    tpl = InspectionTemplate(**data.model_dump())
    db.add(tpl)
    await db.flush()
    await db.refresh(tpl)
    return tpl


@router.put("/templates/{template_id}", response_model=InspectionTemplateRead)
async def update_template(
    template_id: int,
    data: InspectionTemplateUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("inspections", "update")),
):
    tpl = await db.get(InspectionTemplate, template_id)
    if not tpl:
        raise HTTPException(status_code=404, detail="Template not found")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(tpl, key, value)
    await db.flush()
    await db.refresh(tpl)
    return tpl


@router.delete("/templates/{template_id}", status_code=204)
async def delete_template(
    template_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("inspections", "delete")),
):
    tpl = await db.get(InspectionTemplate, template_id)
    if not tpl:
        raise HTTPException(status_code=404, detail="Template not found")
    await db.delete(tpl)


# ─── Inspections web admin (JWT auth) ───

@router.get("/", response_model=list[InspectionRead])
async def list_inspections(
    vehicle_id: int | None = None,
    tour_id: int | None = None,
    inspection_type: str | None = None,
    has_defects: bool | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("inspections", "read")),
):
    query = (
        select(VehicleInspection)
        .options(selectinload(VehicleInspection.items), selectinload(VehicleInspection.photos),
                 selectinload(VehicleInspection.vehicle))
        .order_by(VehicleInspection.id.desc())
    )
    if vehicle_id is not None:
        query = query.where(VehicleInspection.vehicle_id == vehicle_id)
    if tour_id is not None:
        query = query.where(VehicleInspection.tour_id == tour_id)
    if inspection_type is not None:
        query = query.where(VehicleInspection.inspection_type == InspectionType(inspection_type))
    if has_defects is True:
        query = query.where(VehicleInspection.has_critical_defect == True)
    if date_from:
        query = query.where(VehicleInspection.started_at >= date_from)
    if date_to:
        query = query.where(VehicleInspection.started_at <= date_to + "T23:59:59")

    result = await db.execute(query.limit(200))
    inspections = result.scalars().all()
    return [_inspection_to_read(i) for i in inspections]


@router.get("/{inspection_id}", response_model=InspectionRead)
async def get_inspection(
    inspection_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("inspections", "read")),
):
    result = await db.execute(
        select(VehicleInspection)
        .options(selectinload(VehicleInspection.items), selectinload(VehicleInspection.photos),
                 selectinload(VehicleInspection.vehicle))
        .where(VehicleInspection.id == inspection_id)
    )
    insp = result.scalar_one_or_none()
    if not insp:
        raise HTTPException(status_code=404, detail="Inspection not found")
    return _inspection_to_read(insp)


@router.get("/{inspection_id}/photos/{photo_id}")
async def get_inspection_photo(
    inspection_id: int,
    photo_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Servir une photo d'inspection / Serve inspection photo."""
    photo = await db.get(InspectionPhoto, photo_id)
    if not photo or photo.inspection_id != inspection_id:
        raise HTTPException(status_code=404, detail="Photo not found")
    if not os.path.exists(photo.file_path):
        raise HTTPException(status_code=404, detail="Photo file missing")
    from fastapi.responses import FileResponse
    return FileResponse(photo.file_path, media_type=photo.mime_type or "image/jpeg")


# ─── Endpoints mobile (device auth) ───

@router.post("/driver/start", response_model=InspectionStartResponse)
async def start_inspection_driver(
    data: InspectionStartRequest,
    db: AsyncSession = Depends(get_db),
    device: MobileDevice = Depends(get_authenticated_device),
):
    """Demarrer une inspection depuis le mobile / Start inspection from mobile."""
    vehicle = await db.get(Vehicle, data.vehicle_id)
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")

    now = datetime.now(timezone.utc).isoformat(timespec="seconds")

    inspection = VehicleInspection(
        vehicle_id=data.vehicle_id,
        tour_id=data.tour_id,
        device_id=device.id,
        inspection_type=InspectionType(data.inspection_type),
        status=InspectionStatus.IN_PROGRESS,
        driver_name=data.driver_name,
        km_at_inspection=data.km_at_inspection,
        latitude=data.latitude,
        longitude=data.longitude,
        started_at=now,
    )
    db.add(inspection)
    await db.flush()

    # Charger les templates pour ce type de vehicule / Load templates for this vehicle type
    vtype = vehicle.fleet_vehicle_type.value
    result = await db.execute(
        select(InspectionTemplate)
        .where(InspectionTemplate.is_active == True)
        .order_by(InspectionTemplate.display_order, InspectionTemplate.id)
    )
    templates = result.scalars().all()

    # Filtrer par type vehicule applicable / Filter by applicable vehicle type
    applicable = []
    for tpl in templates:
        if tpl.applicable_vehicle_types is None:
            applicable.append(tpl)
        elif vtype in tpl.applicable_vehicle_types.split(","):
            applicable.append(tpl)

    # Creer les items / Create items
    items = []
    for tpl in applicable:
        item = InspectionItem(
            inspection_id=inspection.id,
            template_id=tpl.id,
            label=tpl.label,
            category=tpl.category.value,
            result=InspectionItemResult.NOT_CHECKED,
            is_critical=tpl.is_critical,
            requires_photo=tpl.requires_photo,
        )
        db.add(item)
        items.append(item)

    await db.flush()
    for item in items:
        await db.refresh(item)

    return InspectionStartResponse(
        inspection_id=inspection.id,
        items=[InspectionItemRead(
            id=it.id, inspection_id=it.inspection_id, template_id=it.template_id,
            label=it.label, category=it.category, result=it.result.value,
            comment=it.comment, is_critical=it.is_critical,
            requires_photo=it.requires_photo,
        ) for it in items],
    )


@router.put("/driver/{inspection_id}/items")
async def submit_items_driver(
    inspection_id: int,
    data: InspectionItemsSubmit,
    db: AsyncSession = Depends(get_db),
    device: MobileDevice = Depends(get_authenticated_device),
):
    """Soumettre les resultats des items (batch) / Submit item results (batch)."""
    insp = await db.get(VehicleInspection, inspection_id)
    if not insp or insp.device_id != device.id:
        raise HTTPException(status_code=404, detail="Inspection not found")

    for item_data in data.items:
        item = await db.get(InspectionItem, item_data.item_id)
        if not item or item.inspection_id != inspection_id:
            continue
        item.result = InspectionItemResult(item_data.result)
        if item_data.comment is not None:
            item.comment = item_data.comment

    await db.flush()
    return {"ok": True}


@router.post("/driver/{inspection_id}/complete")
async def complete_inspection_driver(
    inspection_id: int,
    data: InspectionCompleteRequest,
    db: AsyncSession = Depends(get_db),
    device: MobileDevice = Depends(get_authenticated_device),
):
    """Finaliser l'inspection / Complete inspection."""
    insp = await db.get(VehicleInspection, inspection_id)
    if not insp or insp.device_id != device.id:
        raise HTTPException(status_code=404, detail="Inspection not found")

    now = datetime.now(timezone.utc).isoformat(timespec="seconds")
    insp.completed_at = now
    insp.status = InspectionStatus.COMPLETED
    if data.remarks:
        insp.remarks = data.remarks

    # Verifier si defaut critique / Check for critical defect
    result = await db.execute(
        select(InspectionItem).where(
            InspectionItem.inspection_id == inspection_id,
            InspectionItem.is_critical == True,
            InspectionItem.result == InspectionItemResult.KO,
        )
    )
    if result.scalars().first():
        insp.has_critical_defect = True

    # Mettre a jour le km du vehicule / Update vehicle km
    if insp.km_at_inspection:
        vehicle = await db.get(Vehicle, insp.vehicle_id)
        if vehicle and (not vehicle.current_km or insp.km_at_inspection > vehicle.current_km):
            vehicle.current_km = insp.km_at_inspection
            vehicle.last_km_update = now

    await db.flush()
    return {"ok": True, "has_critical_defect": insp.has_critical_defect}


@router.post("/driver/{inspection_id}/photos", response_model=InspectionPhotoRead, status_code=201)
async def upload_photo_driver(
    inspection_id: int,
    file: UploadFile = File(...),
    item_id: int | None = None,
    db: AsyncSession = Depends(get_db),
    device: MobileDevice = Depends(get_authenticated_device),
):
    """Upload photo pour une inspection / Upload inspection photo."""
    insp = await db.get(VehicleInspection, inspection_id)
    if not insp or insp.device_id != device.id:
        raise HTTPException(status_code=404, detail="Inspection not found")

    # Verifier nombre de photos / Check photo count
    result = await db.execute(
        select(InspectionPhoto).where(InspectionPhoto.inspection_id == inspection_id)
    )
    if len(result.scalars().all()) >= MAX_PHOTOS_PER_INSPECTION:
        raise HTTPException(status_code=400, detail=f"Max {MAX_PHOTOS_PER_INSPECTION} photos par inspection")

    content = await file.read()
    if len(content) > MAX_PHOTO_SIZE:
        raise HTTPException(status_code=400, detail="Photo trop volumineuse (max 5 MB)")

    mime = file.content_type or "image/jpeg"
    if not mime.startswith("image/"):
        raise HTTPException(status_code=400, detail="Seules les images sont acceptees")

    ext = mime.split("/")[-1].replace("jpeg", "jpg")
    unique_name = f"{uuid.uuid4().hex[:12]}.{ext}"
    photo_dir = INSPECTION_PHOTOS_DIR / str(inspection_id)
    photo_dir.mkdir(parents=True, exist_ok=True)
    file_path = photo_dir / unique_name
    file_path.write_bytes(content)

    now = datetime.now(timezone.utc).isoformat(timespec="seconds")
    photo = InspectionPhoto(
        inspection_id=inspection_id,
        item_id=item_id,
        filename=file.filename or unique_name,
        file_path=str(file_path),
        file_size=len(content),
        mime_type=mime,
        uploaded_at=now,
    )
    db.add(photo)
    await db.flush()
    return photo


@router.get("/driver/check/{tour_id}", response_model=InspectionCheckResponse)
async def check_inspection_driver(
    tour_id: int,
    db: AsyncSession = Depends(get_db),
    device: MobileDevice = Depends(get_authenticated_device),
):
    """Verifier si inspection pre-depart faite pour le tour / Check pre-departure inspection status."""
    tour = await db.get(Tour, tour_id)
    if not tour:
        raise HTTPException(status_code=404, detail="Tour not found")

    # Collecter les vehicules propres du tour / Collect own vehicles on this tour
    vehicle_ids = []
    if tour.vehicle_id:
        vehicle_ids.append(tour.vehicle_id)
    if tour.tractor_id:
        vehicle_ids.append(tour.tractor_id)

    if not vehicle_ids:
        # Tour 100% preste — pas d'inspection requise
        return InspectionCheckResponse(required=False, vehicles=[])

    # Charger les vehicules / Load vehicles
    result = await db.execute(select(Vehicle).where(Vehicle.id.in_(vehicle_ids)))
    vehicles = result.scalars().all()

    # Verifier inspections existantes / Check existing inspections
    checks = []
    for v in vehicles:
        insp_result = await db.execute(
            select(VehicleInspection).where(
                VehicleInspection.vehicle_id == v.id,
                VehicleInspection.tour_id == tour_id,
                VehicleInspection.inspection_type == InspectionType.PRE_DEPARTURE,
                VehicleInspection.status == InspectionStatus.COMPLETED,
            )
        )
        existing = insp_result.scalar_one_or_none()
        checks.append(InspectionCheckVehicle(
            id=v.id,
            code=v.code,
            name=v.name,
            fleet_vehicle_type=v.fleet_vehicle_type.value,
            inspection_done=existing is not None,
            inspection_id=existing.id if existing else None,
        ))

    return InspectionCheckResponse(required=True, vehicles=checks)
