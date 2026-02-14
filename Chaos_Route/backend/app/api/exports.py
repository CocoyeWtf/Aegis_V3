"""Routes Export Excel/PDF / Export API routes."""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db

router = APIRouter()


@router.get("/tours/{tour_id}/excel")
async def export_tour_excel(tour_id: int, db: AsyncSession = Depends(get_db)):
    """Exporter un tour en Excel / Export a tour to Excel."""
    # TODO: Implémenter l'export Excel / Implement Excel export
    return {"status": "pending", "message": "Excel export will be implemented in Phase 4"}


@router.get("/tours/{tour_id}/pdf")
async def export_tour_pdf(tour_id: int, db: AsyncSession = Depends(get_db)):
    """Exporter un tour en PDF / Export a tour to PDF."""
    # TODO: Implémenter l'export PDF / Implement PDF export
    return {"status": "pending", "message": "PDF export will be implemented in Phase 4"}
