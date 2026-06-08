"""Modèle Prix carburant / Fuel price model.

Gère gasoil et gaz. `price_per_liter` stocke le prix par unité naturelle du
carburant : €/L pour le gasoil, €/kg pour le gaz (le nom de colonne est
conservé pour ne pas casser la base existante).
"""

import enum

from sqlalchemy import Enum, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class FuelType(str, enum.Enum):
    """Type de carburant / Fuel type."""
    GASOIL = "GASOIL"  # Diesel (€/L)
    GAZ = "GAZ"        # Gaz GNC/GNL (€/kg)


class FuelPrice(Base):
    """Prix carburant avec période de validité / Fuel price with validity period."""
    __tablename__ = "fuel_prices"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    # Type de carburant. Nullable en base (migration sûre sur lignes existantes),
    # rétro-rempli en GASOIL au démarrage. Requis côté API (création).
    fuel_type: Mapped[FuelType | None] = mapped_column(
        Enum(FuelType), nullable=True, default=FuelType.GASOIL
    )
    start_date: Mapped[str] = mapped_column(String(10), nullable=False)  # YYYY-MM-DD
    end_date: Mapped[str] = mapped_column(String(10), nullable=False)    # YYYY-MM-DD
    # Prix par unité : €/L (gasoil) ou €/kg (gaz)
    price_per_liter: Mapped[float] = mapped_column(Numeric(6, 4), nullable=False)

    def __repr__(self) -> str:
        return f"<FuelPrice {self.fuel_type} {self.start_date}→{self.end_date} = {self.price_per_liter}>"
