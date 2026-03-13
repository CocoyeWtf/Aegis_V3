"""Stock contenants base / Base container stock.
Suivi du stock de contenants par entrepot (base logistique).
"""

import enum

from sqlalchemy import Column, Enum, Float, Integer, String, Text, ForeignKey
from app.database import Base


class BaseMovementType(str, enum.Enum):
    """Type de mouvement contenant base / Base container movement type."""
    RECEIVED_FROM_PDV = "RECEIVED_FROM_PDV"        # Reception depuis PDV (scan base)
    DELIVERY_PREP = "DELIVERY_PREP"                # Sortie preparation livraison
    SUPPLIER_RETURN = "SUPPLIER_RETURN"            # Retour fournisseur
    INVENTORY_ADJUSTMENT = "INVENTORY_ADJUSTMENT"  # Ajustement inventaire physique


class BaseContainerStock(Base):
    """Stock courant par base × type de support.
    Current stock per base × support type."""
    __tablename__ = "base_container_stocks"

    id = Column(Integer, primary_key=True, index=True)
    base_id = Column(Integer, ForeignKey("bases_logistics.id"), nullable=False, index=True)
    support_type_id = Column(Integer, ForeignKey("support_types.id"), nullable=False)
    current_stock = Column(Integer, nullable=False, default=0)
    last_updated_at = Column(String, nullable=True)  # ISO 8601


class BaseContainerMovement(Base):
    """Mouvement contenant base — tracabilite complete.
    Base container movement — full traceability."""
    __tablename__ = "base_container_movements"

    id = Column(Integer, primary_key=True, index=True)
    base_id = Column(Integer, ForeignKey("bases_logistics.id"), nullable=False, index=True)
    support_type_id = Column(Integer, ForeignKey("support_types.id"), nullable=False)
    movement_type = Column(Enum(BaseMovementType), nullable=False)
    quantity = Column(Integer, nullable=False)  # positif = entree, negatif = sortie
    reference = Column(String(100), nullable=True)  # label_code, bon de livraison, etc.
    timestamp = Column(String(32), nullable=False)  # ISO 8601
    device_id = Column(Integer, ForeignKey("mobile_devices.id"), nullable=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    notes = Column(Text, nullable=True)
