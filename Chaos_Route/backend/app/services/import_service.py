"""
Service d'import CSV/Excel / CSV/Excel import service.
Parse les fichiers et retourne des listes de dictionnaires.
"""

import csv
import io
from typing import Any

from openpyxl import load_workbook


class ImportService:
    """Import de données depuis fichiers / Data import from files."""

    @staticmethod
    def parse_csv(content: bytes) -> list[dict[str, Any]]:
        """Parser un fichier CSV / Parse a CSV file."""
        text = content.decode("utf-8-sig")  # BOM-safe
        reader = csv.DictReader(io.StringIO(text), delimiter=";")
        # Essayer aussi avec la virgule / Try comma delimiter too
        rows = list(reader)
        if not rows or len(rows[0]) <= 1:
            reader = csv.DictReader(io.StringIO(text), delimiter=",")
            rows = list(reader)
        return rows

    @staticmethod
    def parse_excel(content: bytes) -> list[dict[str, Any]]:
        """Parser un fichier Excel / Parse an Excel file."""
        wb = load_workbook(filename=io.BytesIO(content), read_only=True)
        ws = wb.active
        if ws is None:
            return []

        rows_iter = ws.iter_rows(values_only=True)
        headers = next(rows_iter, None)
        if not headers:
            return []

        # Nettoyer les en-têtes / Clean headers
        clean_headers = [str(h).strip().lower().replace(" ", "_") if h else f"col_{i}" for i, h in enumerate(headers)]

        result = []
        for row in rows_iter:
            record = {}
            for key, val in zip(clean_headers, row):
                record[key] = val
            if any(v is not None for v in record.values()):
                result.append(record)

        wb.close()
        return result

    @staticmethod
    def parse_file(content: bytes, filename: str) -> list[dict[str, Any]]:
        """Parser un fichier selon son extension / Parse file based on extension."""
        ext = filename.rsplit(".", 1)[-1].lower()
        if ext == "csv":
            return ImportService.parse_csv(content)
        elif ext in ("xlsx", "xls"):
            return ImportService.parse_excel(content)
        raise ValueError(f"Unsupported file type: {ext}")

    # Mapping des champs attendus par entité / Expected field mapping per entity
    ENTITY_FIELDS: dict[str, list[str]] = {
        "countries": ["name", "code"],
        "regions": ["name", "country_id"],
        "bases": ["code", "name", "type", "address", "postal_code", "city", "phone", "email", "latitude", "longitude", "region_id"],
        "pdvs": ["code", "name", "type", "address", "postal_code", "city", "phone", "email", "latitude", "longitude",
                 "has_sas", "sas_capacity", "has_dock", "dock_time_minutes", "unload_time_per_eqp_minutes",
                 "delivery_window_start", "delivery_window_end", "access_constraints", "region_id"],
        "vehicles": ["code", "name", "temperature_type", "vehicle_type", "capacity_eqp", "capacity_weight_kg",
                      "fixed_cost", "cost_per_km", "has_tailgate", "tailgate_type", "contract_start_date", "contract_end_date", "region_id"],
        "suppliers": ["code", "name", "address", "postal_code", "city", "phone", "email", "latitude", "longitude", "region_id"],
        "volumes": ["pdv_id", "date", "eqp_count", "weight_kg", "temperature_class", "base_origin_id", "preparation_start", "preparation_end"],
        "contracts": ["code", "transporter_name", "fixed_daily_cost", "cost_per_km", "cost_per_hour",
                       "min_hours_per_day", "min_km_per_day", "start_date", "end_date", "region_id"],
        "distances": ["origin_type", "origin_id", "destination_type", "destination_id", "distance_km", "duration_minutes"],
    }
