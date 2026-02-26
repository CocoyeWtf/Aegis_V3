"""
Solveur OR-Tools CVRPTW / OR-Tools CVRPTW Solver.
Fichier isolé — prend des dataclasses en entrée, retourne des tours bruts.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field

from ortools.constraint_solver import pywrapcp, routing_enums_pb2

log = logging.getLogger(__name__)


# ── Dataclasses d'entrée/sortie ──────────────────────────────────────


@dataclass
class VehicleSlot:
    """Un slot véhicule (2 slots par contrat physique pour multi-trip)."""
    contract_idx: int               # index dans la liste contracts originale
    capacity_eqp: int
    fixed_cost_cents: int           # slot A = full, slot B = 0
    cost_per_km_cents: int
    compatible_nodes: set[int] = field(default_factory=set)  # nœuds dock/hayon compatibles


@dataclass
class ORToolsInput:
    """Données d'entrée pour le solveur / Solver input data."""
    num_pdvs: int                            # N PDVs (hors dépôt)
    pdv_ids: list[int]                       # index 0=depot, 1..N=PDVs
    demands: list[int]                       # EQP par nœud (0 pour depot)
    service_times: list[int]                 # minutes par nœud (0 pour depot)
    time_windows: list[tuple[int, int]]      # (earliest, deadline) en minutes
    distance_matrix: list[list[int]]         # mètres (entiers)
    time_matrix: list[list[int]]             # minutes (entiers)
    vehicles: list[VehicleSlot]
    time_limit_seconds: int = 30


@dataclass
class RawTour:
    """Tour brut retourné par le solveur / Raw tour from solver."""
    vehicle_slot: int               # index du slot dans vehicles
    contract_idx: int               # index contrat original
    node_sequence: list[int]        # indices nœuds (sans depot)
    total_distance_m: int


# ── Solveur principal ────────────────────────────────────────────────


