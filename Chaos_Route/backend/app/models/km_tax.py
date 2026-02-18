"""Modèle Taxe au kilomètre / Km tax model (matrix like distance_matrix)."""

from sqlalchemy import Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class KmTax(Base):
    """Taxe au km par segment origine→destination / Km tax per origin→destination segment."""
    __tablename__ = "km_tax"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    origin_type: Mapped[str] = mapped_column(String(20), nullable=False)   # BASE, PDV
    origin_id: Mapped[int] = mapped_column(Integer, nullable=False)
    destination_type: Mapped[str] = mapped_column(String(20), nullable=False)
    destination_id: Mapped[int] = mapped_column(Integer, nullable=False)
    tax_per_km: Mapped[float] = mapped_column(Numeric(8, 4), nullable=False)

    def __repr__(self) -> str:
        return f"<KmTax {self.origin_type}:{self.origin_id} -> {self.destination_type}:{self.destination_id}>"
