"""
Service de calcul des distances / Distance calculation service.
Utilise le distancier ou les coordonnées lat/lon.
"""

import math


class DistanceService:
    """Service de distances / Distance service."""

    @staticmethod
    def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        """
        Calcul de distance à vol d'oiseau (Haversine) / Haversine distance calculation.
        Retourne la distance en km.
        """
        R = 6371.0  # rayon de la Terre en km / Earth radius in km
        dlat = math.radians(lat2 - lat1)
        dlon = math.radians(lon2 - lon1)
        a = (
            math.sin(dlat / 2) ** 2
            + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
        )
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        return round(R * c, 2)

    @staticmethod
    def estimate_road_distance(haversine_km: float, factor: float = 1.3) -> float:
        """
        Estimation de la distance routière / Estimate road distance.
        Facteur multiplicateur par défaut: 1.3 (routes sinueuses).
        """
        return round(haversine_km * factor, 2)
