"""Routes Import CSV/Excel / Import API routes."""

from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy import select, inspect
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

# Champs obligatoires par entité / Required fields per entity
REQUIRED_FIELDS = {
    "countries": {"name", "code"},
    "regions": {"name", "country_id"},
    "bases": {"code", "name", "region_id"},
    "pdvs": {"code", "name", "type", "region_id"},
    "vehicles": {"code", "name", "temperature_type", "vehicle_type", "capacity_eqp", "region_id"},
    "suppliers": {"code", "name", "region_id"},
    "volumes": {"pdv_id", "date", "eqp_count", "base_origin_id"},
    "contracts": {"code", "transporter_name", "region_id"},
    "distances": {"origin_type", "origin_id", "destination_type", "destination_id", "distance_km", "duration_minutes"},
}

# Valeurs considérées comme vides / Values treated as empty/null
_NA_VALUES = {"#n/a", "#na", "n/a", "na", "#ref!", "#value!", "#div/0!", "-", "null", "none", "nan"}

# Alias pour les types de PDV / PDV type aliases mapping
_PDV_TYPE_ALIASES = {
    "express": "EXPRESS",
    "contact": "CONTACT",
    "super": "SUPER_ALIMENTAIRE",
    "super alimentaire": "SUPER_ALIMENTAIRE",
    "super_alimentaire": "SUPER_ALIMENTAIRE",
    "super generaliste": "SUPER_GENERALISTE",
    "super_generaliste": "SUPER_GENERALISTE",
    "hyper": "HYPER",
    "hypermarche": "HYPER",
    "hypermarché": "HYPER",
    "netto": "NETTO",
    "drive": "DRIVE",
    "urbain proxi": "URBAIN_PROXI",
    "urbain_proxi": "URBAIN_PROXI",
    "proxi": "URBAIN_PROXI",
}


def _coerce_value(val, field_name: str):
    """Convertir les valeurs selon le nom du champ / Coerce values based on field name."""
    if val is None or val == "":
        return None
    s = str(val).strip()
    if s == "" or s.lower() in _NA_VALUES:
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
        try:
            return int(float(s))
        except ValueError:
            # Peut être un nom au lieu d'un ID, retourner la chaîne / May be a name instead of ID
            return s

    # Champs numériques décimaux / Decimal fields
    float_fields = {"latitude", "longitude", "fixed_cost", "cost_per_km", "cost_per_hour",
                    "fixed_daily_cost", "min_hours_per_day", "min_km_per_day", "weight_kg",
                    "distance_km", "total_km", "total_cost"}
    if field_name in float_fields:
        try:
            return float(s.replace(",", "."))
        except ValueError:
            return None

    return s


async def _build_region_lookup(db: AsyncSession) -> dict[str, int]:
    """Construire un cache nom_région → id / Build region name → id lookup cache."""
    result = await db.execute(select(Region.id, Region.name))
    return {name.strip().lower(): rid for rid, name in result.all()}


def _resolve_region_id(value, region_lookup: dict[str, int]) -> int | None:
    """Résoudre region_id: accepte un ID numérique ou un nom de région / Resolve region_id from numeric ID or region name."""
    if value is None:
        return None
    if isinstance(value, int):
        return value
    s = str(value).strip()
    # Essayer comme entier / Try as integer
    try:
        return int(float(s))
    except (ValueError, TypeError):
        pass
    # Chercher par nom / Lookup by name
    return region_lookup.get(s.lower())


# Clé unique par entité pour détecter les doublons / Unique key per entity for duplicate detection
UNIQUE_KEY_FIELDS = {
    "countries": "code",
    "regions": None,       # Pas de clé unique simple / No simple unique key
    "bases": "code",
    "pdvs": "code",
    "vehicles": "code",
    "suppliers": "code",
    "contracts": "code",
    "volumes": None,       # Pas de clé unique simple / No simple unique key
    "distances": None,     # Pas de clé unique simple / No simple unique key
}


