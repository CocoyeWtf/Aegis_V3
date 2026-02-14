"""
Service de calcul des coûts / Cost calculation service.
Calcule le coût d'un tour basé sur le contrat transporteur.
"""

from decimal import Decimal


class CostCalculatorService:
    """Calcul des coûts de tournée / Tour cost calculation."""

    @staticmethod
    def calculate_tour_cost(
        total_km: float,
        fixed_daily_cost: float,
        cost_per_km: float,
        cost_per_hour: float | None = None,
        total_hours: float | None = None,
    ) -> float:
        """
        Calculer le coût d'un tour / Calculate tour cost.
        Règle: 1 terme fixe par jour par transporteur (même si multi-tours).
        Rule: 1 fixed cost per day per transporter (even if multi-tours).
        """
        cost = fixed_daily_cost + (total_km * cost_per_km)
        if cost_per_hour and total_hours:
            cost += total_hours * cost_per_hour
        return round(cost, 2)
