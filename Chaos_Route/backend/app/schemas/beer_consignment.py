"""Schémas consignes bière / Beer consignment schemas."""

from pydantic import BaseModel, ConfigDict


class BeerTxCreate(BaseModel):
    """Création d'une transaction consigne / Create a consignment transaction."""
    pdv_id: int
    support_type_id: int
    transaction_type: str  # DELIVERY | RETURN | ADJUSTMENT | WRITE_OFF
    crate_qty: int
    loose_bottle_qty: int = 0
    reference: str | None = None
    transaction_date: str  # YYYY-MM-DD
    notes: str | None = None


class BeerTxRead(BaseModel):
    """Lecture transaction consigne / Read consignment transaction."""
    model_config = ConfigDict(from_attributes=True)
    id: int
    pdv_id: int
    support_type_id: int
    transaction_type: str
    crate_qty: int
    loose_bottle_qty: int
    unit_value_snapshot: float | None
    bottle_value_snapshot: float | None
    reference: str | None
    transaction_date: str
    created_at: str
    user_id: int | None
    notes: str | None


class BeerTxDetail(BaseModel):
    """Transaction enrichie avec noms / Enriched transaction with names."""
    id: int
    pdv_id: int
    pdv_code: str
    pdv_name: str
    support_type_id: int
    support_type_code: str
    support_type_name: str
    transaction_type: str
    crate_qty: int
    loose_bottle_qty: int
    unit_value_snapshot: float | None
    bottle_value_snapshot: float | None
    financial_value: float  # Valeur calculée de la transaction
    reference: str | None
    transaction_date: str
    created_at: str
    notes: str | None


class BeerBalanceDetail(BaseModel):
    """Solde enrichi par PDV × type / Enriched balance per PDV × type."""
    pdv_id: int
    pdv_code: str
    pdv_name: str
    support_type_id: int
    support_type_code: str
    support_type_name: str
    unit_value: float | None
    bottles_per_crate: int | None
    bottle_value: float | None
    crate_balance: int
    loose_bottle_balance: int
    total_delivered: int
    total_returned: int
    total_write_off: int
    balance_value: float  # Valeur EUR du solde
    last_delivery_date: str | None
    last_return_date: str | None


class BeerBalanceSummary(BaseModel):
    """Résumé global consignes / Overall consignment summary."""
    items: list[BeerBalanceDetail]
    total_crate_balance: int
    total_balance_value: float
    total_delivered: int
    total_returned: int
    pdv_count: int
