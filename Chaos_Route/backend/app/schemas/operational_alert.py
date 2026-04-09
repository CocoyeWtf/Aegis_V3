"""Schemas Alerte Operationnelle / Operational Alert schemas."""

from pydantic import BaseModel, ConfigDict


class AlertCommentCreate(BaseModel):
    text: str


class AlertCommentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    alert_id: int
    user_id: int | None = None
    user_name: str | None = None
    text: str
    created_at: str | None = None


class AlertCreate(BaseModel):
    alert_type: str = "CUSTOM"
    priority: str = "MEDIUM"
    title: str
    message: str | None = None
    tour_id: int | None = None
    tour_code: str | None = None
    pdv_id: int | None = None
    pdv_code: str | None = None
    base_id: int | None = None
    date: str | None = None


class AlertRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    alert_type: str
    status: str
    priority: str
    title: str
    message: str | None = None
    tour_id: int | None = None
    tour_code: str | None = None
    pdv_id: int | None = None
    pdv_code: str | None = None
    base_id: int | None = None
    date: str | None = None
    freed_eqp: float | None = None
    extra_data: str | None = None
    created_by_user_id: int | None = None
    created_by_name: str | None = None
    created_at: str | None = None
    resolved_by_user_id: int | None = None
    resolved_by_name: str | None = None
    resolved_at: str | None = None
    comments: list[AlertCommentRead] = []
