# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added
- Ordonnancement : export « Infolog (WMS) » (TMS_vers_wms) — génère le fichier
  Excel attendu par la macro d'encodage Infolog (une ligne par arrêt PDV, tours
  rangés par priorité ERT, PDV de chaque tour en ordre inverse, index global).
  Code transporteur configurable via le paramètre `wms_infolog_carrier_code`.
  Le code chauffeur Infolog (`code_infolog`) est figé sur le tour au moment de
  la planification (nouvelle colonne `tours.driver_code_infolog`).
- Project structure and documentation
- Backend skeleton: FastAPI + SQLAlchemy models + Alembic migrations
- Frontend skeleton: React + Vite + TypeScript + TailwindCSS + Shadcn/ui
- Internationalization setup (FR, EN, PT, NL)
- Dark/Light theme system
