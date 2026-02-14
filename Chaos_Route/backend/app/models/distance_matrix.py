"""Modèle Distancier / Distance matrix model."""

from sqlalchemy import Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class DistanceMatrix(Base):
    __tablename__ = "distance_matrix"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    origin_type: Mapped[str] = mapped_column(String(20), nullable=False)  # BASE, PDV, SUPPLIER
    origin_id: Mapped[int] = mapped_column(Integer, nullable=False)
    destination_type: Mapped[str] = mapped_column(String(20), nullable=False)
    destination_id: Mapped[int] = mapped_column(Integer, nullable=False)
    distance_km: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    duration_minutes: Mapped[int] = mapped_column(Integer, nullable=False)

    def __repr__(self) -> str:
        return f"<Distance {self.origin_type}:{self.origin_id} -> {self.destination_type}:{self.destination_id}>"
