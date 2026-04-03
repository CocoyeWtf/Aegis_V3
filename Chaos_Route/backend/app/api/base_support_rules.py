"""Routes regles support par base / Base-support rules admin routes.
Matrice base × type de support : quels supports peuvent etre repris par quelle base.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.base_support_rule import BaseSupportRule
from app.models.base_logistics import BaseLogistics
from app.models.support_type import SupportType
from app.models.user import User
from app.api.deps import require_permission

router = APIRouter()


@router.get("/")
async def list_rules(
    base_id: int | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("support-types", "read")),
):
    """Lister les regles support/base / List base-support rules."""
    query = select(BaseSupportRule).order_by(BaseSupportRule.base_id, BaseSupportRule.support_type_id)
    if base_id is not None:
        query = query.where(BaseSupportRule.base_id == base_id)
    result = await db.execute(query)
    rules = result.scalars().all()

    return [
        {
            "id": r.id,
            "base_id": r.base_id,
            "support_type_id": r.support_type_id,
            "allowed": r.allowed,
        }
        for r in rules
    ]


@router.get("/matrix")
async def get_matrix(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("support-types", "read")),
):
    """Matrice complete base × support avec regles / Full matrix with rules.
    Retourne bases, support_types et les regles existantes.
    """
    bases_result = await db.execute(select(BaseLogistics).order_by(BaseLogistics.code))
    bases = bases_result.scalars().all()

    st_result = await db.execute(
        select(SupportType)
        .where(SupportType.is_active == True)
        .order_by(SupportType.code)
    )
    support_types = st_result.scalars().all()

    rules_result = await db.execute(select(BaseSupportRule))
    rules = rules_result.scalars().all()

    # Map (base_id, support_type_id) → allowed
    rules_map = {(r.base_id, r.support_type_id): r.allowed for r in rules}

    return {
        "bases": [{"id": b.id, "code": b.code, "name": b.name} for b in bases],
        "support_types": [{"id": st.id, "code": st.code, "name": st.name} for st in support_types],
        "rules": rules_map,  # dict avec cles "(base_id, st_id)" serialisees
        "rules_list": [
            {"base_id": r.base_id, "support_type_id": r.support_type_id, "allowed": r.allowed}
            for r in rules
        ],
    }


@router.put("/toggle")
async def toggle_rule(
    base_id: int,
    support_type_id: int,
    allowed: bool,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("support-types", "update")),
):
    """Activer/desactiver un support pour une base / Toggle support for a base.
    Cree la regle si inexistante, met a jour sinon.
    """
    result = await db.execute(
        select(BaseSupportRule).where(
            BaseSupportRule.base_id == base_id,
            BaseSupportRule.support_type_id == support_type_id,
        )
    )
    rule = result.scalar_one_or_none()

    if rule:
        rule.allowed = allowed
    else:
        rule = BaseSupportRule(
            base_id=base_id,
            support_type_id=support_type_id,
            allowed=allowed,
        )
        db.add(rule)

    await db.flush()
    return {"base_id": base_id, "support_type_id": support_type_id, "allowed": allowed}


@router.delete("/reset")
async def reset_rules(
    base_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("support-types", "delete")),
):
    """Supprimer toutes les regles d'une base (retour au defaut: tout autorise) / Reset all rules for a base."""
    result = await db.execute(
        select(BaseSupportRule).where(BaseSupportRule.base_id == base_id)
    )
    for rule in result.scalars().all():
        await db.delete(rule)

    return {"base_id": base_id, "reset": True}
