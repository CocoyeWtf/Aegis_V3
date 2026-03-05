"""Schémas Archive CMR / CMR Waybill Archive schemas."""

from pydantic import BaseModel, ConfigDict


class WaybillArchiveCreate(BaseModel):
    """Données pour créer/émettre un CMR / Data to create/issue a CMR."""
    tour_id: int
    establishment_place: str | None = None
    attached_documents: str | None = None
    sender_instructions: str | None = None
    payment_instructions: str | None = None
    cash_on_delivery: str | None = None
    special_agreements: str | None = None


class WaybillArchiveUpdate(BaseModel):
    """Champs éditables d'un CMR / Editable CMR fields."""
    attached_documents: str | None = None
    sender_instructions: str | None = None
    payment_instructions: str | None = None
    cash_on_delivery: str | None = None
    special_agreements: str | None = None
    reservations: str | None = None
    recipient_name: str | None = None
    delivery_remarks: str | None = None


class WaybillArchiveRead(BaseModel):
    """Lecture d'un CMR archivé / Read an archived CMR."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    cmr_number: str
    tour_id: int
    region_id: int
    status: str
    snapshot_json: str | None = None
    establishment_place: str | None = None
    establishment_date: str | None = None
    issued_at: str | None = None
    issued_by_id: int | None = None
    attached_documents: str | None = None
    sender_instructions: str | None = None
    payment_instructions: str | None = None
    cash_on_delivery: str | None = None
    reservations: str | None = None
    special_agreements: str | None = None
    sender_signed_at: str | None = None
    carrier_signed_at: str | None = None
    recipient_signed_at: str | None = None
    recipient_name: str | None = None
    delivery_remarks: str | None = None
    created_at: str | None = None
    updated_at: str | None = None
