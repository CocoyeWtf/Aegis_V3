"""
Route Aide à la Décision / Decision Support route.
Simulation pure — aucun impact sur les données.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_permission
from app.database import get_db
from app.models.user import User
from app.schemas.aide_decision import AideDecisionRequest, AideDecisionResponse
from app.services.aide_decision import AideDecisionService

router = APIRouter()


@router.post("/generate", response_model=AideDecisionResponse)
async def generate_aide_decision(
    request: AideDecisionRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("aide-decision", "read")),
) -> AideDecisionResponse:
    """Générer une simulation aide à la décision / Generate decision support simulation.
    POST car calcul non-trivial. Aucune donnée modifiée.
    """
    service = AideDecisionService(db)
    return await service.generate(request)
