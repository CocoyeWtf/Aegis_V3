"""Routes gestion de flotte / Fleet management routes."""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.vehicle import Vehicle
from app.models.vehicle_maintenance import (
    MaintenanceScheduleRule,
    MaintenanceType,
    VehicleMaintenanceRecord,
)
from app.models.vehicle_fuel import VehicleFuelEntry
from app.models.vehicle_modification import VehicleModification
from app.models.vehicle_cost_entry import CostCategory, VehicleCostEntry
from app.models.user import User
from app.schemas.fleet import (
    CostEntryCreate,
    CostEntryRead,
    CostEntryUpdate,
    FleetDashboardResponse,
    FuelEntryCreate,
    FuelEntryRead,
    FuelEntryUpdate,
    MaintenanceRecordCreate,
    MaintenanceRecordRead,
    MaintenanceRecordUpdate,
    ModificationCreate,
    ModificationRead,
    ModificationUpdate,
    ScheduleRuleCreate,
    ScheduleRuleRead,
    ScheduleRuleUpdate,
    VehicleTCOItem,
)
from app.api.deps import require_permission

router = APIRouter()


# ─── Maintenance CRUD ───

@router.get("/maintenance/", response_model=list[MaintenanceRecordRead])
async def list_maintenance(
    vehicle_id: int | None = None,
    status: str | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("fleet", "read")),
):
    query = select(VehicleMaintenanceRecord).order_by(VehicleMaintenanceRecord.id.desc())
    if vehicle_id is not None:
        query = query.where(VehicleMaintenanceRecord.vehicle_id == vehicle_id)
    if status is not None:
        query = query.where(VehicleMaintenanceRecord.status == status)
    result = await db.execute(query.limit(500))
    return result.scalars().all()


@router.post("/maintenance/", response_model=MaintenanceRecordRead, status_code=201)
async def create_maintenance(
    data: MaintenanceRecordCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("fleet", "create")),
):
    dump = data.model_dump()
    dump["created_at"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
    record = VehicleMaintenanceRecord(**dump)
    db.add(record)
    await db.flush()
    await db.refresh(record)
    return record


@router.put("/maintenance/{record_id}", response_model=MaintenanceRecordRead)
async def update_maintenance(
    record_id: int,
    data: MaintenanceRecordUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("fleet", "update")),
):
    record = await db.get(VehicleMaintenanceRecord, record_id)
    if not record:
        raise HTTPException(status_code=404, detail="Maintenance record not found")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(record, key, value)
    await db.flush()
    await db.refresh(record)
    return record


@router.delete("/maintenance/{record_id}", status_code=204)
async def delete_maintenance(
    record_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("fleet", "delete")),
):
    record = await db.get(VehicleMaintenanceRecord, record_id)
    if not record:
        raise HTTPException(status_code=404, detail="Maintenance record not found")
    await db.delete(record)


@router.get("/maintenance/alerts", response_model=list[MaintenanceRecordRead])
async def maintenance_alerts(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("fleet", "read")),
):
    """Entretiens planifies a venir / Upcoming scheduled maintenance."""
    result = await db.execute(
        select(VehicleMaintenanceRecord)
        .where(VehicleMaintenanceRecord.status == "SCHEDULED")
        .order_by(VehicleMaintenanceRecord.scheduled_date)
        .limit(50)
    )
    return result.scalars().all()


# ─── Schedule Rules CRUD ───

@router.get("/schedule-rules/", response_model=list[ScheduleRuleRead])
async def list_schedule_rules(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("fleet", "read")),
):
    result = await db.execute(select(MaintenanceScheduleRule).order_by(MaintenanceScheduleRule.id))
    return result.scalars().all()


@router.post("/schedule-rules/", response_model=ScheduleRuleRead, status_code=201)
async def create_schedule_rule(
    data: ScheduleRuleCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("fleet", "create")),
):
    rule = MaintenanceScheduleRule(**data.model_dump())
    db.add(rule)
    await db.flush()
    await db.refresh(rule)
    return rule


@router.put("/schedule-rules/{rule_id}", response_model=ScheduleRuleRead)
async def update_schedule_rule(
    rule_id: int,
    data: ScheduleRuleUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("fleet", "update")),
):
    rule = await db.get(MaintenanceScheduleRule, rule_id)
    if not rule:
        raise HTTPException(status_code=404, detail="Schedule rule not found")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(rule, key, value)
    await db.flush()
    await db.refresh(rule)
    return rule


