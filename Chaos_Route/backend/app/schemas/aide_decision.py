"""
Schémas Aide à la Décision / Decision Support schemas.
Simulation pure — aucun impact sur les données.
"""

from pydantic import BaseModel


class AideDecisionRequest(BaseModel):
    """Paramètres d'entrée / Input parameters."""
    dispatch_date: str          # YYYY-MM-DD
    base_origin_id: int
    temperature_class: str      # SEC | FRAIS | GEL
    level: int = 1              # 1 = heuristique, 2 = OR-Tools
    time_limit_seconds: int = 30  # limite de recherche OR-Tools (level 2)


class SuggestedStop(BaseModel):
    """Un arrêt suggéré dans un tour / A suggested stop in a tour."""
    sequence_order: int
    pdv_id: int
    pdv_code: str
    pdv_name: str
    pdv_city: str | None = None
    eqp_count: int
    weight_kg: float
    nb_colis: int
    has_sas: bool
    arrival_time: str | None = None      # HH:MM
    departure_time: str | None = None    # HH:MM
    distance_from_previous_km: float
    duration_from_previous_minutes: int
    deadline: str | None = None          # HH:MM
    warnings: list[str] = []


class SuggestedContract(BaseModel):
    """Contrat sélectionné pour un tour / Selected contract for a tour."""
    contract_id: int
    contract_code: str
    transporter_name: str
    vehicle_code: str | None = None
    vehicle_name: str | None = None
    vehicle_type: str | None = None
    temperature_type: str | None = None
    capacity_eqp: int
    has_tailgate: bool = False
    tailgate_type: str | None = None
    score: float
    fill_rate_pct: float


class SuggestedTour(BaseModel):
    """Un tour suggéré / A suggested tour."""
    tour_number: int
    contract: SuggestedContract | None = None
    stops: list[SuggestedStop] = []
    total_eqp: int
    total_weight_kg: float
    total_km: float
    total_cost: float
    departure_time: str | None = None    # HH:MM
    return_time: str | None = None       # HH:MM
    total_duration_minutes: int
    warnings: list[str] = []


class UnassignedPDV(BaseModel):
    """PDV non placé / Unassigned PDV."""
    pdv_id: int
    pdv_code: str
    pdv_name: str
    pdv_city: str | None = None
    eqp_count: int
    reason: str


class AideDecisionSummary(BaseModel):
    """Résumé global / Global summary."""
    total_tours: int
    total_eqp: int
    total_weight_kg: float
    total_km: float
    total_cost: float
    avg_fill_rate_pct: float


class AideDecisionResponse(BaseModel):
    """Réponse complète / Complete response."""
    dispatch_date: str
    base_origin_id: int
    base_name: str
    temperature_class: str
    tours: list[SuggestedTour] = []
    unassigned_pdvs: list[UnassignedPDV] = []
    summary: AideDecisionSummary
    warnings: list[str] = []
