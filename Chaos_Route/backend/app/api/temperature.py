"""Routes controle temperature chaine du froid / Cold chain temperature check API routes.
Releves semi-remorque (base) et groupe froid (chauffeur mobile).
"""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse
from pathlib import Path
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.temperature_check import TemperatureCheck, TemperatureConfig, TempCheckpoint
from app.models.tour import Tour
from app.models.tour_stop import TourStop
from app.models.user import User
from app.schemas.temperature import (
    TemperatureCheckCreate, TemperatureCheckRead,
    TemperatureConfigCreate, TemperatureConfigRead,
    TourTemperatureSummary,
)
from app.api.deps import require_permission, get_current_user

UPLOAD_DIR = Path("data/uploads/temperature")

router = APIRouter()


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


async def _check_compliance(check: TemperatureCheck, db: AsyncSession) -> bool | None:
    """Verifier si la temperature est dans les seuils / Check if temperature is within thresholds."""
    tour = await db.get(Tour, check.tour_id)
    if not tour:
        return None
    # Chercher la config pour les classes de temperature de la tournee
    # On prend le seuil le plus restrictif parmi les classes presentes
    configs_result = await db.execute(select(TemperatureConfig))
    configs = {c.name: c for c in configs_result.scalars().all()}
    if not configs:
        return None

    temp_classes = getattr(tour, 'temperature_classes', None)
    if not temp_classes:
        return None

    # Trouver la config correspondante
    for tc in (temp_classes if isinstance(temp_classes, list) else [temp_classes]):
        config = configs.get(tc)
        if config:
            return config.min_temperature <= check.temperature <= config.max_temperature

    return None


async def _enrich_check(check: TemperatureCheck, db: AsyncSession) -> TemperatureCheckRead:
    """Enrichir un releve / Enrich a check."""
    compliance = await _check_compliance(check, db)
    stop_pdv_name = None
    if check.tour_stop_id:
        stop = await db.get(TourStop, check.tour_stop_id)
        if stop and hasattr(stop, 'pdv'):
            from app.models.pdv import Pdv
            pdv = await db.get(Pdv, stop.pdv_id)
            stop_pdv_name = pdv.name if pdv else None

    return TemperatureCheckRead(
        id=check.id,
        tour_id=check.tour_id,
        tour_stop_id=check.tour_stop_id,
        checkpoint=check.checkpoint.value if isinstance(check.checkpoint, TempCheckpoint) else check.checkpoint,
        temperature=check.temperature,
        setpoint_temperature=check.setpoint_temperature,
        cooling_unit_ok=check.cooling_unit_ok,
        device_id=check.device_id,
        user_id=check.user_id,
        timestamp=check.timestamp,
        notes=check.notes,
        photo_path=check.photo_path,
        is_compliant=compliance,
        stop_pdv_name=stop_pdv_name,
    )


# ─── Temperature checks ───

