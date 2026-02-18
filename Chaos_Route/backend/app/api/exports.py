"""Routes Export CSV/Excel / Export API routes."""

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
import io

from app.database import get_db
from app.models.country import Country
from app.models.region import Region
from app.models.base_logistics import BaseLogistics
from app.models.pdv import PDV
from app.models.supplier import Supplier
from app.models.volume import Volume
from app.models.contract import Contract
from app.models.distance_matrix import DistanceMatrix
from app.models.km_tax import KmTax
from app.models.user import User
from app.services.export_service import ExportService
from app.api.deps import require_permission, get_user_region_ids

router = APIRouter()

# Mapping entité -> modèle SQLAlchemy / Entity to model mapping
ENTITY_MODEL_MAP = {
    "countries": Country,
    "regions": Region,
    "bases": BaseLogistics,
    "pdvs": PDV,
    "suppliers": Supplier,
    "volumes": Volume,
    "contracts": Contract,
    "distances": DistanceMatrix,
    "km-tax": KmTax,
}

# Entités avec filtrage par région / Entities with region scoping
REGION_SCOPED_ENTITIES = {"bases", "pdvs", "suppliers", "contracts"}


@router.get("/{entity_type}")
async def export_data(
    entity_type: str,
    format: str = Query("xlsx", pattern="^(csv|xlsx)$"),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("imports-exports", "read")),
):
    """Exporter les données d'une entité / Export entity data to CSV or XLSX."""
    if entity_type not in ENTITY_MODEL_MAP:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid entity type. Allowed: {list(ENTITY_MODEL_MAP.keys())}",
        )

    model_class = ENTITY_MODEL_MAP[entity_type]
    fields = ExportService.get_fields(entity_type)
    if not fields:
        raise HTTPException(status_code=400, detail=f"No field mapping for entity: {entity_type}")

    # Requête avec filtrage région si applicable / Query with region scoping if applicable
    query = select(model_class)
    if entity_type in REGION_SCOPED_ENTITIES:
        region_ids = get_user_region_ids(user)
        if region_ids is not None:
            query = query.where(model_class.region_id.in_(region_ids))

    result = await db.execute(query)
    objects = result.scalars().all()

    rows = [ExportService.model_to_dict(obj, fields) for obj in objects]

    # Distances / km-tax : remplacer les DB IDs par les codes pour l'import round-trip
    # Distances / km-tax: replace DB IDs with entity codes for round-trip import
    if entity_type in ("distances", "km-tax"):
        id_to_code: dict[tuple[str, int], str] = {}
        for model, etype in [(PDV, "PDV"), (BaseLogistics, "BASE"), (Supplier, "SUPPLIER")]:
            r = await db.execute(select(model.id, model.code))
            for eid, code in r.all():
                id_to_code[(etype, eid)] = str(code)
        for row in rows:
            for prefix in ("origin", "destination"):
                etype = row.get(f"{prefix}_type")
                eid = row.get(f"{prefix}_id")
                if etype and eid is not None:
                    row[f"{prefix}_id"] = id_to_code.get((etype, eid), eid)

    if format == "csv":
        content = ExportService.to_csv(rows, fields)
        media_type = "text/csv; charset=utf-8"
        filename = f"{entity_type}.csv"
    else:
        content = ExportService.to_xlsx(rows, fields, sheet_name=entity_type.capitalize())
        media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        filename = f"{entity_type}.xlsx"

    return StreamingResponse(
        io.BytesIO(content),
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/tours/{tour_id}/excel")
async def export_tour_excel(
    tour_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("imports-exports", "read")),
):
    """Exporter un tour en Excel / Export a tour to Excel."""
    # TODO: Implémenter l'export Excel / Implement Excel export
    return {"status": "pending", "message": "Excel export will be implemented in Phase 4"}


@router.get("/tours/{tour_id}/pdf")
async def export_tour_pdf(
    tour_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("imports-exports", "read")),
):
    """Exporter un tour en PDF / Export a tour to PDF."""
    # TODO: Implémenter l'export PDF / Implement PDF export
    return {"status": "pending", "message": "PDF export will be implemented in Phase 4"}
