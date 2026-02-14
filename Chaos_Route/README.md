# Chaos RouteManager

Optimiseur de tournées (VRP) pour la grande distribution agro-alimentaire.
Vehicle Routing Problem optimizer for large-scale food retail distribution.

## Architecture

- **Backend**: Python 3.12 + FastAPI + SQLAlchemy 2.0
- **Frontend**: React 18 + TypeScript + Vite + TailwindCSS + Shadcn/ui
- **Database**: SQLite (dev) / PostgreSQL 16 + PostGIS (prod)
- **Map**: Leaflet + React-Leaflet (OpenStreetMap)
- **Optimization**: Google OR-Tools (Mode 2+)

## Quick Start

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload
```

API docs: http://localhost:8000/docs

### Frontend

```bash
cd frontend
npm install
npm run dev
```

App: http://localhost:5173

## Modes

| Mode | Nom | Description |
|------|-----|-------------|
| 1 | Chaos Builder | Construction manuelle de tournées (drag & drop) |
| 1bis | Chaos Liner | Tracé de tournées sur carte (clic) |
| 2 | OR-Tools | Optimisation automatique (Google OR-Tools) |
| 3-5 | Avancé | Planification multi-jours, temps réel, ML |

## License

Proprietary - All rights reserved.
