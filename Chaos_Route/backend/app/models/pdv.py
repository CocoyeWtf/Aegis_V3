"""Modèle Point de Vente / Point of Sale model."""

import enum

from sqlalchemy import Boolean, Enum, Float, ForeignKey, Integer, String, Text, Time
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class PDVType(str, enum.Enum):
    """Type de point de vente / Point of sale type."""
    EXPRESS = "EXPRESS"
    CONTACT = "CONTACT"
    SUPER_ALIMENTAIRE = "SUPER_ALIMENTAIRE"
    SUPER_GENERALISTE = "SUPER_GENERALISTE"
    HYPER = "HYPER"
    NETTO = "NETTO"
    DRIVE = "DRIVE"
    URBAIN_PROXI = "URBAIN_PROXI"


class PDV(Base):
    __tablename__ = "pdvs"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    code: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    address: Mapped[str | None] = mapped_column(String(255))
    postal_code: Mapped[str | None] = mapped_column(String(20))
    city: Mapped[str | None] = mapped_column(String(100))
    phone: Mapped[str | None] = mapped_column(String(30))
    email: Mapped[str | None] = mapped_column(String(150))
    longitude: Mapped[float | None] = mapped_column(Float)
    latitude: Mapped[float | None] = mapped_column(Float)
    type: Mapped[PDVType] = mapped_column(Enum(PDVType), nullable=False)

    # SAS par température / SAS per temperature class
    has_sas_sec: Mapped[bool] = mapped_column(Boolean, default=False)
    sas_sec_surface_m2: Mapped[float | None] = mapped_column(Float)
    sas_sec_capacity_eqc: Mapped[int | None] = mapped_column(Integer)

    has_sas_frais: Mapped[bool] = mapped_column(Boolean, default=False)
    sas_frais_surface_m2: Mapped[float | None] = mapped_column(Float)
    sas_frais_capacity_eqc: Mapped[int | None] = mapped_column(Integer)

    has_sas_gel: Mapped[bool] = mapped_column(Boolean, default=False)
    sas_gel_surface_m2: Mapped[float | None] = mapped_column(Float)
    sas_gel_capacity_eqc: Mapped[int | None] = mapped_column(Integer)

    # Quai de déchargement / Unloading dock
    has_dock: Mapped[bool] = mapped_column(Boolean, default=False)
    dock_has_niche: Mapped[bool] = mapped_column(Boolean, default=False)
    # Niche sous quai (permet hayon rabattable) / Dock recess (allows foldable tailgate)
    dock_time_minutes: Mapped[int | None] = mapped_column(Integer)  # temps de mise à quai
    unload_time_per_eqp_minutes: Mapped[int | None] = mapped_column(Integer)  # temps déchargement par EQC (colonne DB héritée)

    # Fenêtre de livraison / Delivery window
    delivery_window_start: Mapped[str | None] = mapped_column(String(5))  # HH:MM
    delivery_window_end: Mapped[str | None] = mapped_column(String(5))  # HH:MM

    # Contraintes d'accès / Access constraints
    access_constraints: Mapped[str | None] = mapped_column(Text)

    # Types de véhicules autorisés (pipe-delimited) / Allowed vehicle types (pipe-delimited)
    # NULL = tous acceptés / NULL = all accepted
    allowed_vehicle_types: Mapped[str | None] = mapped_column(String(200))

    region_id: Mapped[int] = mapped_column(ForeignKey("regions.id"), nullable=False)

    # Relations
    region: Mapped["Region"] = relationship(back_populates="pdvs")
    volumes: Mapped[list["Volume"]] = relationship(back_populates="pdv")
    tour_stops: Mapped[list["TourStop"]] = relationship(back_populates="pdv")

    def __repr__(self) -> str:
        return f"<PDV {self.code} - {self.name}>"
