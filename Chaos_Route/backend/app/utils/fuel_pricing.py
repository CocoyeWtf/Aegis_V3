"""Helpers prix carburant par type / Fuel pricing helpers by fuel type.

Le coût carburant d'un contrat dépend de son `fuel_type` (gasoil vs gaz) :
on charge les prix valides à une date pour chaque type, puis on choisit le
prix selon le type du contrat (défaut GASOIL pour les contrats legacy).
"""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.fuel_price import FuelPrice, FuelType


def contract_fuel_type(contract) -> str:
    """Type de carburant d'un contrat sous forme de chaîne (défaut GASOIL)."""
    ft = getattr(contract, "fuel_type", None)
    if ft is None:
        return FuelType.GASOIL.value
    return ft.value if hasattr(ft, "value") else str(ft)


async def load_fuel_unit_prices(db: AsyncSession, date: str) -> dict[str, float]:
    """Prix carburant valides à `date`, par type / Valid fuel prices at date, by type.

    Retourne {fuel_type: prix}. Pour chaque type, l'entrée à start_date la plus
    récente couvrant la date l'emporte (cohérent avec l'ancien comportement).
    """
    rows = (await db.execute(
        select(FuelPrice.fuel_type, FuelPrice.price_per_liter)
        .where(FuelPrice.start_date <= date, FuelPrice.end_date >= date)
        .order_by(FuelPrice.start_date.desc())
    )).all()
    out: dict[str, float] = {}
    for ft, price in rows:
        key = (ft.value if hasattr(ft, "value") else str(ft)) if ft is not None else FuelType.GASOIL.value
        if key not in out:  # déjà trié desc -> première rencontre = plus récente
            out[key] = float(price) if price is not None else 0.0
    return out


def price_for_contract(prices: dict[str, float], contract) -> float:
    """Prix carburant applicable au contrat (0.0 si absent)."""
    return prices.get(contract_fuel_type(contract), 0.0)
