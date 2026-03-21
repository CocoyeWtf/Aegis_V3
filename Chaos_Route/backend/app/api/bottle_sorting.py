"""Routes API tri vidanges / Bottle sorting API routes.
Sessions de tri par format et marque.
"""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.bottle_sorting import (
    BottleBrand, SortingSession, SortingLine,
    SortingStatus, BottleFormat, SortingRule,
)
from app.models.base_logistics import BaseLogistics
from app.schemas.bottle_sorting import (
    BottleBrandRead, BottleBrandCreate,
    SortingSessionCreate, SortingSessionRead,
    SortingLineCreate, SortingLineRead,
)
from app.api.deps import require_permission, get_current_user

router = APIRouter()


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ─── Marques / Brands ──────────────────────────────────────────────────


@router.get("/brands/", dependencies=[Depends(require_permission("bottle-sorting", "read"))])
async def list_brands(
    format: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
) -> list[BottleBrandRead]:
    """Liste les marques de bouteilles / List bottle brands."""
    q = select(BottleBrand).where(BottleBrand.is_active == 1)
    if format:
        q = q.where(BottleBrand.format == format)
    q = q.order_by(BottleBrand.format, BottleBrand.sorting_rule, BottleBrand.name)
    result = await db.execute(q)
    return [BottleBrandRead.model_validate(b) for b in result.scalars().all()]


@router.post("/brands/", dependencies=[Depends(require_permission("bottle-sorting", "create"))])
async def create_brand(data: BottleBrandCreate, db: AsyncSession = Depends(get_db)):
    """Crée une marque / Create a brand."""
    brand = BottleBrand(
        name=data.name,
        format=BottleFormat(data.format),
        sorting_rule=SortingRule(data.sorting_rule),
        mix_group=data.mix_group,
        crate_support_type_id=data.crate_support_type_id,
        bottles_per_crate=data.bottles_per_crate,
        deposit_per_bottle=data.deposit_per_bottle,
    )
    db.add(brand)
    await db.commit()
    await db.refresh(brand)
    return BottleBrandRead.model_validate(brand)


@router.delete("/brands/{brand_id}", dependencies=[Depends(require_permission("bottle-sorting", "delete"))])
async def delete_brand(brand_id: int, db: AsyncSession = Depends(get_db)):
    brand = await db.get(BottleBrand, brand_id)
    if not brand:
        raise HTTPException(404, "Marque introuvable")
    brand.is_active = 0
    await db.commit()
    return {"message": "Marque desactivee"}


# ─── Seed marques belges / Seed Belgian brands ─────────────────────────


