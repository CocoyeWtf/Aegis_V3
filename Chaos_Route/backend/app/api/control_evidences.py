"""Routes admin preuves de controle / Control evidence admin routes."""

from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.control_evidence import ControlEvidence, ControlContext
from app.models.mobile_device import MobileDevice
from app.models.pdv import PDV
from app.models.user import User
from app.api.deps import require_permission

router = APIRouter()


@router.get("/")
async def list_control_evidences(
    device_id: int | None = None,
    pdv_id: int | None = None,
    control_context: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    limit: int = 200,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("control-evidences", "read")),
):
    """Lister les preuves de controle / List control evidences."""
    query = select(ControlEvidence).order_by(ControlEvidence.id.desc()).limit(limit)

    if device_id is not None:
        query = query.where(ControlEvidence.device_id == device_id)
    if pdv_id is not None:
        query = query.where(ControlEvidence.pdv_id == pdv_id)
    if control_context is not None:
        query = query.where(ControlEvidence.control_context == ControlContext(control_context))
    if date_from:
        query = query.where(ControlEvidence.scan_date >= date_from)
    if date_to:
        query = query.where(ControlEvidence.scan_date <= date_to)

    result = await db.execute(query)
    evidences = result.scalars().all()

    # Charger noms PDV et device en batch
    pdv_ids = {e.pdv_id for e in evidences if e.pdv_id}
    device_ids = {e.device_id for e in evidences}
    pdv_map: dict[int, str] = {}
    device_map: dict[int, str] = {}

    if pdv_ids:
        r = await db.execute(select(PDV.id, PDV.code, PDV.name).where(PDV.id.in_(pdv_ids)))
        pdv_map = {row.id: f"{row.code} — {row.name}" for row in r.all()}
    if device_ids:
        r = await db.execute(select(MobileDevice.id, MobileDevice.friendly_name).where(MobileDevice.id.in_(device_ids)))
        device_map = {row.id: row.friendly_name or f"Device #{row.id}" for row in r.all()}

    return [
        {
            "id": e.id,
            "control_context": e.control_context.value,
            "device_id": e.device_id,
            "device_name": device_map.get(e.device_id, ""),
            "pdv_id": e.pdv_id,
            "pdv_label": pdv_map.get(e.pdv_id, e.pdv_code_scanned or ""),
            "label_code": e.label_code,
            "combi_barcode": e.combi_barcode,
            "latitude": e.latitude,
            "longitude": e.longitude,
            "photo_filename": e.photo_filename,
            "timestamp": e.timestamp,
            "scan_date": e.scan_date,
        }
        for e in evidences
    ]


@router.get("/{evidence_id}/photo")
async def get_evidence_photo(
    evidence_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("pickup-requests", "read")),
):
    """Telecharger la photo d'une preuve / Download evidence photo."""
    evidence = await db.get(ControlEvidence, evidence_id)
    if not evidence:
        raise HTTPException(status_code=404, detail="Evidence not found")

    file_path = Path(evidence.photo_path)
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Photo file not found")

    return FileResponse(
        file_path,
        media_type=evidence.photo_mime or "image/jpeg",
        filename=evidence.photo_filename,
    )


@router.get("/by-labels")
async def get_evidences_by_labels(
    label_codes: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("pickup-requests", "read")),
):
    """Chercher les evidences pour une liste de label_codes (CSV) / Lookup evidences by label codes.
    Accessible avec pickup-requests:read pour affichage dans la page reprises.
    """
    codes = [c.strip() for c in label_codes.split(",") if c.strip()]
    if not codes:
        return {}

    result = await db.execute(
        select(ControlEvidence)
        .where(ControlEvidence.label_code.in_(codes))
        .order_by(ControlEvidence.id.desc())
    )
    evidences = result.scalars().all()

    # Grouper par label_code (garder la plus recente)
    evidence_map: dict[str, dict] = {}
    for e in evidences:
        if e.label_code and e.label_code not in evidence_map:
            evidence_map[e.label_code] = {
                "id": e.id,
                "label_code": e.label_code,
                "timestamp": e.timestamp,
                "latitude": e.latitude,
                "longitude": e.longitude,
                "photo_filename": e.photo_filename,
            }

    return evidence_map
