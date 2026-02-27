"""Modele template inspection / Inspection template (checklist configurable)."""

import enum

from sqlalchemy import Boolean, Enum, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class InspectionCategory(str, enum.Enum):
    """Categorie d'inspection / Inspection category."""
    EXTERIOR = "EXTERIOR"
    CABIN = "CABIN"
    ENGINE = "ENGINE"
    BRAKES = "BRAKES"
    TIRES = "TIRES"
    LIGHTS = "LIGHTS"
    CARGO = "CARGO"
    REFRIGERATION = "REFRIGERATION"
    SAFETY = "SAFETY"
    DOCUMENTS = "DOCUMENTS"


class InspectionTemplate(Base):
    """Template d'inspection configurable par type vehicule / Configurable checklist item."""
    __tablename__ = "inspection_templates"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    label: Mapped[str] = mapped_column(String(150), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    category: Mapped[InspectionCategory] = mapped_column(Enum(InspectionCategory), nullable=False)
    # Types vehicule applicables (CSV) ou NULL = tous / Applicable vehicle types (CSV) or NULL = all
    applicable_vehicle_types: Mapped[str | None] = mapped_column(String(200))
    is_critical: Mapped[bool] = mapped_column(Boolean, default=False)
    requires_photo: Mapped[bool] = mapped_column(Boolean, default=False)
    display_order: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    def __repr__(self) -> str:
        return f"<InspectionTemplate {self.category.value}: {self.label}>"
