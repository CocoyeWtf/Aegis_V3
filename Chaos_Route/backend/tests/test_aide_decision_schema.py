"""Tests schémas Aide à la Décision / Decision support schema tests.

Régression : une durée totale calculée en float fractionnaire (ex. 133.08)
faisait planter SuggestedTour avec une ValidationError Pydantic (int_from_float),
provoquant un 500 sur /aide-decision/generate (niveaux 1 ET 2).
"""

from app.schemas.aide_decision import SuggestedStop, SuggestedTour


def test_total_duration_minutes_accepts_fractional_float():
    t = SuggestedTour(
        tour_number=1,
        total_eqp=10.0,
        total_weight_kg=1.0,
        total_km=5.0,
        total_cost=0.0,
        total_duration_minutes=133.07999999999998,
    )
    assert t.total_duration_minutes == 133
    assert isinstance(t.total_duration_minutes, int)


def test_total_duration_minutes_keeps_int():
    t = SuggestedTour(
        tour_number=1, total_eqp=1.0, total_weight_kg=1.0, total_km=1.0,
        total_cost=0.0, total_duration_minutes=120,
    )
    assert t.total_duration_minutes == 120


def test_stop_duration_accepts_fractional_float():
    s = SuggestedStop(
        sequence_order=1, pdv_id=1, pdv_code="X", pdv_name="Y",
        eqp_count=1.0, weight_kg=1.0, nb_colis=1, has_sas=False,
        distance_from_previous_km=2.0, duration_from_previous_minutes=12.6,
    )
    assert s.duration_from_previous_minutes == 13
    assert isinstance(s.duration_from_previous_minutes, int)
