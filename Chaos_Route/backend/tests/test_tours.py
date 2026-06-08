"""Tests schemas Tour / Tour schema tests.

Garde-fou de regression : total_eqp doit accepter une valeur fractionnaire
(somme d'eqp_count en numeric pour les volumes injectes). Avant correctif,
total_eqp etait `int` et un total fractionnaire renvoyait un 422 affiche
"[object Object]" cote frontend.
"""

from app.schemas.tour import TourCreate


def _payload(total_eqp):
    return dict(
        date="2026-06-08", code="T-TEST", vehicle_type="SEMI",
        capacity_eqp=33, base_id=1, status="DRAFT",
        total_eqp=total_eqp, total_km=12.3, is_pickup_tour=False,
        stops=[dict(pdv_id=1, sequence_order=1, eqp_count=2.5)],
    )


def test_total_eqp_accepts_fractional():
    """Volumes injectes -> EQP total fractionnaire accepte."""
    tour = TourCreate(**_payload(45.5))
    assert tour.total_eqp == 45.5


def test_total_eqp_accepts_integer():
    tour = TourCreate(**_payload(45))
    assert tour.total_eqp == 45