@router.post("/brands/seed/", dependencies=[Depends(require_permission("bottle-sorting", "create"))])
async def seed_brands(db: AsyncSession = Depends(get_db)):
    """Pré-remplit les marques belges standards / Seed standard Belgian brands."""
    existing = (await db.execute(select(func.count()).select_from(BottleBrand))).scalar()
    if existing and existing > 0:
        return {"message": f"{existing} marques existent deja, seed ignore"}

    brands = [
        # 25CL MONO
        ("Carlsberg", "25CL", "MONO"), ("Maes", "25CL", "MONO"),
        ("Stella Artois", "25CL", "MONO"), ("Cuvee des Trolls", "25CL", "MONO"),
        ("Grisette", "25CL", "MONO"), ("Cristal Alken", "25CL", "MONO"),
        # 25CL MIX_ALLOWED
        ("Ciney", "25CL", "MIX_ALLOWED", "CINEY_MORT_SUBITE"),
        ("Mort Subite", "25CL", "MIX_ALLOWED", "CINEY_MORT_SUBITE"),
        # 33CL MONO
        ("Rochefort", "33CL", "MONO"), ("Westmalle", "33CL", "MONO"),
        ("Chimay", "33CL", "MONO"), ("Delirium", "33CL", "MONO"),
        ("Grimbergen", "33CL", "MONO"), ("Orval", "33CL", "MONO"),
        ("Affligem", "33CL", "MONO"), ("La Trappe", "33CL", "MONO"),
        ("Floreffe", "33CL", "MONO"), ("Bon Secours", "33CL", "MONO"),
        ("Quintine", "33CL", "MONO"),
        # FORMAT_MIX (casier générique)
        ("Jupiler 25CL", "25CL", "FORMAT_MIX"), ("Hoegaarden 25CL", "25CL", "FORMAT_MIX"),
        ("Leffe 25CL", "25CL", "FORMAT_MIX"), ("La Chouffe 25CL", "25CL", "FORMAT_MIX"),
        ("Jupiler 33CL", "33CL", "FORMAT_MIX"), ("Leffe 33CL", "33CL", "FORMAT_MIX"),
        ("Vedett 33CL", "33CL", "FORMAT_MIX"), ("Duvel", "33CL", "FORMAT_MIX"),
        ("Gauloise", "33CL", "FORMAT_MIX"), ("St-Feuillien", "33CL", "FORMAT_MIX"),
        ("Maredsous", "33CL", "FORMAT_MIX"), ("La Chouffe 33CL", "33CL", "FORMAT_MIX"),
        # 50CL
        ("Jupiler 50CL", "50CL", "FORMAT_MIX"), ("Leffe 50CL", "50CL", "FORMAT_MIX"),
    ]
    for b in brands:
        name, fmt, rule = b[0], b[1], b[2]
        mix_group = b[3] if len(b) > 3 else None
        db.add(BottleBrand(
            name=name, format=BottleFormat(fmt),
            sorting_rule=SortingRule(rule), mix_group=mix_group,
            bottles_per_crate=24 if fmt in ("25CL", "33CL") else 12,
        ))
    await db.commit()
    return {"message": f"{len(brands)} marques creees"}


# ─── Sessions de tri / Sorting sessions ─────────────────────────────────


@router.get("/sessions/", dependencies=[Depends(require_permission("bottle-sorting", "read"))])
async def list_sessions(
    base_id: int | None = Query(None),
    status: str | None = Query(None),
    limit: int = Query(50, le=200),
    db: AsyncSession = Depends(get_db),
) -> list[SortingSessionRead]:
    """Liste les sessions de tri / List sorting sessions."""
    q = select(SortingSession, BaseLogistics).join(
        BaseLogistics, SortingSession.base_id == BaseLogistics.id
    )
    if base_id:
        q = q.where(SortingSession.base_id == base_id)
    if status:
        q = q.where(SortingSession.status == status)
    q = q.order_by(SortingSession.session_date.desc()).limit(limit)

    result = await db.execute(q)
    rows = result.all()
    if not rows:
        return []

    session_ids = [s.id for s, _ in rows]

    # Batch load all lines for all sessions (1 query au lieu de N)
    all_lines_q = (
        select(SortingLine, BottleBrand)
        .outerjoin(BottleBrand, SortingLine.brand_id == BottleBrand.id)
        .where(SortingLine.session_id.in_(session_ids))
        .order_by(SortingLine.bottle_format, SortingLine.id)
    )
    all_lines = (await db.execute(all_lines_q)).all()

    # Group lines by session_id
    lines_by_session: dict[int, list[SortingLineRead]] = {}
    for ln, brand in all_lines:
        bpc = brand.bottles_per_crate if brand else 24
        total = ln.full_crates * bpc + ln.loose_bottles
        lr = SortingLineRead(
            id=ln.id, session_id=ln.session_id, brand_id=ln.brand_id,
            brand_name=brand.name if brand else None,
            bottle_format=ln.bottle_format.value if hasattr(ln.bottle_format, 'value') else ln.bottle_format,
            sorting_rule=ln.sorting_rule.value if hasattr(ln.sorting_rule, 'value') else ln.sorting_rule,
            full_crates=ln.full_crates, loose_bottles=ln.loose_bottles,
            damaged_bottles=ln.damaged_bottles, total_bottles=total,
            label=ln.label,
        )
        lines_by_session.setdefault(ln.session_id, []).append(lr)

    sessions = []
    for s, base in rows:
        sessions.append(SortingSessionRead(
            id=s.id, base_id=s.base_id, base_name=base.name,
            session_date=s.session_date,
            status=s.status.value if hasattr(s.status, 'value') else s.status,
            operator_name=s.operator_name,
            started_at=s.started_at, completed_at=s.completed_at,
            notes=s.notes, total_crates=s.total_crates, total_bottles=s.total_bottles,
            lines=lines_by_session.get(s.id, []),
        ))
    return sessions