@router.post("/checks/", response_model=TemperatureCheckRead, status_code=201)
async def create_temperature_check(
    data: TemperatureCheckCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Enregistrer un releve de temperature / Record a temperature check."""
    check = TemperatureCheck(
        tour_id=data.tour_id,
        tour_stop_id=data.tour_stop_id,
        checkpoint=TempCheckpoint(data.checkpoint),
        temperature=data.temperature,
        setpoint_temperature=data.setpoint_temperature,
        cooling_unit_ok=data.cooling_unit_ok,
        device_id=data.device_id,
        user_id=user.id,
        timestamp=_now_iso(),
        notes=data.notes,
    )
    db.add(check)
    await db.flush()
    return await _enrich_check(check, db)


@router.get("/checks/tour/{tour_id}", response_model=TourTemperatureSummary)
async def get_tour_temperature_checks(
    tour_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("temperature", "read")),
):
    """Tous les releves d'une tournee / All checks for a tour."""
    result = await db.execute(
        select(TemperatureCheck)
        .where(TemperatureCheck.tour_id == tour_id)
        .order_by(TemperatureCheck.timestamp.asc())
    )
    checks = result.scalars().all()
    enriched = [await _enrich_check(c, db) for c in checks]

    compliant = sum(1 for c in enriched if c.is_compliant is True)
    non_compliant = sum(1 for c in enriched if c.is_compliant is False)

    return TourTemperatureSummary(
        tour_id=tour_id,
        total_checks=len(enriched),
        compliant_checks=compliant,
        non_compliant_checks=non_compliant,
        checks=enriched,
    )


@router.get("/checks/", response_model=list[TemperatureCheckRead])
async def list_temperature_checks(
    tour_id: int | None = None,
    checkpoint: str | None = None,
    limit: int = Query(default=200, le=2000),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("temperature", "read")),
):
    """Lister les releves / List checks."""
    query = select(TemperatureCheck)
    if tour_id:
        query = query.where(TemperatureCheck.tour_id == tour_id)
    if checkpoint:
        query = query.where(TemperatureCheck.checkpoint == checkpoint)
    query = query.order_by(TemperatureCheck.timestamp.desc()).offset(offset).limit(limit)

    result = await db.execute(query)
    checks = result.scalars().all()
    return [await _enrich_check(c, db) for c in checks]


@router.post("/checks/{check_id}/photo", response_model=TemperatureCheckRead)
async def upload_check_photo(
    check_id: int,
    file: UploadFile,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Uploader une photo preuve / Upload proof photo."""
    check = await db.get(TemperatureCheck, check_id)
    if not check:
        raise HTTPException(status_code=404, detail="Releve non trouve")

    content = await file.read()
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Fichier trop volumineux (max 5 Mo)")

    ext = Path(file.filename or "photo.jpg").suffix.lower()
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    file_path = UPLOAD_DIR / f"{check_id}{ext}"
    file_path.write_bytes(content)

    check.photo_path = str(file_path)
    await db.flush()
    return await _enrich_check(check, db)


@router.get("/checks/{check_id}/photo")
async def get_check_photo(
    check_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Telecharger la photo preuve / Download proof photo."""
    check = await db.get(TemperatureCheck, check_id)
    if not check or not check.photo_path:
        raise HTTPException(status_code=404, detail="Photo non trouvee")
    file_path = Path(check.photo_path)
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Fichier non trouve")
    return FileResponse(file_path)


# ─── Temperature configs ───

@router.get("/configs/", response_model=list[TemperatureConfigRead])
async def list_temperature_configs(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("temperature", "read")),
):
    """Lister les configurations temperature / List temperature configs."""
    result = await db.execute(select(TemperatureConfig))
    return result.scalars().all()


@router.post("/configs/", response_model=TemperatureConfigRead, status_code=201)
async def create_temperature_config(
    data: TemperatureConfigCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("temperature", "create")),
):
    """Creer une configuration temperature / Create a temperature config."""
    config = TemperatureConfig(**data.model_dump())
    db.add(config)
    await db.flush()
    await db.refresh(config)
    return config


@router.put("/configs/{config_id}", response_model=TemperatureConfigRead)
async def update_temperature_config(
    config_id: int,
    data: TemperatureConfigCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("temperature", "update")),
):
    """Modifier une configuration / Update a config."""
    config = await db.get(TemperatureConfig, config_id)
    if not config:
        raise HTTPException(status_code=404, detail="Configuration non trouvee")
    for key, value in data.model_dump().items():
        setattr(config, key, value)
    await db.flush()
    await db.refresh(config)
    return config


@router.delete("/configs/{config_id}", status_code=204)
async def delete_temperature_config(
    config_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("temperature", "delete")),
):
    """Supprimer une configuration / Delete a config."""
    config = await db.get(TemperatureConfig, config_id)
    if not config:
        raise HTTPException(status_code=404, detail="Configuration non trouvee")
    await db.delete(config)
