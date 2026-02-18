"""Modèle Prix du gasoil / Fuel price model."""

from sqlalchemy import Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class FuelPrice(Base):
    """Prix du gasoil avec période de validité / Fuel price with validity period."""
    __tablename__ = "fuel_prices"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    start_date: Mapped[str] = mapped_column(String(10), nullable=False)  # YYYY-MM-DD
    end_date: Mapped[str] = mapped_column(String(10), nullable=False)    # YYYY-MM-DD
    price_per_liter: Mapped[float] = mapped_column(Numeric(6, 4), nullable=False)

    def __repr__(self) -> str:
        return f"<FuelPrice {self.start_date}→{self.end_date} = {self.price_per_liter}>"
