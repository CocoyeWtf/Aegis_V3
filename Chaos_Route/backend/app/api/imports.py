"""Routes Import CSV/Excel / Import API routes."""

from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db

router = APIRouter()


@router.post("/{entity_type}")
async def import_data(
    entity_type: str,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    """
    Importer des données depuis un fichier CSV ou Excel.
    Import data from a CSV or Excel file.

    entity_type: countries, regions, bases, pdvs, vehicles, suppliers, volumes, contracts, distances
    """
    allowed_types = [
        "countries", "regions", "bases", "pdvs", "vehicles",
        "suppliers", "volumes", "contracts", "distances",
    ]
    if entity_type not in allowed_types:
        raise HTTPException(status_code=400, detail=f"Invalid entity type. Allowed: {allowed_types}")

    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")

    ext = file.filename.rsplit(".", 1)[-1].lower()
    if ext not in ("csv", "xlsx", "xls"):
        raise HTTPException(status_code=400, detail="Only CSV and Excel files are supported")

    # TODO: Implémenter le parsing et l'insertion / Implement parsing and insertion
    return {"status": "pending", "message": f"Import for {entity_type} will be implemented in Phase 2"}
