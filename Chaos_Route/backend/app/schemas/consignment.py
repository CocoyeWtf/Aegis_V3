"""
Schemas Pydantic pour les mouvements de consignes / Pydantic schemas for consignment movements.
"""

from pydantic import BaseModel


class ConsignmentMovementRead(BaseModel):
    """Lecture d'un mouvement de consigne / Read a consignment movement."""

    id: int
    batch_id: str
    pdv_code: str
    pdv_name: str | None = None
    base: str
    waybill_number: int | None = None
    flux_date: str
    consignment_code: str
    consignment_label: str | None = None
    consignment_type: str | None = None
    quantity: int
    value: float | None = None
    flux_type: str
    unit_value: float | None = None
    year: int | None = None
    month: int | None = None

    model_config = {"from_attributes": True}


class ConsignmentImportResult(BaseModel):
    """Résultat d'un import Zèbre / Zèbre import result."""

    created: int
    skipped: int
    total_rows: int
    errors: list[str]
    batch_id: str


class ConsignmentBalanceItem(BaseModel):
    """Solde agrégé par PDV × code consigne / Aggregated balance per PDV × consignment code."""

    pdv_code: str
    pdv_name: str | None = None
    consignment_code: str
    consignment_label: str | None = None
    total_quantity: int
    total_value: float | None = None


class ConsignmentImportInfo(BaseModel):
    """Info du dernier import / Last import info."""

    batch_id: str | None = None
    total_rows: int = 0
    imported_at: str | None = None


class ConsignmentFilters(BaseModel):
    """Valeurs distinctes pour les dropdowns / Distinct values for dropdown filters."""

    bases: list[str]
    consignment_types: list[str]
    consignment_codes: list[str]
    flux_types: list[str]