@router.post("/sessions/", dependencies=[Depends(require_permission("bottle-sorting", "create"))])
async def create_session(
    data: SortingSessionCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """Démarre une session de tri / Start a sorting session."""
    session = SortingSession(
        base_id=data.base_id,
        session_date=data.session_date,
        status=SortingStatus.IN_PROGRESS,
        operator_name=data.operator_name,
        user_id=user.id if user else None,
        started_at=_now_iso(),
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return {"id": session.id, "message": "Session demarree"}


# ─── Lignes de tri / Sorting lines ──────────────────────────────────────


class LineBatchUpdate(BaseModel):
    """Mise à jour batch des lignes / Batch line update."""
    session_id: int
    lines: list[SortingLineCreate]


@router.post("/lines/batch/", dependencies=[Depends(require_permission("bottle-sorting", "update"))])
async def update_lines_batch(
    data: LineBatchUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Enregistre/met à jour les lignes d'une session / Save/update session lines."""
    session = await db.get(SortingSession, data.session_id)
    if not session:
        raise HTTPException(404, "Session introuvable")

    # Supprimer les anciennes lignes
    old = (await db.execute(
        select(SortingLine).where(SortingLine.session_id == data.session_id)
    )).scalars().all()
    for o in old:
        await db.delete(o)

    # Insérer les nouvelles
    for ln in data.lines:
        if ln.full_crates == 0 and ln.loose_bottles == 0 and ln.damaged_bottles == 0:
            continue
        db.add(SortingLine(
            session_id=data.session_id,
            brand_id=ln.brand_id,
            bottle_format=BottleFormat(ln.bottle_format),
            sorting_rule=SortingRule(ln.sorting_rule),
            full_crates=ln.full_crates,
            loose_bottles=ln.loose_bottles,
            damaged_bottles=ln.damaged_bottles,
            label=ln.label,
        ))

    await db.commit()
    return {"message": "Lignes enregistrees"}


# ─── Compléter session / Complete session ───────────────────────────────


@router.post("/sessions/{session_id}/complete", dependencies=[Depends(require_permission("bottle-sorting", "update"))])
async def complete_session(
    session_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Termine une session et calcule les totaux / Complete session with totals."""
    session = await db.get(SortingSession, session_id)
    if not session:
        raise HTTPException(404, "Session introuvable")

    # Calculer totaux
    lines = (await db.execute(
        select(SortingLine, BottleBrand).outerjoin(BottleBrand, SortingLine.brand_id == BottleBrand.id)
        .where(SortingLine.session_id == session_id)
    )).all()

    total_crates = 0
    total_bottles = 0
    for ln, brand in lines:
        bpc = brand.bottles_per_crate if brand else 24
        total_crates += ln.full_crates
        total_bottles += ln.full_crates * bpc + ln.loose_bottles

    session.status = SortingStatus.COMPLETED
    session.completed_at = _now_iso()
    session.total_crates = total_crates
    session.total_bottles = total_bottles

    await db.commit()
    return {"message": "Session terminee", "total_crates": total_crates, "total_bottles": total_bottles}


@router.delete("/sessions/{session_id}", dependencies=[Depends(require_permission("bottle-sorting", "delete"))])
async def delete_session(session_id: int, db: AsyncSession = Depends(get_db)):
    session = await db.get(SortingSession, session_id)
    if not session:
        raise HTTPException(404, "Session introuvable")
    lines = (await db.execute(select(SortingLine).where(SortingLine.session_id == session_id))).scalars().all()
    for ln in lines:
        await db.delete(ln)
    await db.delete(session)
    await db.commit()
    return {"message": "Session supprimee"}
