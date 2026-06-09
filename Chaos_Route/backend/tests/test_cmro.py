"""Tests calcul de coût pré-facturation CMRO + jours fériés belges."""

from datetime import date
from types import SimpleNamespace

from app.services.cmro_extraction import compute_cost
from app.utils.holidays_be import is_belgian_holiday


def _tour(d: str):
    return SimpleNamespace(
        total_km=100, total_duration_minutes=120,  # 2h
        barrier_exit_time=None, barrier_entry_time=None, date=d,
    )


def _contract():
    return SimpleNamespace(
        fixed_daily_cost=400, cost_per_km=0.5, consumption_coefficient=0.3,
        cost_per_hour=10, ha_cost=50, trailer_cost=65,
        prime_saturday=30, prime_sunday_holiday=60,
    )


def test_cost_weekday():
    # 2026-06-08 = lundi
    c = compute_cost(_tour("2026-06-08"), _contract(), nb_tours=2, fuel_price=1.8, km_tax_total=20)
    assert c["t_fixe"] == 200          # 400/2
    assert c["t_km"] == 50             # 100*0.5
    assert c["gasoil"] == 54           # 100*0.3*1.8
    assert c["t_horaire"] == 20        # 2h*10
    assert c["ha"] == 50
    assert c["t_rem"] == 65
    assert c["prime_sam"] == "" and c["prime_dim"] == ""
    assert c["total_taxe"] == 20
    assert c["cout_tournee"] == 459    # 200+50+54+20+50+65+20


def test_cost_saturday():
    # 2026-06-13 = samedi
    c = compute_cost(_tour("2026-06-13"), _contract(), nb_tours=1, fuel_price=0, km_tax_total=0)
    assert c["prime_sam"] == 30
    assert c["prime_dim"] == ""


def test_cost_holiday():
    # 2026-07-21 = Fête nationale belge (férié), un mardi
    assert is_belgian_holiday(date(2026, 7, 21))
    c = compute_cost(_tour("2026-07-21"), _contract(), nb_tours=1, fuel_price=0, km_tax_total=0)
    assert c["prime_dim"] == 60
    assert c["prime_sam"] == ""


def test_holidays_easter_based():
    # Lundi de Pâques 2026 = 6 avril 2026
    assert is_belgian_holiday(date(2026, 4, 6))
    assert not is_belgian_holiday(date(2026, 4, 7))