async def _find_existing(db: AsyncSession, model_class, unique_field: str, value) -> object | None:
    """Chercher un enregistrement existant par clé unique / Find existing record by unique key."""
    col = getattr(model_class, unique_field, None)
    if col is None:
        return None
    result = await db.execute(select(model_class).where(col == value))
    return result.scalar_one_or_none()


def _resolve_pdv_type(value) -> str | None:
    """Résoudre le type de PDV via alias / Resolve PDV type via aliases."""
    if value is None:
        return None
    s = str(value).strip()
    # Déjà une valeur enum valide / Already a valid enum value
    if s.upper() in ("EXPRESS", "CONTACT", "SUPER_ALIMENTAIRE", "SUPER_GENERALISTE", "HYPER", "NETTO", "DRIVE", "URBAIN_PROXI"):
        return s.upper()
    # Chercher dans les alias / Check aliases
    return _PDV_TYPE_ALIASES.get(s.lower())


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

    # Construire le cache de résolution des régions / Build region name lookup cache
    region_lookup = await _build_region_lookup(db)

    model_class = ENTITY_MODEL_MAP[entity_type]
    allowed_fields = set(ImportService.ENTITY_FIELDS.get(entity_type, []))
    required = REQUIRED_FIELDS.get(entity_type, set())
    unique_field = UNIQUE_KEY_FIELDS.get(entity_type)
    created = 0
    updated = 0
    skipped = 0
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
                skipped += 1
                continue

            # Résoudre region_id par nom si nécessaire / Resolve region_id by name if needed
            if "region_id" in data and data["region_id"] is not None:
                if isinstance(data["region_id"], str):
                    resolved = _resolve_region_id(data["region_id"], region_lookup)
                    if resolved is None:
                        errors.append(f"Row {i + 2}: region '{data['region_id']}' not found in database")
                        skipped += 1
                        continue
                    data["region_id"] = resolved

            # Résoudre le type de PDV via alias / Resolve PDV type via aliases
            if entity_type == "pdvs" and "type" in data and data["type"] is not None:
                resolved_type = _resolve_pdv_type(data["type"])
                if resolved_type is None:
                    errors.append(f"Row {i + 2}: unknown PDV type '{data['type']}'")
                    skipped += 1
                    continue
                data["type"] = resolved_type

            # Convertir code en string / Ensure code is string
            if "code" in data and data["code"] is not None:
                data["code"] = str(data["code"]).strip()

            # Vérifier les champs obligatoires / Check required fields
            missing = [f for f in required if f not in data or data[f] is None]
            if missing:
                errors.append(f"Row {i + 2}: missing required fields: {', '.join(missing)}")
                skipped += 1
                continue

            # Upsert: mettre à jour si doublon, sinon créer / Update if duplicate, else create
            existing = None
            if unique_field and unique_field in data and data[unique_field] is not None:
                existing = await _find_existing(db, model_class, unique_field, data[unique_field])

            if existing:
                # Mettre à jour les champs existants / Update existing fields
                for k, v in data.items():
                    if k != unique_field:
                        setattr(existing, k, v)
                updated += 1
            else:
                obj = model_class(**data)
                db.add(obj)
                created += 1
        except Exception as e:
            errors.append(f"Row {i + 2}: {e}")
            skipped += 1

    if created > 0 or updated > 0:
        try:
            await db.flush()
        except Exception as e:
            # Rollback et signaler l'erreur / Rollback and report error
            await db.rollback()
            raise HTTPException(status_code=400, detail=f"Database error during import: {e}")

    return {
        "status": "success",
        "created": created,
        "updated": updated,
        "skipped": skipped,
        "total_rows": len(rows),
        "errors": errors[:20],  # Limiter à 20 erreurs / Limit to 20 errors
        "message": f"{created} created, {updated} updated, {skipped} skipped (out of {len(rows)} rows)",
    }
