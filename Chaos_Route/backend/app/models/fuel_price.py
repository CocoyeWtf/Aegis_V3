"""Modèle Prix carburant / Fuel price model.

Gère gasoil (DIESEL) et gaz (GNV). `price_per_liter` stocke le prix par unité
naturelle du carburant : €/L pour le gasoil, €/kg pour le gaz (le nom de colonne
est conservé pour ne pas casser la base existante).

Réutilise l'enum FuelType partagé (models.contract) pour rester cohérent avec
le parc véhicules et éviter une collision de type PG (`fueltype`).
"""

from sqlalchemy import Enum, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models.contract import FuelType  # noqa: F401 (réexporté)
from app.models.mixins import TenantMixin


class FuelPrice(Base, TenantMixin):
    """Prix carburant avec période de validité / Fuel price with validity period.

    Cloisonné par société (TenantMixin) : le prix du carburant diffère d'un pays
    à l'autre. Le filtrage/stampage tenant est automatique (cf. app.database).
    Les lignes existantes sont rétro-rattachées à la Belgique (tenant 1) au démarrage.
    """
    __tablename__ = "fuel_prices"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    # Type de carburant. Nullable en base (migration sûre), rétro-rempli DIESEL
    # au démarrage. Requis côté API (création).
    fuel_type: Mapped[FuelType | None] = mapped_column(
        Enum(FuelType), nullable=True, default=FuelType.DIESEL
    )
    start_date: Mapped[str] = mapped_column(String(10), nullable=False)  # YYYY-MM-DD
    end_date: Mapped[str] = mapped_column(String(10), nullable=False)    # YYYY-MM-DD
    # Prix par unité : €/L (gasoil) ou €/kg (gaz)
    price_per_liter: Mapped[float] = mapped_column(Numeric(6, 4), nullable=False)

    def __repr__(self) -> str:
        return f"<FuelPrice {self.fuel_type} {self.start_date}→{self.end_date} = {self.price_per_liter}>"