def solve_cvrptw(data: ORToolsInput) -> tuple[list[RawTour], list[int]]:
    """Résoudre le CVRPTW avec OR-Tools / Solve CVRPTW with OR-Tools.
    Retourne (tours, dropped_node_indices).
    """
    num_nodes = data.num_pdvs + 1   # depot + PDVs
    num_vehicles = len(data.vehicles)

    if num_nodes <= 1 or num_vehicles == 0:
        return [], list(range(1, num_nodes))

    # 1. Manager & modèle / Manager & model
    manager = pywrapcp.RoutingIndexManager(num_nodes, num_vehicles, 0)
    routing = pywrapcp.RoutingModel(manager)

    # 2. Callback coût par véhicule / Cost callback per vehicle
    cost_callback_indices: list[int] = []
    for v_idx, slot in enumerate(data.vehicles):
        cost_per_km = slot.cost_per_km_cents  # centimes/km

        def _cost_cb(from_index: int, to_index: int, _cpm=cost_per_km) -> int:
            from_node = manager.IndexToNode(from_index)
            to_node = manager.IndexToNode(to_index)
            dist_m = data.distance_matrix[from_node][to_node]
            # coût = cost_per_km_cents × distance_km = cpm × dist_m / 1000
            return (_cpm * dist_m) // 1000

        cb_idx = routing.RegisterTransitCallback(_cost_cb)
        cost_callback_indices.append(cb_idx)
        routing.SetArcCostEvaluatorOfVehicle(cb_idx, v_idx)

    # 3. Coût fixe par véhicule / Fixed cost per vehicle
    for v_idx, slot in enumerate(data.vehicles):
        routing.SetFixedCostOfVehicle(slot.fixed_cost_cents, v_idx)

    # 4. Dimension Capacity / Capacity dimension
    def _demand_cb(from_index: int) -> int:
        node = manager.IndexToNode(from_index)
        return data.demands[node]

    demand_cb_idx = routing.RegisterUnaryTransitCallback(_demand_cb)
    vehicle_capacities = [slot.capacity_eqp for slot in data.vehicles]
    routing.AddDimensionWithVehicleCapacity(
        demand_cb_idx,
        0,                      # slack = 0
        vehicle_capacities,
        True,                   # start cumul à zéro
        "Capacity",
    )

    # 5. Dimension Time / Time dimension
    def _time_cb(from_index: int, to_index: int) -> int:
        from_node = manager.IndexToNode(from_index)
        to_node = manager.IndexToNode(to_index)
        travel = data.time_matrix[from_node][to_node]
        service = data.service_times[from_node]
        return travel + service

    time_cb_idx = routing.RegisterTransitCallback(_time_cb)
    routing.AddDimension(
        time_cb_idx,
        120,                    # slack max = 2h d'attente
        600,                    # max cumul = 10h
        False,                  # ne pas forcer start à 0 (le solver choisit)
        "Time",
    )
    time_dimension = routing.GetDimensionOrDie("Time")

    # 6. Time windows par nœud — souples / Soft time windows per node
    # Pénalité par minute de retard (soft upper bound) plutôt que hard constraint
    # Permet de placer les PDV même avec un léger retard, comme le fait le Niveau 1
    LATE_PENALTY_PER_MIN = 500  # centimes/min de retard
    for node in range(num_nodes):
        index = manager.NodeToIndex(node)
        tw_start, tw_end = data.time_windows[node]
        if node == 0:
            # Depot : hard constraint
            time_dimension.CumulVar(index).SetRange(tw_start, tw_end)
        else:
            # PDV : hard start, soft end (pénalité si retard)
            time_dimension.CumulVar(index).SetRange(tw_start, 600)
            time_dimension.SetCumulVarSoftUpperBound(
                index, tw_end, LATE_PENALTY_PER_MIN
            )

    # Contrainte sur le départ/retour du dépôt / Depot start/end constraint
    for v_idx in range(num_vehicles):
        start_index = routing.Start(v_idx)
        time_dimension.CumulVar(start_index).SetRange(0, 600)
        end_index = routing.End(v_idx)
        time_dimension.CumulVar(end_index).SetRange(0, 600)

    # 7. Incompatibilité dock/hayon / Dock/tailgate incompatibility
    for node in range(1, num_nodes):  # skip depot
        index = manager.NodeToIndex(node)
        incompatible_vehicles: list[int] = []
        for v_idx, slot in enumerate(data.vehicles):
            if node not in slot.compatible_nodes:
                incompatible_vehicles.append(v_idx)
        if incompatible_vehicles:
            routing.VehicleVar(index).RemoveValues(incompatible_vehicles)

    # 8. Disjunctions — permet de dropper des PDV impossibles / Allow dropping
    penalty = 1_000_000
    for node in range(1, num_nodes):
        index = manager.NodeToIndex(node)
        routing.AddDisjunction([index], penalty)

    # 9. Paramètres de recherche / Search parameters
    search_params = pywrapcp.DefaultRoutingSearchParameters()
    search_params.first_solution_strategy = (
        routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC
    )
    search_params.local_search_metaheuristic = (
        routing_enums_pb2.LocalSearchMetaheuristic.GUIDED_LOCAL_SEARCH
    )
    search_params.time_limit.seconds = data.time_limit_seconds

    # 10. Résoudre / Solve
    log.info(
        "OR-Tools: solving %d nodes, %d vehicles, time_limit=%ds...",
        num_nodes, num_vehicles, data.time_limit_seconds,
    )
    solution = routing.SolveWithParameters(search_params)
    log.info("OR-Tools: solver status = %s", routing.status())

    if not solution:
        log.warning("OR-Tools: no solution found (status=%s)", routing.status())
        return [], list(range(1, num_nodes))

    # 11. Extraire la solution / Extract solution
    tours: list[RawTour] = []
    visited_nodes: set[int] = set()

    for v_idx in range(num_vehicles):
        index = routing.Start(v_idx)
        route_nodes: list[int] = []
        route_distance = 0

        while not routing.IsEnd(index):
            node = manager.IndexToNode(index)
            if node != 0:  # skip depot
                route_nodes.append(node)
                visited_nodes.add(node)
            prev_index = index
            index = solution.Value(routing.NextVar(index))
            route_distance += routing.GetArcCostForVehicle(prev_index, index, v_idx)

        if route_nodes:
            # Recalculer la distance réelle en mètres (pas en coût)
            total_dist_m = 0
            prev_node = 0  # depot
            for n in route_nodes:
                total_dist_m += data.distance_matrix[prev_node][n]
                prev_node = n
            total_dist_m += data.distance_matrix[prev_node][0]  # retour depot

            slot = data.vehicles[v_idx]
            tours.append(RawTour(
                vehicle_slot=v_idx,
                contract_idx=slot.contract_idx,
                node_sequence=route_nodes,
                total_distance_m=total_dist_m,
            ))

    # Nœuds droppés / Dropped nodes
    dropped = [n for n in range(1, num_nodes) if n not in visited_nodes]

    return tours, dropped
