"""Schémas anomalies contenants / Container anomaly schemas."""

from pydantic import BaseModel, ConfigDict


class AnomalyCreate(BaseModel):
    """Création d'une anomalie / Create an anomaly."""
    pdv_id: int | None = None
    base_id: int | None = None
    support_type_id: int | None = None
    category: str  # MISSING | DAMAGED | SURPLUS | WRONG_TYPE | DISPUTE | EXPIRED | OTHER
    severity: str = "MEDIUM"
    title: str
    description: str | None = None
    quantity_expected: int | None = None
    quantity_actual: int | None = None
    financial_impact: float | None = None
    reference: str | None = None
    assigned_to: int | None = None
    due_date: str | None = None


class AnomalyUpdate(BaseModel):
    """Mise à jour d'une anomalie / Update an anomaly."""
    status: str | None = None
    severity: str | None = None
    title: str | None = None
    description: str | None = None
    assigned_to: int | None = None
    resolution_notes: str | None = None
    due_date: str | None = None
    financial_impact: float | None = None


class AnomalyDetail(BaseModel):
    """Anomalie enrichie / Enriched anomaly."""
    id: int
    pdv_id: int | None
    pdv_code: str | None
    pdv_name: str | None
    base_id: int | None
    base_name: str | None
    support_type_id: int | None
    support_type_code: str | None
    support_type_name: str | None
    category: str
    severity: str
    status: str
    title: str
    description: str | None
    quantity_expected: int | None
    quantity_actual: int | None
    financial_impact: float | None
    reference: str | None
    created_at: str
    created_by: int | None
    created_by_name: str | None
    assigned_to: int | None
    assigned_to_name: str | None
    started_at: str | None
    resolved_at: str | None
    resolved_by: int | None
    resolution_notes: str | None
    due_date: str | None
    delay_hours: float | None  # Heures depuis création
    photo_count: int
    comment_count: int


class AnomalyCommentCreate(BaseModel):
    content: str


class AnomalyCommentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    anomaly_id: int
    user_id: int | None
    user_name: str | None = None
    content: str
    created_at: str


class AnomalyKanbanBoard(BaseModel):
    """Board kanban complet / Full kanban board."""
    open: list[AnomalyDetail]
    in_progress: list[AnomalyDetail]
    resolved: list[AnomalyDetail]
    stats: dict
