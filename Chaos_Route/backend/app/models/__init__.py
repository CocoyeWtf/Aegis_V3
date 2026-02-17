"""
Modèles SQLAlchemy / SQLAlchemy models.
Importer tous les modèles ici pour qu'Alembic les détecte.
Import all models here so Alembic can detect them.
"""

from app.models.country import Country
from app.models.region import Region
from app.models.base_activity import BaseActivity, base_activity_link
from app.models.base_logistics import BaseLogistics
from app.models.pdv import PDV
from app.models.supplier import Supplier
from app.models.volume import Volume
from app.models.tour import Tour
from app.models.tour_stop import TourStop
from app.models.contract import Contract
from app.models.contract_schedule import ContractSchedule
from app.models.distance_matrix import DistanceMatrix
from app.models.parameter import Parameter
from app.models.audit import AuditLog
from app.models.user import User, Role, Permission, user_roles, user_regions

__all__ = [
    "Country",
    "Region",
    "BaseActivity",
    "base_activity_link",
    "BaseLogistics",
    "PDV",
    "Supplier",
    "Volume",
    "Tour",
    "TourStop",
    "Contract",
    "ContractSchedule",
    "DistanceMatrix",
    "Parameter",
    "AuditLog",
    "User",
    "Role",
    "Permission",
    "user_roles",
    "user_regions",
]
