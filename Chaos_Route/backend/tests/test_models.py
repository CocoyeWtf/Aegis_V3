"""Tests des modèles / Model tests."""

from app.models.country import Country
from app.models.pdv import PDVType
from app.models.vehicle import FleetVehicleType
from app.models.tour import TourStatus
from app.models.volume import TemperatureClass


def test_country_repr():
    c = Country(id=1, name="France", code="FR")
    assert "FR" in repr(c)


def test_enums():
    assert PDVType.HYPER.value == "HYPER"
    assert FleetVehicleType.SEMI.value == "SEMI"
    assert TourStatus.DRAFT.value == "DRAFT"
    assert TemperatureClass.GEL.value == "GEL"
