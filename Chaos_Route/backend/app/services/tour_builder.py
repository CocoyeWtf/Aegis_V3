"""
Service de construction manuelle de tours (Mode 1) / Manual tour builder service.
Logique métier pour le drag & drop et la validation des tours.
"""


class TourBuilderService:
    """Service pour construire et valider des tours manuellement / Manual tour building service."""

    @staticmethod
    def validate_capacity(current_eqp: int, added_eqp: int, vehicle_capacity: int) -> bool:
        """Vérifier si le véhicule peut accueillir les EQP supplémentaires / Check if vehicle can fit more EQP."""
        return (current_eqp + added_eqp) <= vehicle_capacity

    @staticmethod
    def suggest_split(remaining_eqp: int, vehicle_capacity: int, current_eqp: int) -> int:
        """Proposer un fractionnement si dépassement / Suggest split amount if over capacity."""
        available = vehicle_capacity - current_eqp
        return min(remaining_eqp, available)
