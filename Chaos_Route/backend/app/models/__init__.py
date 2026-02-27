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
from app.models.fuel_price import FuelPrice
from app.models.km_tax import KmTax
from app.models.parameter import Parameter
from app.models.audit import AuditLog
from app.models.loader import Loader
from app.models.user import User, Role, Permission, user_roles, user_regions
from app.models.mobile_device import MobileDevice
from app.models.device_assignment import DeviceAssignment
from app.models.gps_position import GPSPosition
from app.models.stop_event import StopEvent, StopEventType
from app.models.support_scan import SupportScan
from app.models.delivery_alert import DeliveryAlert, AlertType, AlertSeverity
from app.models.support_type import SupportType
from app.models.pickup_request import PickupRequest, PickupLabel, PickupType, PickupStatus, LabelStatus
from app.models.tour_manifest_line import TourManifestLine
from app.models.surcharge_type import SurchargeType
from app.models.tour_surcharge import TourSurcharge, SurchargeStatus

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
    "FuelPrice",
    "KmTax",
    "Parameter",
    "AuditLog",
    "User",
    "Role",
    "Permission",
    "user_roles",
    "user_regions",
    "Loader",
    "MobileDevice",
    "DeviceAssignment",
    "GPSPosition",
    "StopEvent",
    "StopEventType",
    "SupportScan",
    "DeliveryAlert",
    "AlertType",
    "AlertSeverity",
    "SupportType",
    "PickupRequest",
    "PickupLabel",
    "PickupType",
    "PickupStatus",
    "LabelStatus",
    "TourManifestLine",
    "SurchargeType",
    "TourSurcharge",
    "SurchargeStatus",
]