@router.delete("/schedule-rules/{rule_id}", status_code=204)
async def delete_schedule_rule(
    rule_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("fleet", "delete")),
):
    rule = await db.get(MaintenanceScheduleRule, rule_id)
    if not rule:
        raise HTTPException(status_code=404, detail="Schedule rule not found")
    await db.delete(rule)


# ─── Fuel CRUD ───

@router.get("/fuel/", response_model=list[FuelEntryRead])
async def list_fuel(
    vehicle_id: int | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("fleet", "read")),
):
    query = select(VehicleFuelEntry).order_by(VehicleFuelEntry.id.desc())
    if vehicle_id is not None:
        query = query.where(VehicleFuelEntry.vehicle_id == vehicle_id)
    result = await db.execute(query.limit(500))
    return result.scalars().all()


@router.post("/fuel/", response_model=FuelEntryRead, status_code=201)
async def create_fuel(
    data: FuelEntryCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("fleet", "create")),
):
    entry = VehicleFuelEntry(**data.model_dump())
    db.add(entry)
    await db.flush()
    await db.refresh(entry)
    return entry


@router.put("/fuel/{entry_id}", response_model=FuelEntryRead)
async def update_fuel(
    entry_id: int,
    data: FuelEntryUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("fleet", "update")),
):
    entry = await db.get(VehicleFuelEntry, entry_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Fuel entry not found")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(entry, key, value)
    await db.flush()
    await db.refresh(entry)
    return entry


@router.delete("/fuel/{entry_id}", status_code=204)
async def delete_fuel(
    entry_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("fleet", "delete")),
):
    entry = await db.get(VehicleFuelEntry, entry_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Fuel entry not found")
    await db.delete(entry)


# ─── Modifications CRUD ───

@router.get("/modifications/", response_model=list[ModificationRead])
async def list_modifications(
    vehicle_id: int | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("fleet", "read")),
):
    query = select(VehicleModification).order_by(VehicleModification.id.desc())
    if vehicle_id is not None:
        query = query.where(VehicleModification.vehicle_id == vehicle_id)
    result = await db.execute(query.limit(500))
    return result.scalars().all()


@router.post("/modifications/", response_model=ModificationRead, status_code=201)
async def create_modification(
    data: ModificationCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("fleet", "create")),
):
    mod = VehicleModification(**data.model_dump())
    db.add(mod)
    await db.flush()
    await db.refresh(mod)
    return mod


@router.put("/modifications/{mod_id}", response_model=ModificationRead)
async def update_modification(
    mod_id: int,
    data: ModificationUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("fleet", "update")),
):
    mod = await db.get(VehicleModification, mod_id)
    if not mod:
        raise HTTPException(status_code=404, detail="Modification not found")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(mod, key, value)
    await db.flush()
    await db.refresh(mod)
    return mod


@router.delete("/modifications/{mod_id}", status_code=204)
async def delete_modification(
    mod_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("fleet", "delete")),
):
    mod = await db.get(VehicleModification, mod_id)
    if not mod:
        raise HTTPException(status_code=404, detail="Modification not found")
    await db.delete(mod)


# ─── Cost Entries CRUD ───

@router.get("/costs/", response_model=list[CostEntryRead])
async def list_costs(
    vehicle_id: int | None = None,
    category: str | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("fleet", "read")),
):
    query = select(VehicleCostEntry).order_by(VehicleCostEntry.id.desc())
    if vehicle_id is not None:
        query = query.where(VehicleCostEntry.vehicle_id == vehicle_id)
    if category is not None:
        query = query.where(VehicleCostEntry.category == CostCategory(category))
    result = await db.execute(query.limit(500))
    return result.scalars().all()


@router.post("/costs/", response_model=CostEntryRead, status_code=201)
async def create_cost(
    data: CostEntryCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("fleet", "create")),
):
    entry = VehicleCostEntry(**data.model_dump())
    db.add(entry)
    await db.flush()
    await db.refresh(entry)
    return entry


