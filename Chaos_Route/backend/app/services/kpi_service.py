"""
Service de calcul des KPI / KPI calculation service.
"""


class KpiService:
    """Calcul des indicateurs de performance / KPI calculation."""

    @staticmethod
    def fill_rate(total_eqp: int, vehicle_capacity: int) -> float:
        """Taux de remplissage / Fill rate (%)."""
        if vehicle_capacity <= 0:
            return 0.0
        return round((total_eqp / vehicle_capacity) * 100, 1)

    @staticmethod
    def cost_per_eqp(total_cost: float, total_eqp: int) -> float:
        """Coût par EQC / Cost per EQC (nom hérité)."""
        if total_eqp <= 0:
            return 0.0
        return round(total_cost / total_eqp, 2)

    @staticmethod
    def km_per_eqp(total_km: float, total_eqp: int) -> float:
        """Km par EQC / Km per EQC (nom hérité)."""
        if total_eqp <= 0:
            return 0.0
        return round(total_km / total_eqp, 2)

    @staticmethod
    def estimate_co2_kg(total_km: float, factor_kg_per_km: float = 0.9) -> float:
        """
        Estimation CO2 en kg / Estimated CO2 in kg.
        Facteur par défaut: 0.9 kg/km pour un poids lourd.
        """
        return round(total_km * factor_kg_per_km, 1)
