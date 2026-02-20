"""Modele Affectation telephone-chauffeur-tour / Device-driver-tour assignment model."""

from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class DeviceAssignment(Base):
    """Lien quotidien telephone-tour / Daily device-tour link.

    Le postier affecte un telephone a un tour + saisit le nom du chauffeur.
    user_id est optionnel (pour lien eventuel avec un compte utilisateur).
    """
    __tablename__ = "device_assignments"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    device_id: Mapped[int] = mapped_column(ForeignKey("mobile_devices.id"), nullable=False)
    tour_id: Mapped[int] = mapped_column(ForeignKey("tours.id"), nullable=False)
    date: Mapped[str] = mapped_column(String(10), nullable=False)  # YYYY-MM-DD
    driver_name: Mapped[str | None] = mapped_column(String(100))  # Nom du chauffeur saisi par le postier
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    assigned_at: Mapped[str | None] = mapped_column(String(25))  # ISO 8601
    returned_at: Mapped[str | None] = mapped_column(String(25))  # ISO 8601

    # Relations
    device: Mapped["MobileDevice"] = relationship(back_populates="assignments")
    tour: Mapped["Tour"] = relationship(foreign_keys=[tour_id])
