"""
Service de calcul des temps / Time calculation service.
Calcule les temps de route, déchargement, mise à quai, etc.
"""


class TimeCalculatorService:
    """Calcul des temps de tournée / Tour time calculation."""

    @staticmethod
    def calculate_travel_time_minutes(distance_km: float, speed_kmh: float) -> int:
        """Temps de route en minutes / Travel time in minutes."""
        if speed_kmh <= 0:
            return 0
        return round((distance_km / speed_kmh) * 60)

    @staticmethod
    def calculate_stop_duration(
        dock_time_minutes: int,
        eqp_count: int,
        unload_time_per_eqp_minutes: int,
    ) -> int:
        """
        Durée totale d'un arrêt / Total stop duration.
        = temps de mise à quai + (nombre EQP * temps par EQP)
        """
        return dock_time_minutes + (eqp_count * unload_time_per_eqp_minutes)

    @staticmethod
    def add_minutes_to_time(time_str: str, minutes: int) -> str:
        """
        Ajouter des minutes à un horaire HH:MM / Add minutes to a HH:MM time string.
        Retourne le nouvel horaire au format HH:MM.
        """
        hours, mins = map(int, time_str.split(":"))
        total_minutes = hours * 60 + mins + minutes
        new_hours = (total_minutes // 60) % 24
        new_mins = total_minutes % 60
        return f"{new_hours:02d}:{new_mins:02d}"
