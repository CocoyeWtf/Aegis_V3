# Architecture - Chaos RouteManager

## Vue d'ensemble / Overview

Le système suit une architecture client-serveur classique avec séparation nette frontend/backend.
The system follows a classic client-server architecture with clean frontend/backend separation.

```
┌─────────────────┐     HTTP/JSON      ┌─────────────────┐     SQL      ┌──────────┐
│   React SPA     │ ◄──────────────► │   FastAPI       │ ◄──────────► │ Database │
│   (Vite/TS)     │     REST API       │   (Python)      │  SQLAlchemy  │ SQLite/PG│
└─────────────────┘                    └─────────────────┘              └──────────┘
```

## Backend

### Couches / Layers

1. **API Layer** (`app/api/`) - Routes FastAPI, validation entrée/sortie via Pydantic
2. **Service Layer** (`app/services/`) - Logique métier (calculs, import/export, KPI)
3. **Model Layer** (`app/models/`) - Modèles SQLAlchemy, ORM
4. **Schema Layer** (`app/schemas/`) - Schémas Pydantic pour validation et sérialisation

### Entités principales / Main Entities

- **Country/Region** - Organisation géographique hiérarchique
- **BaseLogistics** - Bases d'expédition (entrepôts)
- **PDV** - Points de Vente (magasins à livrer)
- **Vehicle** - Moyens de transport avec capacités et contraintes
- **Volume** - Commandes/volumes à livrer par PDV
- **Tour/TourStop** - Tournées planifiées et leurs arrêts
- **Contract** - Contrats transporteurs avec grilles tarifaires
- **DistanceMatrix** - Distancier (distances/durées entre points)
- **Parameter** - Paramètres système configurables par région

## Frontend

### Stack

- React 18 + TypeScript (strict mode)
- Vite (build tool)
- TailwindCSS + Shadcn/ui (composants)
- Zustand (state management)
- React Router (navigation)
- React-Leaflet (cartographie)
- @dnd-kit (drag & drop)
- react-i18next (internationalisation FR/EN/PT/NL)
- Recharts (graphiques KPI)

### Thème / Theme

- **Dark mode** (défaut) : fond noir/gris foncé, accents orange/rouge
- **Light mode** : fond clair, sans bleu
- Police monospace pour les données, sans-serif pour l'interface

## Base de données / Database

- **Développement** : SQLite (zéro configuration)
- **Production** : PostgreSQL 16 + PostGIS (requêtes géospatiales)
- Migration transparente via SQLAlchemy + Alembic
