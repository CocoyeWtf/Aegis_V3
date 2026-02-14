"""Tests des modèles / Model tests."""

from app.models.country import Country
from app.models.base_logistics import BaseType
from app.models.pdv import PDVType
from app.models.vehicle import TemperatureType, VehicleType
from app.models.tour import TourStatus
from app.models.volume import TemperatureClass


def test_country_repr():
    c = Country(id=1, name="France", code="FR")
    assert "FR" in repr(c)


def test_enums():
    assert BaseType.SEC_RAPIDE.value == "SEC_RAPIDE"
    assert PDVType.HYPER.value == "HYPER"
    assert TemperatureType.BI_TEMP.value == "BI_TEMP"
    assert VehicleType.SEMI.value == "SEMI"
    assert TourStatus.DRAFT.value == "DRAFT"
    assert TemperatureClass.GEL.value == "GEL"
