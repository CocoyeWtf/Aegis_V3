"""Modele inspection vehicule / Vehicle inspection model.

Une inspection = un ensemble de points de controle (items) + photos.
An inspection = a set of check items + photos.
"""

import enum

from sqlalchemy import Boolean, Enum, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class InspectionType(str, enum.Enum):
    """Type d'inspection / Inspection type."""
    PRE_DEPARTURE = "PRE_DEPARTURE"
    POST_RETURN = "POST_RETURN"
    PERIODIC = "PERIODIC"


class InspectionStatus(str, enum.Enum):
    """Statut inspection / Inspection status."""
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


class InspectionItemResult(str, enum.Enum):
    """Resultat item inspection / Inspection item result."""
    OK = "OK"
    KO = "KO"
    NA = "NA"
    NOT_CHECKED = "NOT_CHECKED"


class VehicleInspection(Base):
    """Inspection vehicule (depart, retour, periodique) / Vehicle inspection."""
    __tablename__ = "vehicle_inspections"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    vehicle_id: Mapped[int] = mapped_column(ForeignKey("vehicles.id"), nullable=False)
    tour_id: Mapped[int | None] = mapped_column(ForeignKey("tours.id"))
    device_id: Mapped[int | None] = mapped_column(ForeignKey("mobile_devices.id"))
    inspection_type: Mapped[InspectionType] = mapped_column(Enum(InspectionType), nullable=False)
    status: Mapped[InspectionStatus] = mapped_column(
        Enum(InspectionStatus), default=InspectionStatus.IN_PROGRESS
    )
    driver_name: Mapped[str | None] = mapped_column(String(100))
    km_at_inspection: Mapped[int | None] = mapped_column(Integer)
    latitude: Mapped[float | None] = mapped_column(Float)
    longitude: Mapped[float | None] = mapped_column(Float)
    started_at: Mapped[str] = mapped_column(String(32), nullable=False)  # ISO 8601
    completed_at: Mapped[str | None] = mapped_column(String(32))
    remarks: Mapped[str | None] = mapped_column(Text)
    has_critical_defect: Mapped[bool] = mapped_column(Boolean, default=False)

    # Relations
    vehicle: Mapped["Vehicle"] = relationship(back_populates="inspections")
    items: Mapped[list["InspectionItem"]] = relationship(
        back_populates="inspection", cascade="all, delete-orphan"
    )
    photos: Mapped[list["InspectionPhoto"]] = relationship(
        back_populates="inspection", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<VehicleInspection {self.id} - {self.inspection_type.value} - vehicle {self.vehicle_id}>"


class InspectionItem(Base):
    """Resultat d'un point d'inspection / Individual inspection item result."""
    __tablename__ = "inspection_items"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    inspection_id: Mapped[int] = mapped_column(ForeignKey("vehicle_inspections.id"), nullable=False)
    template_id: Mapped[int | None] = mapped_column(ForeignKey("inspection_templates.id"))
    label: Mapped[str] = mapped_column(String(150), nullable=False)
    category: Mapped[str] = mapped_column(String(30), nullable=False)
    result: Mapped[InspectionItemResult] = mapped_column(
        Enum(InspectionItemResult), default=InspectionItemResult.NOT_CHECKED
    )
    comment: Mapped[str | None] = mapped_column(Text)
    is_critical: Mapped[bool] = mapped_column(Boolean, default=False)
    requires_photo: Mapped[bool] = mapped_column(Boolean, default=False)

    # Relations
    inspection: Mapped["VehicleInspection"] = relationship(back_populates="items")

    def __repr__(self) -> str:
        return f"<InspectionItem {self.label} - {self.result.value}>"


class InspectionPhoto(Base):
    """Photos inspection vehicule / Vehicle inspection photos."""
    __tablename__ = "inspection_photos"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    inspection_id: Mapped[int] = mapped_column(ForeignKey("vehicle_inspections.id"), nullable=False)
    item_id: Mapped[int | None] = mapped_column(ForeignKey("inspection_items.id"))
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    file_path: Mapped[str] = mapped_column(String(500), nullable=False)
    file_size: Mapped[int | None] = mapped_column(Integer)
    mime_type: Mapped[str | None] = mapped_column(String(50))
    uploaded_at: Mapped[str] = mapped_column(String(32), nullable=False)  # ISO 8601

    # Relations
    inspection: Mapped["VehicleInspection"] = relationship(back_populates="photos")
