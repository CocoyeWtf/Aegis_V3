"""
Modèles SQLAlchemy / SQLAlchemy models.
Importer tous les modèles ici pour qu'Alembic les détecte.
Import all models here so Alembic can detect them.
"""

from app.models.country import Country
from app.models.region import Region
from app.models.base_logistics import BaseLogistics
from app.models.pdv import PDV
from app.models.vehicle import Vehicle
from app.models.vehicle_schedule import VehicleSchedule
from app.models.supplier import Supplier
from app.models.volume import Volume
from app.models.tour import Tour
from app.models.tour_stop import TourStop
from app.models.contract import Contract
from app.models.distance_matrix import DistanceMatrix
from app.models.parameter import Parameter
from app.models.audit import AuditLog

__all__ = [
    "Country",
    "Region",
    "BaseLogistics",
    "PDV",
    "Vehicle",
    "VehicleSchedule",
    "Supplier",
    "Volume",
    "Tour",
    "TourStop",
    "Contract",
    "DistanceMatrix",
    "Parameter",
    "AuditLog",
]
