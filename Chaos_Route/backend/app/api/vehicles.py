"""Routes Vehicules / Vehicle API routes."""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.vehicle import FleetVehicleType, Vehicle, VehicleStatus
from app.models.user import User
from app.schemas.vehicle import VehicleCreate, VehicleRead, VehicleSummary, VehicleUpdate
from app.api.deps import require_permission, get_user_region_ids

router = APIRouter()


@router.get("/", response_model=list[VehicleRead])
async def list_vehicles(
    region_id: int | None = None,
    status: str | None = None,
    fleet_vehicle_type: str | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("vehicles", "read")),
):
    """Lister les vehicules / List vehicles."""
    query = select(Vehicle).order_by(Vehicle.code)
    if region_id is not None:
        query = query.where(Vehicle.region_id == region_id)
    if status is not None:
        query = query.where(Vehicle.status == VehicleStatus(status))
    if fleet_vehicle_type is not None:
        query = query.where(Vehicle.fleet_vehicle_type == FleetVehicleType(fleet_vehicle_type))
    user_region_ids = get_user_region_ids(user)
    if user_region_ids is not None:
        query = query.where(Vehicle.region_id.in_(user_region_ids))
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/summary", response_model=list[VehicleSummary])
async def list_vehicles_summary(
    fleet_vehicle_type: str | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("vehicles", "read")),
):
    """Liste simplifiee pour dropdowns / Summary list for dropdowns."""
    query = select(Vehicle).where(Vehicle.status == VehicleStatus.ACTIVE).order_by(Vehicle.code)
    if fleet_vehicle_type is not None:
        query = query.where(Vehicle.fleet_vehicle_type == FleetVehicleType(fleet_vehicle_type))
    user_region_ids = get_user_region_ids(user)
    if user_region_ids is not None:
        query = query.where(Vehicle.region_id.in_(user_region_ids))
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/{vehicle_id}", response_model=VehicleRead)
async def get_vehicle(
    vehicle_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("vehicles", "read")),
):
    """Voir un vehicule / Get vehicle detail."""
    vehicle = await db.get(Vehicle, vehicle_id)
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    return vehicle


@router.post("/", response_model=VehicleRead, status_code=201)
async def create_vehicle(
    data: VehicleCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("vehicles", "create")),
):
    """Creer un vehicule / Create vehicle."""
    dump = data.model_dump()
    # Convertir enums string en valeurs enum / Convert string enums to enum values
    dump["fleet_vehicle_type"] = FleetVehicleType(dump["fleet_vehicle_type"])
    dump["status"] = VehicleStatus(dump.get("status") or "ACTIVE")
    now = datetime.now(timezone.utc).isoformat(timespec="seconds")
    dump["last_km_update"] = now if dump.get("current_km") else None
    vehicle = Vehicle(**dump)
    db.add(vehicle)
    await db.flush()
    await db.refresh(vehicle)
    return vehicle


@router.put("/{vehicle_id}", response_model=VehicleRead)
async def update_vehicle(
    vehicle_id: int,
    data: VehicleUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("vehicles", "update")),
):
    """Modifier un vehicule / Update vehicle."""
    vehicle = await db.get(Vehicle, vehicle_id)
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")

    updates = data.model_dump(exclude_unset=True)

    # Si km change, maj last_km_update / If km changes, update timestamp
    if "current_km" in updates and updates["current_km"] is not None:
        updates["last_km_update"] = datetime.now(timezone.utc).isoformat(timespec="seconds")

    for key, value in updates.items():
        setattr(vehicle, key, value)

    await db.flush()
    await db.refresh(vehicle)
    return vehicle


@router.delete("/{vehicle_id}", status_code=204)
async def delete_vehicle(
    vehicle_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("vehicles", "delete")),
):
    """Supprimer un vehicule / Delete vehicle."""
    vehicle = await db.get(Vehicle, vehicle_id)
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    await db.delete(vehicle)
