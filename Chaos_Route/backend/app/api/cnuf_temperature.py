"""Routes Filiale/CNUF → type température / CNUF/Filiale temperature mapping API routes."""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.cnuf_temperature import CnufTemperature
from app.models.user import User
from app.schemas.cnuf_temperature import CnufTemperatureCreate, CnufTemperatureRead, CnufTemperatureUpdate
from app.api.deps import require_permission

router = APIRouter()

VALID_TEMP_TYPES = {"SEC", "FRAIS", "GEL", "FFL"}


@router.get("/", response_model=list[CnufTemperatureRead])
async def list_cnuf_temperatures(
    temperature_type: str | None = None,
    filiale: str | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("cnuf-temperatures", "read")),
):
    """Liste tous les mappings CNUF/filiale → température / List all CNUF/filiale → temperature mappings."""
    query = select(CnufTemperature)
    if temperature_type:
        query = query.where(CnufTemperature.temperature_type == temperature_type)
    if filiale:
        query = query.where(CnufTemperature.filiale == filiale)
    result = await db.execute(query.order_by(CnufTemperature.filiale, CnufTemperature.cnuf))
    return result.scalars().all()


@router.get("/{item_id}", response_model=CnufTemperatureRead)
async def get_cnuf_temperature(
    item_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("cnuf-temperatures", "read")),
):
    item = await db.get(CnufTemperature, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="CnufTemperature not found")
    return item


@router.post("/", response_model=CnufTemperatureRead, status_code=201)
async def create_cnuf_temperature(
    data: CnufTemperatureCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("cnuf-temperatures", "create")),
):
    if data.temperature_type not in VALID_TEMP_TYPES:
        raise HTTPException(status_code=400, detail=f"temperature_type doit être parmi {VALID_TEMP_TYPES}")
    # Vérifier unicité cnuf+filiale / Check cnuf+filiale uniqueness
    existing = await db.execute(
        select(CnufTemperature).where(
            CnufTemperature.cnuf == data.cnuf,
            CnufTemperature.filiale == data.filiale,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail=f"Mapping CNUF={data.cnuf} / Filiale={data.filiale} existe déjà")
    item = CnufTemperature(**data.model_dump())
    db.add(item)
    await db.flush()
    await db.refresh(item)
    return item


@router.put("/{item_id}", response_model=CnufTemperatureRead)
async def update_cnuf_temperature(
    item_id: int,
    data: CnufTemperatureUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("cnuf-temperatures", "update")),
):
    item = await db.get(CnufTemperature, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="CnufTemperature not found")
    updates = data.model_dump(exclude_unset=True)
    if "temperature_type" in updates and updates["temperature_type"] not in VALID_TEMP_TYPES:
        raise HTTPException(status_code=400, detail=f"temperature_type doit être parmi {VALID_TEMP_TYPES}")
    for key, value in updates.items():
        setattr(item, key, value)
    await db.flush()
    await db.refresh(item)
    return item


@router.delete("/{item_id}", status_code=204)
async def delete_cnuf_temperature(
    item_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("cnuf-temperatures", "delete")),
):
    item = await db.get(CnufTemperature, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="CnufTemperature not found")
    await db.delete(item)


@router.post("/import/", status_code=200)
async def import_cnuf_temperatures(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("cnuf-temperatures", "create")),
):
    """Import Excel/CSV de mappings CNUF → température / Import Excel/CSV CNUF → temperature mappings.
    Colonnes attendues: cnuf, filiale, temperature_type, label (optionnel), base_id (optionnel).
    """
    import io
    fname = (file.filename or "").lower()
    content = await file.read()

    rows: list[dict] = []

    if fname.endswith((".xls", ".xlsx")):
        import xlrd
        wb = xlrd.open_workbook(file_contents=content)
        ws = wb.sheet_by_index(0)
        headers = [str(ws.cell_value(0, c)).strip().lower() for c in range(ws.ncols)]
        for r in range(1, ws.nrows):
            row = {headers[c]: str(ws.cell_value(r, c)).strip() for c in range(ws.ncols)}
            rows.append(row)
    elif fname.endswith(".csv"):
        import csv
        text = content.decode("utf-8-sig")
        reader = csv.DictReader(io.StringIO(text), delimiter=";")
        for row in reader:
            rows.append({k.strip().lower(): v.strip() for k, v in row.items()})
    else:
        raise HTTPException(status_code=400, detail="Format non supporté. Utilisez .xls, .xlsx ou .csv")

    created = 0
    updated = 0
    errors: list[str] = []

    for i, row in enumerate(rows, start=2):
        cnuf = row.get("cnuf", "")
        filiale = row.get("filiale", "")
        temp_type = row.get("temperature_type", "").upper()
        label = row.get("label", "") or None
        base_id_str = row.get("base_id", "")

        if not cnuf or not filiale:
            errors.append(f"Ligne {i}: cnuf ou filiale manquant")
            continue
        if temp_type not in VALID_TEMP_TYPES:
            errors.append(f"Ligne {i}: temperature_type '{temp_type}' invalide")
            continue

        base_id = int(base_id_str) if base_id_str and base_id_str.isdigit() else None

        existing = await db.execute(
            select(CnufTemperature).where(
                CnufTemperature.cnuf == cnuf,
                CnufTemperature.filiale == filiale,
            )
        )
        item = existing.scalar_one_or_none()
        if item:
            item.temperature_type = temp_type
            if label:
                item.label = label
            if base_id is not None:
                item.base_id = base_id
            updated += 1
        else:
            db.add(CnufTemperature(
                cnuf=cnuf, filiale=filiale, temperature_type=temp_type,
                label=label, base_id=base_id,
            ))
            created += 1

    await db.flush()
    return {"created": created, "updated": updated, "errors": errors, "total": len(rows)}


@router.get("/lookup/", response_model=CnufTemperatureRead | None)
async def lookup_temperature(
    cnuf: str,
    filiale: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("cnuf-temperatures", "read")),
):
    """Cherche le type température pour un couple cnuf/filiale / Lookup temperature type for cnuf/filiale pair."""
    result = await db.execute(
        select(CnufTemperature).where(
            CnufTemperature.cnuf == cnuf,
            CnufTemperature.filiale == filiale,
        )
    )
    return result.scalar_one_or_none()
