"""Routes API / API routes."""

from fastapi import APIRouter

from app.api import (
    aide_decision,
    audit,
    auth,
    carriers,
    countries,
    regions,
    base_activities,
    bases,
    pdvs,
    suppliers,
    volumes,
    tours,
    contracts,
    distance_matrix,
    fuel_prices,
    km_tax,
    parameters,
    imports,
    exports,
    users,
    roles,
    loaders,
    devices,
    assignments,
    driver,
    tracking,
    ws_tracking,
    support_types,
    pickup_requests,
    kpi,
    surcharge_types,
    surcharges,
    declarations,
    vehicles,
    inspections,
    fleet,
    reports,
    consignments,
    waybill_archives,
    inventory,
    base_container_stock,
    supplier_pickup_requests,
    collection_requests,
    temperature,
    reception_booking,
    sms,
    gdpr,
)

api_router = APIRouter(prefix="/api")

api_router.include_router(aide_decision.router, prefix="/aide-decision", tags=["aide-decision"])
api_router.include_router(audit.router, prefix="/audit", tags=["audit"])
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(roles.router, prefix="/roles", tags=["roles"])
api_router.include_router(countries.router, prefix="/countries", tags=["countries"])
api_router.include_router(regions.router, prefix="/regions", tags=["regions"])
api_router.include_router(base_activities.router, prefix="/base-activities", tags=["base-activities"])
api_router.include_router(bases.router, prefix="/bases", tags=["bases"])
api_router.include_router(pdvs.router, prefix="/pdvs", tags=["pdvs"])
api_router.include_router(suppliers.router, prefix="/suppliers", tags=["suppliers"])
api_router.include_router(volumes.router, prefix="/volumes", tags=["volumes"])
api_router.include_router(tours.router, prefix="/tours", tags=["tours"])
api_router.include_router(contracts.router, prefix="/contracts", tags=["contracts"])
api_router.include_router(distance_matrix.router, prefix="/distance-matrix", tags=["distance-matrix"])
api_router.include_router(fuel_prices.router, prefix="/fuel-prices", tags=["fuel-prices"])
api_router.include_router(km_tax.router, prefix="/km-tax", tags=["km-tax"])
api_router.include_router(parameters.router, prefix="/parameters", tags=["parameters"])
api_router.include_router(imports.router, prefix="/imports", tags=["imports"])
api_router.include_router(exports.router, prefix="/exports", tags=["exports"])
api_router.include_router(loaders.router, prefix="/loaders", tags=["loaders"])
api_router.include_router(devices.router, prefix="/devices", tags=["devices"])
api_router.include_router(assignments.router, prefix="/assignments", tags=["assignments"])
api_router.include_router(driver.router, prefix="/driver", tags=["driver"])
api_router.include_router(tracking.router, prefix="/tracking", tags=["tracking"])
api_router.include_router(support_types.router, prefix="/support-types", tags=["support-types"])
api_router.include_router(pickup_requests.router, prefix="/pickup-requests", tags=["pickup-requests"])
api_router.include_router(kpi.router, prefix="/kpi", tags=["KPI"])
api_router.include_router(surcharge_types.router, prefix="/surcharge-types", tags=["surcharge-types"])
api_router.include_router(surcharges.router, prefix="/surcharges", tags=["surcharges"])
api_router.include_router(declarations.router, prefix="/declarations", tags=["declarations"])
api_router.include_router(vehicles.router, prefix="/vehicles", tags=["vehicles"])
api_router.include_router(inspections.router, prefix="/inspections", tags=["inspections"])
api_router.include_router(fleet.router, prefix="/fleet", tags=["fleet"])
api_router.include_router(reports.router, prefix="/reports", tags=["reports"])
api_router.include_router(consignments.router, prefix="/consignments", tags=["consignments"])
api_router.include_router(carriers.router, prefix="/carriers", tags=["carriers"])
api_router.include_router(waybill_archives.router, tags=["waybill-archives"])
api_router.include_router(inventory.router, prefix="/pdv-stock", tags=["pdv-stock"])
api_router.include_router(base_container_stock.router, prefix="/base-container-stock", tags=["base-container-stock"])
api_router.include_router(supplier_pickup_requests.router, prefix="/supplier-pickups", tags=["supplier-pickups"])
api_router.include_router(collection_requests.router, prefix="/collection-requests", tags=["collection-requests"])
api_router.include_router(temperature.router, prefix="/temperature", tags=["temperature"])
api_router.include_router(reception_booking.router, prefix="/reception-booking", tags=["reception-booking"])
api_router.include_router(sms.router, prefix="/sms", tags=["sms"])
api_router.include_router(gdpr.router, prefix="/gdpr", tags=["gdpr"])
