"""Routes API / API routes."""

from fastapi import APIRouter

from app.api import (
    countries,
    regions,
    bases,
    pdvs,
    vehicles,
    suppliers,
    volumes,
    tours,
    contracts,
    distance_matrix,
    parameters,
    imports,
    exports,
)

api_router = APIRouter(prefix="/api")

api_router.include_router(countries.router, prefix="/countries", tags=["countries"])
api_router.include_router(regions.router, prefix="/regions", tags=["regions"])
api_router.include_router(bases.router, prefix="/bases", tags=["bases"])
api_router.include_router(pdvs.router, prefix="/pdvs", tags=["pdvs"])
api_router.include_router(vehicles.router, prefix="/vehicles", tags=["vehicles"])
api_router.include_router(suppliers.router, prefix="/suppliers", tags=["suppliers"])
api_router.include_router(volumes.router, prefix="/volumes", tags=["volumes"])
api_router.include_router(tours.router, prefix="/tours", tags=["tours"])
api_router.include_router(contracts.router, prefix="/contracts", tags=["contracts"])
api_router.include_router(distance_matrix.router, prefix="/distance-matrix", tags=["distance-matrix"])
api_router.include_router(parameters.router, prefix="/parameters", tags=["parameters"])
api_router.include_router(imports.router, prefix="/imports", tags=["imports"])
api_router.include_router(exports.router, prefix="/exports", tags=["exports"])
