"""Tests détection de chevauchement de tours / Tour overlap detection tests.

Régression : deux tours d'une même répartition mais livrés des JOURS DIFFÉRENTS
ne doivent pas être considérés comme chevauchants, même à heures de journée
proches (bug "overlap" entre un tour livré le 04/06 09:00-15:53 et un tour livré
le 05/06 05:00).
"""

from app.api.tours import tours_time_overlap


def test_no_overlap_different_delivery_days():
    """Cas remonté : 04/06 09:00-15:53 vs 05/06 05:00-11:00 → PAS de chevauchement."""
    assert tours_time_overlap(
        "2026-06-04", "09:00", "15:53",
        "2026-06-05", "05:00", "11:00",
    ) is False


def test_overlap_same_day():
    """Même jour, plages qui se recoupent → chevauchement."""
    assert tours_time_overlap(
        "2026-06-04", "09:00", "15:53",
        "2026-06-04", "05:00", "11:00",
    ) is True


def test_no_overlap_same_day_disjoint():
    """Même jour, plages disjointes → pas de chevauchement."""
    assert tours_time_overlap(
        "2026-06-04", "05:00", "08:30",
        "2026-06-04", "09:00", "15:53",
    ) is False


def test_overlap_midnight_crossover_same_run():
    """Tour qui passe minuit (retour <= départ) chevauche le tour suivant tôt le
    lendemain sur la même ressource."""
    # Tour A livré le 04/06 22:00 → retour 03:00 (le 05/06)
    # Tour B livré le 05/06 02:00 → 06:00 : chevauchent dans la nuit
    assert tours_time_overlap(
        "2026-06-04", "22:00", "03:00",
        "2026-06-05", "02:00", "06:00",
    ) is True


def test_no_overlap_midnight_crossover_clear():
    """Tour passant minuit mais terminé avant le départ du tour du lendemain."""
    # A : 04/06 22:00 → 01:00 (le 05/06) ; B : 05/06 05:00 → 09:00
    assert tours_time_overlap(
        "2026-06-04", "22:00", "01:00",
        "2026-06-05", "05:00", "09:00",
    ) is False


def test_overlap_falls_back_to_same_day_when_no_date():
    """Sans date (None), comparaison purement horaire (rétro-compat)."""
    assert tours_time_overlap(
        None, "09:00", "15:53",
        None, "05:00", "11:00",
    ) is True