@router.put("/costs/{entry_id}", response_model=CostEntryRead)
async def update_cost(
    entry_id: int,
    data: CostEntryUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("fleet", "update")),
):
    entry = await db.get(VehicleCostEntry, entry_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Cost entry not found")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(entry, key, value)
    await db.flush()
    await db.refresh(entry)
    return entry


@router.delete("/costs/{entry_id}", status_code=204)
async def delete_cost(
    entry_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("fleet", "delete")),
):
    entry = await db.get(VehicleCostEntry, entry_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Cost entry not found")
    await db.delete(entry)


# ─── Dashboard TCO ───

@router.get("/dashboard", response_model=FleetDashboardResponse)
async def fleet_dashboard(
    date_from: str | None = Query(None, description="YYYY-MM-DD"),
    date_to: str | None = Query(None, description="YYYY-MM-DD"),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("fleet", "read")),
):
    """Donnees TCO agregees par vehicule / Aggregated TCO data per vehicle."""
    result = await db.execute(select(Vehicle).where(Vehicle.status != "DISPOSED").order_by(Vehicle.code))
    vehicles = result.scalars().all()

    items = []
    total_cost = 0.0
    total_km = 0

    for v in vehicles:
        # Maintenance costs
        maint_q = select(func.coalesce(func.sum(VehicleMaintenanceRecord.cost_total), 0)).where(
            VehicleMaintenanceRecord.vehicle_id == v.id,
            VehicleMaintenanceRecord.status == "COMPLETED",
        )
        if date_from:
            maint_q = maint_q.where(VehicleMaintenanceRecord.completed_date >= date_from)
        if date_to:
            maint_q = maint_q.where(VehicleMaintenanceRecord.completed_date <= date_to)
        maint_cost = (await db.execute(maint_q)).scalar() or 0

        # Fuel costs
        fuel_q = select(func.coalesce(func.sum(VehicleFuelEntry.total_cost), 0)).where(
            VehicleFuelEntry.vehicle_id == v.id,
        )
        if date_from:
            fuel_q = fuel_q.where(VehicleFuelEntry.date >= date_from)
        if date_to:
            fuel_q = fuel_q.where(VehicleFuelEntry.date <= date_to)
        fuel_cost = (await db.execute(fuel_q)).scalar() or 0

        # Modification costs
        mod_q = select(func.coalesce(func.sum(VehicleModification.cost), 0)).where(
            VehicleModification.vehicle_id == v.id,
        )
        if date_from:
            mod_q = mod_q.where(VehicleModification.date >= date_from)
        if date_to:
            mod_q = mod_q.where(VehicleModification.date <= date_to)
        mod_cost = (await db.execute(mod_q)).scalar() or 0

        # Other costs
        other_q = select(func.coalesce(func.sum(VehicleCostEntry.amount), 0)).where(
            VehicleCostEntry.vehicle_id == v.id,
        )
        if date_from:
            other_q = other_q.where(VehicleCostEntry.date >= date_from)
        if date_to:
            other_q = other_q.where(VehicleCostEntry.date <= date_to)
        other_cost = (await db.execute(other_q)).scalar() or 0

        # Lease / depreciation
        lease = 0.0
        depreciation = 0.0
        otype = v.ownership_type.value if v.ownership_type else None
        if otype == "LEASED" and v.monthly_lease_cost:
            lease = float(v.monthly_lease_cost) * 12  # Annualise
        elif otype == "OWNED" and v.purchase_price and v.depreciation_years:
            residual = float(v.residual_value or 0)
            depreciation = (float(v.purchase_price) - residual) / v.depreciation_years

        vehicle_total = float(maint_cost) + float(fuel_cost) + float(mod_cost) + float(other_cost) + lease + depreciation
        vkm = v.current_km or 0
        cpk = vehicle_total / vkm if vkm > 0 else None

        items.append(VehicleTCOItem(
            vehicle_id=v.id,
            vehicle_code=v.code,
            vehicle_name=v.name,
            fleet_vehicle_type=v.fleet_vehicle_type.value,
            ownership_type=otype,
            lease_cost=lease,
            depreciation_cost=depreciation,
            maintenance_cost=float(maint_cost),
            fuel_cost=float(fuel_cost),
            modification_cost=float(mod_cost),
            other_costs=float(other_cost),
            total_cost=round(vehicle_total, 2),
            total_km=vkm,
            cost_per_km=round(cpk, 4) if cpk else None,
        ))

        total_cost += vehicle_total
        total_km += vkm

    return FleetDashboardResponse(
        vehicles=items,
        total_fleet_cost=round(total_cost, 2),
        total_fleet_km=total_km,
        avg_cost_per_km=round(total_cost / total_km, 4) if total_km > 0 else None,
    )
