"""
Routes API pour le suivi des consignes Zèbre / API routes for Zèbre consignment tracking.
Import XLSX, liste mouvements, soldes agrégés.
"""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, Query, UploadFile
from sqlalchemy import delete, func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_permission
from app.database import get_db
from app.models.consignment_movement import ConsignmentMovement
from app.models.user import User
from app.schemas.consignment import (
    ConsignmentBalanceItem,
    ConsignmentFilters,
    ConsignmentImportInfo,
    ConsignmentImportResult,
    ConsignmentMovementRead,
)

router = APIRouter()

# ─── Mapping colonnes XLSX Zèbre → champs modèle / XLSX column mapping ───

HEADER_MAP = {
    "CODE_PDV": "pdv_code",
    "NOM_PDV": "pdv_name",
    "BASE": "base",
    "NUM_BORDEREAU": "waybill_number",
    "DATE_FLUX": "flux_date",
    "CODE_CONSIGNE": "consignment_code",
    "LIBELLE_CONSIGNE": "consignment_label",
    "TYPE_CONSIGNE": "consignment_type",
    "QUANTITE": "quantity",
    "VALEUR": "value",
    "TYPE_FLUX": "flux_type",
    "VALEUR_UNITAIRE": "unit_value",
    "ANNEE": "year",
    "MOIS": "month",
}


def _normalize_header(h: str) -> str:
    """Normalise un en-tête XLSX / Normalize an XLSX header."""
    return h.strip().upper().replace(" ", "_") if h else ""


def _parse_date(val) -> str | None:
    """Convertit date/datetime/string en YYYY-MM-DD / Convert date/datetime/string to YYYY-MM-DD."""
    if val is None:
        return None
    if hasattr(val, "strftime"):
        return val.strftime("%Y-%m-%d")
    s = str(val).strip()
    # Essayer formats courants / Try common formats
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y", "%Y%m%d"):
        try:
            return datetime.strptime(s, fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue
    return s[:10] if len(s) >= 10 else s


def _safe_int(val) -> int | None:
    """Convertir en int ou None / Convert to int or None."""
    if val is None:
        return None
    try:
        return int(float(val))
    except (ValueError, TypeError):
        return None


def _safe_float(val) -> float | None:
    """Convertir en float ou None / Convert to float or None."""
    if val is None:
        return None
    try:
        return float(val)
    except (ValueError, TypeError):
        return None


def _apply_filters(query, params: dict):
    """Appliquer les filtres optionnels / Apply optional filters to query."""
    if params.get("date_from"):
        query = query.where(ConsignmentMovement.flux_date >= params["date_from"])
    if params.get("date_to"):
        query = query.where(ConsignmentMovement.flux_date <= params["date_to"])
    if params.get("pdv_search"):
        like = f"%{params['pdv_search']}%"
        query = query.where(
            (ConsignmentMovement.pdv_code.ilike(like))
            | (ConsignmentMovement.pdv_name.ilike(like))
        )
    if params.get("base"):
        query = query.where(ConsignmentMovement.base == params["base"])
    if params.get("consignment_type"):
        query = query.where(ConsignmentMovement.consignment_type == params["consignment_type"])
    if params.get("consignment_code"):
        query = query.where(ConsignmentMovement.consignment_code == params["consignment_code"])
    if params.get("flux_type"):
        query = query.where(ConsignmentMovement.flux_type == params["flux_type"])
    return query


# ─── POST /import/ — Import XLSX Zèbre ───

@router.post("/import/", response_model=ConsignmentImportResult)
async def import_xlsx(
    file: UploadFile = File(...),
    mode: str = Query("replace", pattern="^(replace|append)$"),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("consignment-movements", "create")),
):
    """Importer un fichier XLSX Zèbre / Import a Zèbre XLSX file."""
    import openpyxl

    content = await file.read()

    from io import BytesIO
    wb = openpyxl.load_workbook(BytesIO(content), read_only=True, data_only=True)
    ws = wb.active

    # Lire les en-têtes / Read headers
    rows = ws.iter_rows()
    header_row = next(rows)
    headers = [_normalize_header(str(cell.value or "")) for cell in header_row]

    # Mapper index → champ / Map index → field
    col_map: dict[int, str] = {}
    for i, h in enumerate(headers):
        if h in HEADER_MAP:
            col_map[i] = HEADER_MAP[h]

    batch_id = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    errors: list[str] = []
    created = 0
    skipped = 0
    total = 0
    batch: list[ConsignmentMovement] = []

    # Mode replace : supprimer tout / Replace mode: delete all
    if mode == "replace":
        await db.execute(delete(ConsignmentMovement))
        await db.flush()

    for row in rows:
        total += 1
        try:
            raw: dict[str, object] = {}
            for i, cell in enumerate(row):
                if i in col_map:
                    raw[col_map[i]] = cell.value

            pdv_code = str(raw.get("pdv_code") or "").strip()
            flux_date_raw = raw.get("flux_date")
            consignment_code = str(raw.get("consignment_code") or "").strip()
            quantity = _safe_int(raw.get("quantity"))
            flux_type = str(raw.get("flux_type") or "").strip().upper()

            if not pdv_code or not consignment_code or quantity is None or not flux_type:
                skipped += 1
                continue

            flux_date = _parse_date(flux_date_raw) or ""

            mov = ConsignmentMovement(
                batch_id=batch_id,
                pdv_code=pdv_code,
                pdv_name=str(raw.get("pdv_name") or "").strip() or None,
                base=str(raw.get("base") or "").strip(),
                waybill_number=_safe_int(raw.get("waybill_number")),
                flux_date=flux_date,
                consignment_code=consignment_code,
                consignment_label=str(raw.get("consignment_label") or "").strip() or None,
                consignment_type=str(raw.get("consignment_type") or "").strip() or None,
                quantity=quantity,
                value=_safe_float(raw.get("value")),
                flux_type=flux_type,
                unit_value=_safe_float(raw.get("unit_value")),
                year=_safe_int(raw.get("year")),
                month=_safe_int(raw.get("month")),
            )
            batch.append(mov)
            created += 1

            # Flush par lots de 5000 / Batch flush every 5000 rows
            if len(batch) >= 5000:
                db.add_all(batch)
                await db.flush()
                batch = []

        except Exception as exc:
            errors.append(f"Ligne {total + 1}: {exc}")
            if len(errors) > 50:
                errors.append("... (erreurs tronquées)")
                break

    # Flush restant / Flush remaining
    if batch:
        db.add_all(batch)
        await db.flush()

    wb.close()

    return ConsignmentImportResult(
        created=created,
        skipped=skipped,
        total_rows=total,
        errors=errors[:50],
        batch_id=batch_id,
    )


