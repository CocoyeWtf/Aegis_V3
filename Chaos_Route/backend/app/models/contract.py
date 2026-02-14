"""Modèle Contrat transporteur / Transport contract model."""

from sqlalchemy import ForeignKey, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Contract(Base):
    __tablename__ = "contracts"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    transporter_name: Mapped[str] = mapped_column(String(150), nullable=False)
    code: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    fixed_daily_cost: Mapped[float | None] = mapped_column(Numeric(10, 2))  # terme fixe
    cost_per_km: Mapped[float | None] = mapped_column(Numeric(10, 4))
    cost_per_hour: Mapped[float | None] = mapped_column(Numeric(10, 2))
    min_hours_per_day: Mapped[float | None] = mapped_column(Numeric(5, 2))
    min_km_per_day: Mapped[float | None] = mapped_column(Numeric(8, 2))
    start_date: Mapped[str | None] = mapped_column(String(10))  # YYYY-MM-DD
    end_date: Mapped[str | None] = mapped_column(String(10))
    region_id: Mapped[int] = mapped_column(ForeignKey("regions.id"), nullable=False)

    # Relations
    region: Mapped["Region"] = relationship(back_populates="contracts")
    tours: Mapped[list["Tour"]] = relationship(back_populates="contract")

    def __repr__(self) -> str:
        return f"<Contract {self.code} - {self.transporter_name}>"
