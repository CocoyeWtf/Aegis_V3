"""Tests sélection prix carburant par type / Fuel price selection by type."""

import uuid

import pytest

from app.models.fuel_price import FuelPrice, FuelType
from app.utils.fuel_pricing import (
    contract_fuel_type,
    load_fuel_unit_prices,
    price_for_contract,
)


class _FakeContract:
    def __init__(self, fuel_type):
        self.fuel_type = fuel_type


@pytest.mark.asyncio
async def test_load_and_pick_fuel_price_by_type(db_session):
    d = f"2026-06-{uuid.uuid4().int % 28 + 1:02d}"
    db_session.add_all([
        FuelPrice(fuel_type=FuelType.GASOIL, start_date="2026-01-01", end_date="2030-12-31", price_per_liter=1.8),
        FuelPrice(fuel_type=FuelType.GAZ, start_date="2026-01-01", end_date="2030-12-31", price_per_liter=1.2),
    ])
    await db_session.flush()

    prices = await load_fuel_unit_prices(db_session, d)
    assert prices.get("GASOIL") == 1.8
    assert prices.get("GAZ") == 1.2

    assert price_for_contract(prices, _FakeContract(FuelType.GAZ)) == 1.2
    assert price_for_contract(prices, _FakeContract(FuelType.GASOIL)) == 1.8
    # Contrat legacy sans fuel_type -> défaut GASOIL
    assert price_for_contract(prices, _FakeContract(None)) == 1.8


def test_contract_fuel_type_default():
    assert contract_fuel_type(_FakeContract(None)) == "GASOIL"
    assert contract_fuel_type(_FakeContract(FuelType.GAZ)) == "GAZ"
    assert contract_fuel_type(_FakeContract("GASOIL")) == "GASOIL"
