"""Inventaire contenants PDV / PDV container inventory.
Suivi du stock de contenants par point de vente.
"""

from sqlalchemy import Column, Integer, Float, Index, String, ForeignKey, DateTime
from app.database import Base


class PdvInventory(Base):
    """Snapshot d'inventaire — un enregistrement par type de support inventorié.
    Inventory snapshot — one record per support type inventoried."""
    __tablename__ = "pdv_inventories"
    __table_args__ = (
        Index("ix_pdv_inventories_support_type", "support_type_id"),
    )

    id = Column(Integer, primary_key=True, index=True)
    pdv_id = Column(Integer, ForeignKey("pdvs.id"), nullable=False, index=True)
    support_type_id = Column(Integer, ForeignKey("support_types.id"), nullable=False)
    quantity = Column(Integer, nullable=False, default=0)
    inventoried_at = Column(String, nullable=False)  # ISO 8601
    device_id = Column(Integer, ForeignKey("mobile_devices.id"), nullable=True)
    inventoried_by = Column(String, nullable=True)  # driver name or username


class PdvStock(Base):
    """Stock courant par PDV × type de support — mis à jour par inventaire.
    Current stock per PDV × support type — updated by inventory."""
    __tablename__ = "pdv_stocks"
    __table_args__ = (
        Index("ix_pdv_stocks_support_type", "support_type_id"),
    )

    id = Column(Integer, primary_key=True, index=True)
    pdv_id = Column(Integer, ForeignKey("pdvs.id"), nullable=False, index=True)
    support_type_id = Column(Integer, ForeignKey("support_types.id"), nullable=False)
    current_stock = Column(Integer, nullable=False, default=0)
    puo = Column(Integer, nullable=True)  # Parc Unités autorisé / Authorized stock level
    last_inventory_at = Column(String, nullable=True)  # ISO 8601
    last_inventory_device_id = Column(Integer, nullable=True)
    last_inventoried_by = Column(String, nullable=True)
