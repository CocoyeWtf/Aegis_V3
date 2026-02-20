"""Modele Telephone enregistre / Registered mobile device model."""

from sqlalchemy import Boolean, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class MobileDevice(Base):
    """Telephone enregistre dans le parc / Registered fleet phone."""
    __tablename__ = "mobile_devices"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    device_identifier: Mapped[str | None] = mapped_column(String(100), unique=True, nullable=True)  # UUID du tel, rempli a l'enregistrement
    friendly_name: Mapped[str | None] = mapped_column(String(100))
    registration_code: Mapped[str] = mapped_column(String(36), unique=True, nullable=False)  # UUID court pour QR
    base_id: Mapped[int | None] = mapped_column(ForeignKey("bases_logistics.id"))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    registered_at: Mapped[str | None] = mapped_column(String(25))  # ISO 8601

    # Relations
    base: Mapped["BaseLogistics | None"] = relationship()
    assignments: Mapped[list["DeviceAssignment"]] = relationship(back_populates="device")
