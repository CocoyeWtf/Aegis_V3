"""Schémas inventaire PDV / PDV inventory schemas."""

from pydantic import BaseModel, ConfigDict


class InventoryLineCreate(BaseModel):
    """Une ligne d'inventaire / One inventory line."""
    support_type_id: int
    quantity: int


class InventorySubmit(BaseModel):
    """Soumission d'inventaire complet PDV / Full PDV inventory submission."""
    pdv_id: int
    lines: list[InventoryLineCreate]
    inventoried_by: str | None = None


class PdvStockRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    pdv_id: int
    support_type_id: int
    current_stock: int
    last_inventory_at: str | None
    last_inventoried_by: str | None


class PdvStockDetail(BaseModel):
    """Stock enrichi avec noms / Enriched stock with names."""
    pdv_id: int
    pdv_code: str
    pdv_name: str
    support_type_id: int
    support_type_code: str
    support_type_name: str
    current_stock: int
    last_inventory_at: str | None
    last_inventoried_by: str | None


class PdvInventoryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    pdv_id: int
    support_type_id: int
    quantity: int
    inventoried_at: str
    inventoried_by: str | None
