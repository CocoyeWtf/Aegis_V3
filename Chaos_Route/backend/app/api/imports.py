"""Routes Import CSV/Excel / Import API routes."""

from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.country import Country
from app.models.region import Region
from app.models.base_logistics import BaseLogistics
from app.models.pdv import PDV
from app.models.vehicle import Vehicle
from app.models.supplier import Supplier
from app.models.volume import Volume
from app.models.contract import Contract
from app.models.distance_matrix import DistanceMatrix
from app.services.import_service import ImportService

router = APIRouter()

# Mapping entité → modèle SQLAlchemy / Entity to model mapping
ENTITY_MODEL_MAP = {
    "countries": Country,
    "regions": Region,
    "bases": BaseLogistics,
    "pdvs": PDV,
    "vehicles": Vehicle,
    "suppliers": Supplier,
    "volumes": Volume,
    "contracts": Contract,
    "distances": DistanceMatrix,
}


def _coerce_value(val, field_name: str):
    """Convertir les valeurs selon le nom du champ / Coerce values based on field name."""
    if val is None or val == "":
        return None
    s = str(val).strip()
    if s == "":
        return None

    # Champs booléens / Boolean fields
    if field_name.startswith("has_") or field_name == "is_available":
        return s.lower() in ("true", "1", "yes", "oui", "vrai")

    # Champs numériques entiers / Integer fields
    int_fields = {"country_id", "region_id", "pdv_id", "base_origin_id", "vehicle_id", "contract_id",
                  "capacity_eqp", "capacity_weight_kg", "eqp_count", "dock_time_minutes",
                  "unload_time_per_eqp_minutes", "sas_capacity", "origin_id", "destination_id",
                  "duration_minutes", "day_of_week", "sequence_order"}
    if field_name in int_fields:
        return int(float(s))

    # Champs numériques décimaux / Decimal fields
    float_fields = {"latitude", "longitude", "fixed_cost", "cost_per_km", "cost_per_hour",
                    "fixed_daily_cost", "min_hours_per_day", "min_km_per_day", "weight_kg",
                    "distance_km", "total_km", "total_cost"}
    if field_name in float_fields:
        return float(s.replace(",", "."))

    return s


@router.post("/{entity_type}")
async def import_data(
    entity_type: str,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    """
    Importer des données depuis un fichier CSV ou Excel.
    Import data from a CSV or Excel file.
    """
    if entity_type not in ENTITY_MODEL_MAP:
        raise HTTPException(status_code=400, detail=f"Invalid entity type. Allowed: {list(ENTITY_MODEL_MAP.keys())}")

    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")

    ext = file.filename.rsplit(".", 1)[-1].lower()
    if ext not in ("csv", "xlsx", "xls"):
        raise HTTPException(status_code=400, detail="Only CSV and Excel files are supported")

    content = await file.read()
    try:
        rows = ImportService.parse_file(content, file.filename)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error parsing file: {e}")

    if not rows:
        raise HTTPException(status_code=400, detail="No data found in file")

    model_class = ENTITY_MODEL_MAP[entity_type]
    allowed_fields = set(ImportService.ENTITY_FIELDS.get(entity_type, []))
    created = 0
    errors = []

    for i, row in enumerate(rows):
        try:
            # Filtrer et convertir les champs valides / Filter and coerce valid fields
            data = {}
            for key, val in row.items():
                clean_key = key.strip().lower().replace(" ", "_")
                if clean_key in allowed_fields:
                    data[clean_key] = _coerce_value(val, clean_key)

            if not data:
                continue

            obj = model_class(**data)
            db.add(obj)
            created += 1
        except Exception as e:
            errors.append(f"Row {i + 2}: {e}")

    if created > 0:
        await db.flush()

    return {
        "status": "success",
        "created": created,
        "total_rows": len(rows),
        "errors": errors[:10],  # Limiter à 10 erreurs / Limit to 10 errors
        "message": f"{created}/{len(rows)} records imported successfully",
    }