# ─── GET / — Liste mouvements avec filtres + pagination ───

@router.get("/", response_model=list[ConsignmentMovementRead])
async def list_movements(
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    date_from: str | None = None,
    date_to: str | None = None,
    pdv_search: str | None = None,
    base: str | None = None,
    consignment_type: str | None = None,
    consignment_code: str | None = None,
    flux_type: str | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("consignment-movements", "read")),
):
    """Lister les mouvements avec filtres et pagination / List movements with filters and pagination."""
    params = {
        "date_from": date_from, "date_to": date_to, "pdv_search": pdv_search,
        "base": base, "consignment_type": consignment_type,
        "consignment_code": consignment_code, "flux_type": flux_type,
    }
    query = select(ConsignmentMovement)
    query = _apply_filters(query, params)
    query = query.order_by(ConsignmentMovement.flux_date.desc(), ConsignmentMovement.id.desc())
    query = query.limit(limit).offset(offset)

    result = await db.execute(query)
    return result.scalars().all()


# ─── GET /count/ — Comptage mouvements ───

@router.get("/count/")
async def count_movements(
    date_from: str | None = None,
    date_to: str | None = None,
    pdv_search: str | None = None,
    base: str | None = None,
    consignment_type: str | None = None,
    consignment_code: str | None = None,
    flux_type: str | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("consignment-movements", "read")),
):
    """Compter les mouvements filtrés / Count filtered movements."""
    params = {
        "date_from": date_from, "date_to": date_to, "pdv_search": pdv_search,
        "base": base, "consignment_type": consignment_type,
        "consignment_code": consignment_code, "flux_type": flux_type,
    }
    query = select(func.count(ConsignmentMovement.id))
    query = _apply_filters(query, params)

    result = await db.execute(query)
    return {"count": result.scalar() or 0}


# ─── GET /balances/ — Soldes agrégés par PDV × code consigne ───

