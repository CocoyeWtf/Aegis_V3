"""Routes Tenants / Tenant API routes.

Lecture seule, réservée aux superadmins : sert à peupler le sélecteur de société
lors de la création/édition d'un utilisateur. L'affectation d'un utilisateur à un
tenant est elle aussi réservée aux superadmins (cf. app.api.users).
"""

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.tenant import Tenant
from app.models.user import User
from app.schemas.tenant import TenantRead
from app.api.deps import require_superadmin

router = APIRouter()


@router.get("/", response_model=list[TenantRead])
async def list_tenants(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_superadmin),
):
    """Lister les sociétés (tenants) / List tenants. Superadmin only."""
    result = await db.execute(select(Tenant).order_by(Tenant.id))
    return result.scalars().all()
