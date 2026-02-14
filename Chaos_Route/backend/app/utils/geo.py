"""Utilitaires géographiques / Geographic utilities."""

import math


def haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Distance Haversine en km / Haversine distance in km."""
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def bounding_box(lat: float, lon: float, radius_km: float) -> tuple[float, float, float, float]:
    """
    Boîte englobante autour d'un point / Bounding box around a point.
    Retourne (lat_min, lat_max, lon_min, lon_max).
    """
    delta_lat = radius_km / 111.0
    delta_lon = radius_km / (111.0 * math.cos(math.radians(lat)))
    return (lat - delta_lat, lat + delta_lat, lon - delta_lon, lon + delta_lon)