@router.get("/balances/", response_model=list[ConsignmentBalanceItem])
async def get_balances(
    date_from: str | None = None,
    date_to: str | None = None,
    pdv_search: str | None = None,
    base: str | None = None,
    consignment_type: str | None = None,
    consignment_code: str | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("consignment-movements", "read")),
):
    """Soldes agrégés par PDV × code consigne / Aggregated balances per PDV × consignment code."""
    params = {
        "date_from": date_from, "date_to": date_to, "pdv_search": pdv_search,
        "base": base, "consignment_type": consignment_type,
        "consignment_code": consignment_code,
    }
    query = (
        select(
            ConsignmentMovement.pdv_code,
            func.max(ConsignmentMovement.pdv_name).label("pdv_name"),
            ConsignmentMovement.consignment_code,
            func.max(ConsignmentMovement.consignment_label).label("consignment_label"),
            func.sum(ConsignmentMovement.quantity).label("total_quantity"),
            func.sum(ConsignmentMovement.value).label("total_value"),
        )
        .group_by(ConsignmentMovement.pdv_code, ConsignmentMovement.consignment_code)
        .order_by(ConsignmentMovement.pdv_code, ConsignmentMovement.consignment_code)
    )
    query = _apply_filters(query, params)

    result = await db.execute(query)
    rows = result.all()
    return [
        ConsignmentBalanceItem(
            pdv_code=r.pdv_code,
            pdv_name=r.pdv_name,
            consignment_code=r.consignment_code,
            consignment_label=r.consignment_label,
            total_quantity=int(r.total_quantity or 0),
            total_value=float(r.total_value) if r.total_value is not None else None,
        )
        for r in rows
    ]


# ─── GET /import-info/ — Info du dernier import ───

@router.get("/import-info/", response_model=ConsignmentImportInfo)
async def get_import_info(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("consignment-movements", "read")),
):
    """Info du dernier import (batch_id, nb lignes) / Last import info."""
    result = await db.execute(
        select(
            ConsignmentMovement.batch_id,
            func.count(ConsignmentMovement.id).label("total_rows"),
        )
        .group_by(ConsignmentMovement.batch_id)
        .order_by(ConsignmentMovement.batch_id.desc())
        .limit(1)
    )
    row = result.first()
    if not row:
        return ConsignmentImportInfo()

    # batch_id = YYYYMMDDHHMMSS → formater en date lisible
    batch_id = row.batch_id
    imported_at = None
    if batch_id and len(batch_id) >= 14:
        try:
            dt = datetime.strptime(batch_id, "%Y%m%d%H%M%S")
            imported_at = dt.strftime("%Y-%m-%d %H:%M:%S")
        except ValueError:
            pass

    return ConsignmentImportInfo(
        batch_id=batch_id,
        total_rows=row.total_rows,
        imported_at=imported_at,
    )


# ─── GET /filters/ — Valeurs distinctes pour dropdowns ───

@router.get("/filters/", response_model=ConsignmentFilters)
async def get_filters(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("consignment-movements", "read")),
):
    """Valeurs distinctes pour les filtres / Distinct values for filter dropdowns."""
    bases = (await db.execute(
        select(ConsignmentMovement.base).distinct().order_by(ConsignmentMovement.base)
    )).scalars().all()

    types = (await db.execute(
        select(ConsignmentMovement.consignment_type).distinct()
        .where(ConsignmentMovement.consignment_type.isnot(None))
        .order_by(ConsignmentMovement.consignment_type)
    )).scalars().all()

    codes = (await db.execute(
        select(ConsignmentMovement.consignment_code).distinct()
        .order_by(ConsignmentMovement.consignment_code)
    )).scalars().all()

    flux = (await db.execute(
        select(ConsignmentMovement.flux_type).distinct()
        .order_by(ConsignmentMovement.flux_type)
    )).scalars().all()

    return ConsignmentFilters(
        bases=[b for b in bases if b],
        consignment_types=[t for t in types if t],
        consignment_codes=[c for c in codes if c],
        flux_types=[f for f in flux if f],
    )


# ─── DELETE /batches/{batch_id} — Supprimer un lot ───

@router.delete("/batches/{batch_id}", status_code=204)
async def delete_batch(
    batch_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("consignment-movements", "delete")),
):
    """Supprimer un lot d'import / Delete an import batch."""
    await db.execute(
        delete(ConsignmentMovement).where(ConsignmentMovement.batch_id == batch_id)
    )
    await db.flush()
