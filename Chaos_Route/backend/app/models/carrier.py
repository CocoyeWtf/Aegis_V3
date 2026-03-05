"""Modèle Transporteur / Carrier model."""

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Carrier(Base):
    """Transporteur (société) / Carrier (company)."""
    __tablename__ = "carriers"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    code: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    address: Mapped[str | None] = mapped_column(String(255))
    postal_code: Mapped[str | None] = mapped_column(String(20))
    city: Mapped[str | None] = mapped_column(String(100))
    country: Mapped[str | None] = mapped_column(String(100))
    phone: Mapped[str | None] = mapped_column(String(50))
    email: Mapped[str | None] = mapped_column(String(150))
    transport_license: Mapped[str | None] = mapped_column(String(50))
    vat_number: Mapped[str | None] = mapped_column(String(30))
    siren: Mapped[str | None] = mapped_column(String(20))  # SIREN/SIRET (CMR case 16)
    accounting_code: Mapped[str | None] = mapped_column(String(30))
    contact_person: Mapped[str | None] = mapped_column(String(150))
    notes: Mapped[str | None] = mapped_column(Text)
    region_id: Mapped[int] = mapped_column(ForeignKey("regions.id"), nullable=False)

    # Relations
    region: Mapped["Region"] = relationship(back_populates="carriers")
    contracts: Mapped[list["Contract"]] = relationship(back_populates="carrier")

    def __repr__(self) -> str:
        return f"<Carrier {self.code} - {self.name}>"
