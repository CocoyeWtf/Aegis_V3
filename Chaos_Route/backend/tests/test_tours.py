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


def test_tour_type_field():
    """Nature de tour portée par les schémas (défaut LIVRAISON)."""
    from app.models.tour import TourType

    assert TourCreate(**_payload(10)).tour_type == TourType.LIVRAISON
    t = TourCreate(**{**_payload(10), "tour_type": "GARAGE", "destination": "Garage X"})
    assert t.tour_type == TourType.GARAGE
    assert t.destination == "Garage X"


def test_priority_field():
    """Priorité manuelle d'ordonnancement portée par les schémas Tour."""
    from app.schemas.tour import TourSchedule

    sched = TourSchedule(contract_id=1, departure_time="10:00", priority=3)
    assert sched.priority == 3
    # Optionnelle : absente -> None
    assert TourSchedule(contract_id=1, departure_time="10:00").priority is None
    assert TourCreate(**_payload(10)).priority is None
