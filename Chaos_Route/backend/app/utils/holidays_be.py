"""Jours fériés légaux belges / Belgian public holidays.

Sert au calcul des primes dimanche/férié de la pré-facturation transporteur.
Inclut les fériés fixes + ceux basés sur Pâques (calcul de Butcher/Meeus).
"""

from datetime import date, timedelta
from functools import lru_cache


def _easter_sunday(year: int) -> date:
    """Dimanche de Pâques (algorithme de Butcher, grégorien)."""
    a = year % 19
    b, c = divmod(year, 100)
    d, e = divmod(b, 4)
    f = (b + 8) // 25
    g = (b - f + 1) // 3
    h = (19 * a + b - d - g + 15) % 30
    i, k = divmod(c, 4)
    l = (32 + 2 * e + 2 * i - h - k) % 7
    m = (a + 11 * h + 22 * l) // 451
    month = (h + l - 7 * m + 114) // 31
    day = ((h + l - 7 * m + 114) % 31) + 1
    return date(year, month, day)


@lru_cache(maxsize=32)
def belgian_holidays(year: int) -> frozenset[date]:
    """Ensemble des jours fériés légaux belges pour l'année / Belgian legal holidays for the year."""
    easter = _easter_sunday(year)
    days = {
        date(year, 1, 1),    # Nouvel An
        easter + timedelta(days=1),   # Lundi de Pâques
        date(year, 5, 1),    # Fête du Travail
        easter + timedelta(days=39),  # Ascension
        easter + timedelta(days=50),  # Lundi de Pentecôte
        date(year, 7, 21),   # Fête nationale
        date(year, 8, 15),   # Assomption
        date(year, 11, 1),   # Toussaint
        date(year, 11, 11),  # Armistice
        date(year, 12, 25),  # Noël
    }
    return frozenset(days)


def is_belgian_holiday(d: date) -> bool:
    return d in belgian_holidays(d.year)
