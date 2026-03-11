# Cahier Technique - Chaos RouteManager (CMRO)

**Version** : 1.0 (V1 Production)
**Date** : 11 mars 2026
**Projet** : Optimiseur VRP pour la distribution alimentaire retail
**Repository** : `https://github.com/CocoyeWtf/Aegis_V3.git`

---

## Table des matieres

1. [Vue d'ensemble](#1-vue-densemble)
2. [Stack technique](#2-stack-technique)
3. [Architecture applicative](#3-architecture-applicative)
4. [Backend - API & Services](#4-backend---api--services)
5. [Modele de donnees](#5-modele-de-donnees)
6. [Authentification & RBAC](#6-authentification--rbac)
7. [Frontend - Application Web](#7-frontend---application-web)
8. [Application Mobile (CMRO Driver)](#8-application-mobile-cmro-driver)
9. [Infrastructure & Deploiement](#9-infrastructure--deploiement)
10. [Securite](#10-securite)
11. [Conventions de developpement](#11-conventions-de-developpement)
12. [Procedures operationnelles](#12-procedures-operationnelles)
13. [Annexes](#13-annexes)

---

## 1. Vue d'ensemble

### 1.1 Objectif

Chaos RouteManager (CMRO) est un systeme de gestion de tournees de livraison pour la grande distribution alimentaire. Il couvre l'ensemble du cycle operationnel :

- **Planification** : Construction de tournees optimisees (VRP) avec contraintes de capacite, fenetres de livraison, types de temperature
- **Operations** : Suivi en temps reel des chauffeurs (GPS/WebSocket), gestion du poste de garde, chargement
- **Flotte** : Gestion du parc vehicules (TCO, maintenance, inspections, carburant)
- **Logistique retour** : Gestion des consignes, demandes d'enlevement, etiquetage
- **Conformite** : Lettres de voiture CMR (Convention de Geneve 1956), archivage immutable
- **Reporting** : KPI operationnels, rapports par chauffeur/PDV/vehicule

### 1.2 Utilisateurs cibles

| Profil | Volume | Usage |
|--------|--------|-------|
| Planificateurs transport | ~10 | Construction tournees, affectation vehicules |
| Responsables operations | ~10 | Supervision temps reel, poste de garde |
| Gestionnaires flotte | ~5 | Maintenance, inspections, couts |
| Administrateurs | ~5 | Gestion utilisateurs, roles, parametrage |
| Chauffeurs (mobile) | ~200 | App mobile : tournee du jour, scan, GPS |

### 1.3 Perimetre fonctionnel (V1)

| Phase | Module | Statut |
|-------|--------|--------|
| 1 | Infrastructure, CRUD de base | Production |
| 2 | Cartographie, construction tournees | Production |
| 3 | Optimisation VRP (OR-Tools) | Production |
| 4 | Authentification, RBAC, multi-region | Production |
| 5 | Operations, poste de garde, suivi temps reel | Production |
| 6 | Flotte, inspections, CMR, consignes | Production |

---

## 2. Stack technique

### 2.1 Backend

| Composant | Technologie | Version |
|-----------|------------|---------|
| Langage | Python | 3.14 |
| Framework API | FastAPI | >= 0.115 |
| Serveur ASGI | Uvicorn (standard) | >= 0.34 |
| ORM | SQLAlchemy 2.0 (async) | >= 2.0 |
| Migrations | Alembic | >= 1.14 |
| BDD dev | SQLite + aiosqlite | >= 0.20 |
| BDD prod | PostgreSQL 16 + asyncpg | >= 0.30 |
| Validation | Pydantic v2 | >= 2.10 |
| Auth JWT | python-jose + bcrypt | >= 3.3 / >= 4.0 |
| Rate limiting | slowapi | >= 0.1.9 |
| Optimisation VRP | Google OR-Tools | >= 9.15 |
| Excel I/O | openpyxl + xlrd | >= 3.1 / >= 2.0 |
| Tests | pytest + pytest-asyncio + httpx | |

> **Note** : bcrypt est utilise directement (PAS passlib, incompatible Python 3.14).

### 2.2 Frontend Web

| Composant | Technologie | Version |
|-----------|------------|---------|
| Framework | React + TypeScript | 19.2 / 5.9 |
| Build | Vite | 7.3 |
| CSS | TailwindCSS v4 (@tailwindcss/vite) | 4.1 |
| Routing | React Router DOM | 7.13 |
| State | Zustand (persist) | 5.0 |
| Cartographie | Leaflet + react-leaflet | 1.9 / 5.0 |
| Graphiques | Recharts | 3.7 |
| Drag & Drop | @dnd-kit | core + sortable |
| i18n | i18next + react-i18next | 25.8 / 16.5 |
| HTTP | Axios (interceptors JWT) | 1.13 |
| Excel | XLSX (SheetJS) | 0.18 |
| Codes-barres | jsbarcode + qrcode.react | |
| Panels | react-resizable-panels | 4.6 |

### 2.3 Application Mobile

| Composant | Technologie | Version |
|-----------|------------|---------|
| Framework | Expo / React Native | SDK 54 / RN 0.81 |
| Routing | expo-router | ~6.0 |
| State | Zustand | |
| HTTP | Axios | |
| GPS | expo-location (foreground + background) | |
| Camera | expo-camera (scan QR) | |
| Photos | expo-image-picker | |
| Stockage securise | expo-secure-store | |
| Build cloud | EAS Build | CLI >= 15 |

### 2.4 Infrastructure

| Composant | Technologie |
|-----------|------------|
| Conteneurisation | Docker (multi-stage) |
| Orchestration | docker-compose |
| Reverse proxy / TLS | Caddy 2 (Let's Encrypt auto) |
| Hebergement | Hostinger VPS |
| CI/CD | Manuel (deploy.sh via SSH) |

---

## 3. Architecture applicative

### 3.1 Vue globale

```
                         +------------------+
                         |   Caddy (HTTPS)  |
                         |   Port 80/443    |
                         +--------+---------+
                                  |
                         +--------v---------+
                         |   FastAPI App    |
                         |   Port 8000     |
                         |  (API + SPA)    |
                         +---+----+----+---+
                             |    |    |
                    +--------+    |    +--------+
                    |             |             |
              +-----v-----+ +----v----+ +------v------+
              | PostgreSQL | | SQLite  | | Filesystem  |
              | (prod)     | | (dev)   | | (photos,    |
              +------------+ +---------+ |  APK, data) |
                                         +-------------+

  Clients:
  +----------------+     +------------------+     +------------------+
  | Browser (SPA)  |     | Mobile (Expo)    |     | WebSocket        |
  | React/Vite     |     | CMRO Driver      |     | Tracking GPS     |
  +----------------+     +------------------+     +------------------+
```

### 3.2 Architecture backend (couches)

```
backend/app/
+-- main.py                  # Point d'entree FastAPI, middleware, lifespan
+-- config.py                # Settings (pydantic-settings, .env)
+-- database.py              # Engine async, session, init_db, auto-migration
+-- rate_limit.py            # Configuration slowapi
+-- api/                     # 41 fichiers de routes (routers FastAPI)
|   +-- auth.py              # Login, refresh, /me
|   +-- tours.py             # 22 endpoints cycle de vie tournee
|   +-- driver.py            # 18 endpoints mobile chauffeur
|   +-- fleet.py             # 22 endpoints gestion flotte
|   +-- ...                  # (detail section 4)
+-- models/                  # 41 modeles SQLAlchemy
+-- schemas/                 # Schemas Pydantic (request/response)
+-- services/                # 10 services metier
+-- utils/
    +-- auth.py              # JWT, bcrypt, RESOURCES list
    +-- seed.py              # Seed superadmin
    +-- seed_inspection_templates.py
```

### 3.3 Architecture frontend

```
frontend/src/
+-- main.tsx                 # Point d'entree React
+-- App.tsx                  # Router + ProtectedRoute + lazy loading
+-- index.css                # Tailwind + CSS variables theme
+-- i18n.ts                  # Configuration i18next
+-- pages/                   # 43 pages (lazy-loaded)
+-- components/
|   +-- layout/              # MainLayout, Header, Sidebar
|   +-- data/                # CrudPage, DataTable, FormDialog (generiques)
|   +-- map/                 # MapView, markers, polylines, filtres
|   +-- tour/                # TourBuilder, TourScheduler, VolumePanel...
|   +-- kpi/                 # KpiDashboard, PunctualityKpi, SurchargesKpi
|   +-- tracking/            # Suivi temps reel
|   +-- operations/          # Gantt operations
|   +-- pickup/              # Impression etiquettes
|   +-- print/               # Badges chauffeur, QR vehicule
|   +-- admin/               # PermissionMatrix
|   +-- auth/                # ProtectedRoute, DefaultRedirect
+-- stores/                  # 4 stores Zustand
+-- services/                # api.ts (Axios), websocket.ts
+-- hooks/                   # useApi, useTour, useDetachedMap
+-- types/                   # index.ts (953 lignes, tous les types)
+-- utils/                   # getDefaultRoute, tourTimeUtils, temperatureUtils
```

---

## 4. Backend - API & Services

### 4.1 Catalogue des endpoints (245+)

#### Authentification & Utilisateurs

| Methode | Route | Description | Auth |
|---------|-------|-------------|------|
| POST | `/api/auth/login` | Connexion (username/password) | Non (rate limit 5/min) |
| POST | `/api/auth/refresh` | Rafraichir les tokens | Non |
| GET | `/api/auth/me` | Profil utilisateur + permissions | Oui |
| CRUD | `/api/users/` | Gestion des utilisateurs | `users:*` |
| CRUD | `/api/roles/` | Gestion des roles + permissions | `roles:*` |

#### Donnees de reference

| Methode | Route | Description | Permission |
|---------|-------|-------------|------------|
| CRUD | `/api/countries/` | Pays | `countries:*` |
| CRUD | `/api/regions/` | Regions (scope utilisateur) | `countries:*` |
| CRUD | `/api/bases/` | Bases logistiques (entrepots) | `bases:*` |
| CRUD | `/api/base-activities/` | Types d'activite de base | `base-activities:*` |
| CRUD | `/api/pdvs/` | Points de vente | `pdvs:*` |
| CRUD | `/api/suppliers/` | Fournisseurs | `suppliers:*` |
| CRUD | `/api/carriers/` | Transporteurs | `carriers:*` |
| CRUD | `/api/contracts/` | Contrats transporteurs + planning | `contracts:*` |
| CRUD | `/api/loaders/` | Chargeurs | `loaders:*` |
| CRUD | `/api/support-types/` | Types de support consigne | `support-types:*` |
| CRUD | `/api/surcharge-types/` | Types de supplements | `surcharge-types:*` |

#### Parametrage & Matrices

| Methode | Route | Description | Permission |
|---------|-------|-------------|------------|
| CRUD | `/api/parameters/` | Parametres systeme (par region) | `parameters:*` |
| CRUD | `/api/distance-matrix/` | Matrice des distances | `distances:*` |
| CRUD | `/api/km-tax/` | Taxe kilometrique | `distances:*` |
| CRUD | `/api/fuel-prices/` | Prix du carburant | `parameters:*` |

#### Tournees (cycle de vie complet)

| Methode | Route | Description | Permission |
|---------|-------|-------------|------------|
| GET | `/api/tours/` | Liste des tournees (filtre region) | `tour-planning:read` |
| POST | `/api/tours/` | Creer une tournee | `tour-planning:create` |
| PUT | `/api/tours/{id}` | Modifier une tournee | `tour-planning:update` |
| DELETE | `/api/tours/{id}` | Supprimer une tournee | `tour-planning:delete` |
| PUT | `/api/tours/{id}/validate` | Valider (verrouiller) | `tour-planning:update` |
| POST | `/api/tours/validate-batch` | Validation en masse | `tour-planning:update` |
| PUT | `/api/tours/{id}/operations` | Champs operationnels (chauffeur, heures, km) | `operations:update` |
| PUT | `/api/tours/{id}/gate` | Champs poste de garde (chargeur, remorque, quai) | `guard-post:update` |
| GET | `/api/tours/{id}/cost-breakdown` | Ventilation des couts | `tour-planning:read` |
| GET | `/api/tours/{id}/waybill` | Generer/consulter CMR | `waybill-archives:read` |
| GET | `/api/tours/{id}/timeline` | Timeline evenements | `tour-planning:read` |

#### Volumes & Import/Export

| Methode | Route | Description | Permission |
|---------|-------|-------------|------------|
| CRUD | `/api/volumes/` | Volumes (commandes PDV) | `volumes:*` |
| POST | `/api/imports/volumes` | Import volumes (Excel SUPERLOG) | `imports-exports:create` |
| POST | `/api/imports/distances` | Import matrice distances | `imports-exports:create` |
| POST | `/api/imports/km-tax` | Import taxe km | `imports-exports:create` |
| GET | `/api/exports/{entity}` | Export Excel/CSV | `imports-exports:read` |

#### Mobile / Chauffeur (18 endpoints)

| Methode | Route | Description | Auth |
|---------|-------|-------------|------|
| GET | `/api/driver/tours/current` | Tournee du jour (par device) | X-Device-ID |
| PUT | `/api/driver/tours/{id}/stops/{sid}` | MAJ statut arret | X-Device-ID |
| POST | `/api/driver/inspections/` | Soumettre inspection vehicule | X-Device-ID |
| POST | `/api/driver/declarations/` | Declarer incident + photos | X-Device-ID |
| GET | `/api/driver/tours/{id}/alerts` | Alertes livraison | X-Device-ID |

#### Tracking temps reel

| Methode | Route | Description |
|---------|-------|-------------|
| POST | `/api/tracking/gps` | Envoyer position GPS (rate limit 30/min) |
| WS | `/ws/tracking` | WebSocket suivi temps reel |

#### Flotte vehicules (22 endpoints)

| Methode | Route | Description | Permission |
|---------|-------|-------------|------------|
| CRUD | `/api/vehicles/` | Vehicules (+ QR code) | `vehicles:*` |
| CRUD | `/api/fleet/maintenance/` | Maintenance | `fleet:*` |
| CRUD | `/api/fleet/fuel/` | Carburant | `fleet:*` |
| CRUD | `/api/fleet/costs/` | Couts divers | `fleet:*` |
| CRUD | `/api/fleet/modifications/` | Modifications vehicule | `fleet:*` |
| CRUD | `/api/inspections/` | Inspections + photos | `inspections:*` |

#### Logistique retour

| Methode | Route | Description | Permission |
|---------|-------|-------------|------------|
| CRUD | `/api/pickup-requests/` | Demandes d'enlevement + etiquettes | `pickup-requests:*` |
| CRUD | `/api/consignments/` | Mouvements consigne (import Zebre) | `consignment-movements:*` |
| CRUD | `/api/surcharges/` | Supplements tournee | `surcharges:*` |

#### Documents & Rapports

| Methode | Route | Description | Permission |
|---------|-------|-------------|------------|
| CRUD | `/api/waybill-archives/` | Archives CMR (immutable apres emission) | `waybill-archives:*` |
| PUT | `/api/waybill-archives/{id}/sign/{party}` | Signature CMR | `waybill-archives:update` |
| GET | `/api/kpi/` | Indicateurs dashboard | `dashboard:read` |
| GET | `/api/reports/` | Rapports metier | `reports:read` |
| GET | `/api/audit/` | Journal d'audit | `roles:read` |
| POST | `/api/aide-decision/` | Aide a la decision (optimisation) | `aide-decision:create` |

### 4.2 Services metier (10 services)

| Service | Responsabilite |
|---------|---------------|
| `CostCalculatorService` | Calcul cout tournee (fixe + km + horaire) |
| `KpiService` | Taux de remplissage, cout/EQC, km/EQC, CO2 |
| `TimeCalculatorService` | Durees quai, dechargement, trajet |
| `DistanceService` | Requetes matrice de distances (bidirectionnel) |
| `TourBuilderService` | Construction tournee, ordonnancement des arrets |
| `OptimizerOrToolsService` | Optimisation VRP via Google OR-Tools |
| `ImportService` | Import volumes (SUPERLOG), distances, taxes km |
| `ExportService` | Export Excel tournees, volumes, KPI |
| `AideDecisionService` | Recommandation splits, surbooking (alerte 100-115%) |
| `SeedService` | Seed admin/admin + templates inspection au demarrage |

### 4.3 Middleware & Fonctionnalites transversales

- **CORS** : Whitelist d'origines (localhost dev + domaine prod)
- **Security Headers** : X-Content-Type-Options, X-Frame-Options, X-XSS-Protection
- **Request ID** : Header X-Request-ID pour tracabilite
- **Rate Limiting** : slowapi par IP (login 5/min, GPS 30/min, defaut 60/min)
- **Logging** : Logs JSON structures en production
- **SPA Fallback** : Routes non-API servies par le build React statique

---

## 5. Modele de donnees

### 5.1 Statistiques

| Metrique | Nombre |
|----------|--------|
| Modeles SQLAlchemy | 41 |
| Tables (avec jonctions) | ~50 |
| Enums/Status | 30+ |
| Resources RBAC | 33 |

### 5.2 Diagramme par domaine

#### Geographie & Organisation

```
Country (1) ---< Region (N) ---< BaseLogistics (N)
                    |                    |
                    +---< PDV (N)       +---M2M--- BaseActivity
                    |
                    +---< Supplier (N)
                    |
                    +---< Carrier (N)
                    |
                    +---< Contract (N)
```

#### Tournees & Livraisons

```
Tour (1) ---< TourStop (N) ----> PDV
  |               |
  |               +---< StopEvent (arrivee, depart, cloture)
  |               +---< SupportScan (scan codes-barres)
  |
  +----> Contract ----> Carrier
  +----> Vehicle (vehicule principal)
  +----> Vehicle (tracteur, pour semi)
  +----> BaseLogistics (base de depart)
  +---< TourSurcharge ----> SurchargeType
  +---< TourManifestLine (lignes WMS)
  +----> DeviceAssignment ----> MobileDevice
  +----> WaybillArchive (CMR, 1:1)

Volume ----> PDV
       ----> BaseLogistics (base origine)
       ----> Tour (nullable, apres affectation)
```

#### Utilisateurs & RBAC

```
User (N) ---M2M--- Role (N) ---< Permission (resource + action)
  |
  +---M2M--- Region (scope geographique)
```

#### Flotte Vehicules

```
Vehicle ---< VehicleInspection ---< InspectionItem
  |                              ---< InspectionPhoto
  +---< VehicleMaintenanceRecord
  +---< VehicleFuelEntry
  +---< VehicleModification
  +---< VehicleCostEntry

InspectionTemplate (referentiel checklist)
MaintenanceScheduleRule (regles de planification)
```

#### Mobile & Tracking

```
MobileDevice ---< DeviceAssignment ----> Tour
                                   ----> User (optionnel)

GPSPosition ----> MobileDevice
            ----> Tour

DriverDeclaration ---< DeclarationPhoto
DeliveryAlert ----> Tour, TourStop
```

#### Logistique Retour

```
PickupRequest ----> PDV
              ----> SupportType
              ---< PickupLabel (etiquettes individuelles)

ConsignmentMovement (import Zebre, mouvements consignes)
```

### 5.3 Champs cles des entites principales

#### Tour (tournee)

| Champ | Type | Description |
|-------|------|-------------|
| code | string (unique) | Identifiant tournee |
| date | YYYY-MM-DD | Date de la tournee |
| status | enum | DRAFT / VALIDATED / IN_PROGRESS / RETURNING / COMPLETED |
| vehicle_type | enum | SEMI, PORTEUR, CITY, VL... |
| temperature_type | enum | SEC, FRAIS, GEL, BI_TEMP, TRI_TEMP |
| capacity_eqp | float | Capacite en equivalents colis |
| total_km / total_cost | float | Totaux calcules |
| driver_name | string | Nom du chauffeur |
| vehicle_id / tractor_id | FK | Vehicules affectes |
| contract_id | FK | Contrat transporteur |
| base_id | FK | Base logistique de depart |

#### PDV (point de vente)

| Champ | Type | Description |
|-------|------|-------------|
| code / name | string | Identification |
| type | enum | EXPRESS, SUPER, HYPER, DRIVE, NETTO... |
| longitude / latitude | float | Coordonnees GPS |
| has_sas_sec/frais/gel | bool | Zones de stockage par temperature |
| has_dock | bool | Quai de dechargement |
| delivery_window_start/end | HH:MM | Fenetre de livraison |
| access_constraints | string | Contraintes d'acces |
| allowed_vehicle_types | string | Types vehicule autorises (pipe-separated) |

#### Volume (commande)

| Champ | Type | Description |
|-------|------|-------------|
| pdv_id | FK | Point de vente destinataire |
| date | YYYY-MM-DD | Date du volume |
| eqp_count | float | Nombre d'equivalents colis (2 decimales) |
| temperature_class | enum | SEC / FRAIS / GEL |
| weight_kg | float | Poids total |
| tour_id | FK (nullable) | Tournee affectee |
| activity_type | enum | SUIVI (normal) / MEAV (promo) |

#### Vehicle (vehicule)

| Champ | Type | Description |
|-------|------|-------------|
| code / license_plate / vin | string | Identification |
| fleet_vehicle_type | enum | SEMI, PORTEUR, CITY, VL, TRACTEUR... |
| status | enum | ACTIVE / MAINTENANCE / OUT_OF_SERVICE / DISPOSED |
| fuel_type | enum | DIESEL, ESSENCE, GNV, ELECTRIQUE, HYBRIDE |
| capacity_eqp / capacity_weight_kg | float | Capacites |
| current_km | int | Kilometrage actuel |
| ownership_type | enum | OWNED / LEASED / RENTED |
| qr_code | string (8 chars, unique) | QR code identification rapide |

---

## 6. Authentification & RBAC

### 6.1 Mecanisme JWT

```
+----------+     POST /auth/login      +----------+
|  Client  | ----------------------->  |  Backend |
|          | <-----------------------  |          |
+----------+   { access_token (30min)  +----------+
               refresh_token (7j) }

  access_token : { sub: user_id, type: "access", exp: ... }
  refresh_token : { sub: user_id, type: "refresh", exp: ... }
  Algorithme : HS256 (HMAC-SHA256)
  Hash mot de passe : bcrypt (direct, pas passlib)
```

### 6.2 Modele RBAC

```
User --M2M--> Role --1:N--> Permission(resource, action)
  |
  +--M2M--> Region (scope geographique)
```

**Actions** : `read`, `create`, `update`, `delete`

**33 Resources** :
```
dashboard, countries, bases, pdvs, suppliers, volumes,
contracts, distances, base-activities, parameters,
tour-planning, tour-history, operations, guard-post,
imports-exports, users, roles, loaders, devices,
tracking, support-types, pickup-requests, aide-decision,
surcharges, surcharge-types, declarations, vehicles,
inspections, fleet, reports, consignment-movements,
carriers, waybill-archives
```

### 6.3 Dependencies FastAPI

```python
# Protection d'un endpoint
@router.get("/tours/", dependencies=[Depends(require_permission("tour-planning", "read"))])

# Extraction utilisateur
current_user = Depends(get_current_user)  # Depuis JWT Bearer

# Scope region (filtrage listes)
region_ids = Depends(get_user_region_ids)  # None = pas de filtre (superadmin)

# Auth mobile (par device)
device = Depends(get_authenticated_device)  # Depuis header X-Device-ID
```

### 6.4 Superadmin

- Cree automatiquement au demarrage si aucun utilisateur n'existe
- Credentials : `admin` / `admin` (a changer en production)
- Bypass toutes les verifications de permissions
- Acces a toutes les regions

### 6.5 Synchronisation critique

> **IMPORTANT** : La liste des RESOURCES est definie en DEUX endroits qui doivent rester synchronises :
> - Backend : `backend/app/utils/auth.py`
> - Frontend : `frontend/src/components/admin/PermissionMatrix.tsx`
>
> Apres ajout d'une nouvelle resource, les utilisateurs doivent se re-connecter.

---

## 7. Frontend - Application Web

### 7.1 Pages (43 pages, lazy-loaded)

#### Tableau de bord
- `/` - Dashboard KPI (ponctualite, supplements, couts)

#### Donnees de base (CRUD)
- `/countries` - Pays & Regions
- `/bases` - Bases logistiques
- `/pdvs` - Points de vente
- `/suppliers` - Fournisseurs
- `/carriers` - Transporteurs
- `/volumes` - Volumes (commandes)
- `/contracts` - Contrats transporteurs
- `/vehicles` - Vehicules
- `/base-activities` - Activites de base
- `/loaders` - Chargeurs
- `/devices` - Appareils mobiles
- `/support-types` - Types de support consigne
- `/surcharge-types` - Types de supplement

#### Transport
- `/tour-planning` - Construction de tournees (builder principal)
- `/tour-history` - Historique des tournees
- `/distances` - Matrice de distances
- `/km-tax` - Taxe kilometrique
- `/fuel-prices` - Prix carburant
- `/parameters` - Parametres systeme
- `/transporter-summary` - Synthese transporteur
- `/aide-decision` - Aide a la decision

#### Operations
- `/operations` - Supervision operations
- `/guard-post` - Poste de garde
- `/tracking` - Suivi temps reel (GPS + WebSocket)
- `/base-reception` - Reception base (consignes)
- `/declarations` - Declarations chauffeur
- `/consignments` - Suivi consignes (Zebre)
- `/waybill-registry` - Registre CMR

#### PDV
- `/pdv-deliveries` - Planning livraisons PDV
- `/pickup-requests` - Demandes d'enlevement

#### Flotte
- `/fleet` - Gestion flotte (TCO, maintenance, carburant)
- `/inspections` - Inspections vehicules

#### Rapports
- `/reports/daily` - Rapport journalier
- `/reports/driver` - Rapport chauffeur
- `/reports/pdv` - Rapport PDV
- `/reports/vehicle` - Rapport vehicule

#### Administration
- `/admin/users` - Gestion utilisateurs
- `/admin/roles` - Gestion roles
- `/audit` - Journal d'audit

#### Utilitaires
- `/help` - Aide
- `/phone-setup` - Guide configuration telephone
- `/map-detached` - Carte detachee (fenetre independante)
- `/login` - Connexion

### 7.2 Stores Zustand

| Store | Persistance | Contenu |
|-------|-------------|---------|
| `useAuthStore` | LocalStorage (`chaos-route-auth`) | Tokens JWT, user, permissions, `hasPermission()` |
| `useAppStore` | LocalStorage (`chaos-route-prefs`) | Theme, langue, region/pays selectionne, sidebar |
| `useTourStore` | Session uniquement | Tournee en cours de construction, arrets, volumes |
| `useMapStore` | Session uniquement | Centre carte, zoom, couches visibles |

### 7.3 Composants generiques reutilisables

#### CrudPage
Wrapper generique pour toute page CRUD. Compose :
- `DataTable` (tri, filtre, pagination, recherche, colonnes redimensionnables)
- `FormDialog` (champs dynamiques : text, select, searchable-select, checkbox, date, time...)
- `ConfirmDialog` (suppression)
- `ImportDialog` (upload CSV/XLSX)

> La majorite des pages de donnees de base utilisent `CrudPage` avec une configuration declarative.

#### MapView
Conteneur Leaflet avec :
- Marqueurs PDV, bases, fournisseurs, chauffeurs
- Polylines de route
- Sync bidirectionnelle store Zustand <-> carte
- Auto-fit aux limites de la region
- Gestion du resize des panels

### 7.4 Service API (Axios)

```typescript
// Fonctions generiques CRUD
fetchAll<T>(endpoint, params?)    // GET /endpoint/ (avec trailing slash)
fetchOne<T>(endpoint, id)         // GET /endpoint/{id}
create<T>(endpoint, payload)      // POST /endpoint/ (avec trailing slash)
update<T>(endpoint, id, payload)  // PUT /endpoint/{id}
remove(endpoint, id)              // DELETE /endpoint/{id}

// Intercepteurs
- Request : ajoute Authorization: Bearer {token}
- Response 401 : auto-refresh token, file d'attente des requetes en cours
```

> **Convention trailing slash** : Les endpoints de liste (GET) et creation (POST) ont un trailing slash (`/tours/`). Les endpoints avec ID n'en ont pas (`/tours/{id}`). La fonction `withSlash()` gere cela automatiquement.

### 7.5 WebSocket Tracking

```typescript
// Singleton : trackingWS
trackingWS.connect(token)           // ws://host/ws/tracking?token=xxx
trackingWS.subscribe(type, handler) // Ecouter un type de message
trackingWS.subscribe('*', handler)  // Broadcast tous les messages

// Auto-reconnexion avec backoff exponentiel (1s -> 30s max)
```

### 7.6 Theme

- **Theme sombre** par defaut (noir/gris/orange/rouge)
- **Theme clair** disponible (toggle dans le header)
- CSS custom properties : `--bg-primary`, `--bg-secondary`, `--text-primary`, `--border-color`...
- Styles d'impression : A4 paysage, fond blanc, en-tete/sidebar masques

### 7.7 Internationalisation

- **Langue par defaut** : FR
- **Langues supportees** : FR, EN, PT, NL
- **Etat actuel** : FR complet, EN/PT/NL a faire (batch prevu)
- **Fichiers** : `frontend/public/locales/{lang}/translation.json`

---

## 8. Application Mobile (CMRO Driver)

### 8.1 Fonctionnalites

| Fonction | Description |
|----------|-------------|
| Tournee du jour | Affiche la tournee affectee au device |
| Navigation arrets | Liste ordonnee des arrets avec statut |
| Scan codes-barres | Scan des supports a chaque arret |
| Tracking GPS | Position envoyee toutes les 2 secondes (foreground + background) |
| Inspections vehicule | Checklist pre-depart / post-retour avec photos |
| Declarations | Signalement incidents (casse, accident, anomalie) avec photos |
| Enlevements | Scan et validation des retours consignes |

### 8.2 Authentification mobile

- Header `X-Device-ID` (UUID unique par appareil)
- Enregistrement via code de registration unique
- Auto-tracking : version app, version OS, derniere activite

### 8.3 Build & Distribution

```bash
# Build APK (preview)
cd mobile
eas build --profile preview --platform android --non-interactive

# Upload sur serveur
scp cmro-driver.apk user@76.13.58.182:/opt/chaos-route/apk/

# Les chauffeurs telechargent via QR code ou URL directe
# http://76.13.58.182/apk/cmro-driver.apk
```

### 8.4 Permissions Android

- `ACCESS_FINE_LOCATION`, `ACCESS_BACKGROUND_LOCATION` (GPS continu)
- `CAMERA` (scan QR, photos inspection)
- `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_LOCATION` (tracking background)
- `REQUEST_INSTALL_PACKAGES` (auto-update APK)

---

## 9. Infrastructure & Deploiement

### 9.1 Architecture serveur

```
VPS Hostinger (76.13.58.182)
+-- /opt/chaos-route/
    +-- docker-compose.yml
    +-- Caddyfile
    +-- .env.production
    +-- deploy.sh
    +-- data/              # BDD + fichiers
    +-- apk/               # APK mobile
        +-- cmro-driver.apk
```

### 9.2 Services Docker

| Service | Image | Port | Volume |
|---------|-------|------|--------|
| **db** | postgres:16-alpine | 5432 (interne) | pgdata |
| **app** | Build custom (Python 3.13-slim) | 8000 (interne) | ./data, ./apk |
| **caddy** | caddy:2-alpine | 80, 443 (public) | caddy_data, caddy_config |

### 9.3 Dockerfile (multi-stage)

```dockerfile
# Stage 1 : Frontend
FROM node:20-alpine AS frontend
WORKDIR /build
COPY frontend/ .
RUN npm ci && npm run build    # -> /build/dist

# Stage 2 : Backend + Frontend statique
FROM python:3.13-slim
RUN apt-get install gcc postgresql-client
COPY backend/requirements.txt .
RUN pip install -r requirements.txt
COPY backend/app /app/app
COPY --from=frontend /build/dist /app/static
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", ...]
```

### 9.4 Reverse Proxy (Caddy)

- **HTTPS** : `chaosroute.chaosmanager.tech` (certificat Let's Encrypt auto)
- **HTTP** : `http://76.13.58.182` (acces mobile direct)
- HSTS active (`max-age=31536000; includeSubDomains; preload`)

### 9.5 Procedure de deploiement

#### Web (backend + frontend)

```bash
# 1. Push le code
git push origin main

# 2. SSH sur le serveur
ssh user@76.13.58.182

# 3. Deployer
cd /opt/chaos-route
sudo ./deploy.sh
# -> git pull, docker compose build --no-cache, up -d, prune images
```

#### Mobile (si fichiers mobile/ modifies)

```bash
# 1. Build APK via EAS
cd mobile
eas build --profile preview --platform android --non-interactive

# 2. Telecharger l'APK genere depuis EAS

# 3. Uploader sur le serveur
scp cmro-driver.apk user@76.13.58.182:/opt/chaos-route/apk/

# 4. Les chauffeurs recuperent la MAJ au prochain lancement
```

### 9.6 Variables d'environnement production

| Variable | Valeur | Description |
|----------|--------|-------------|
| `DEBUG` | `false` | Desactive Swagger UI, active logs JSON |
| `DATABASE_URL` | `postgresql+asyncpg://cmro:***@db:5432/cmro` | Connexion BDD |
| `POSTGRES_PASSWORD` | `***` | Mot de passe PostgreSQL |
| `SECRET_KEY` | `openssl rand -hex 32` | Cle secrete JWT (32 bytes hex) |
| `CORS_ORIGINS` | `["https://chaosroute.chaosmanager.tech"]` | Origines CORS autorisees |

### 9.7 Gestion de la base de donnees

#### Dev (SQLite)
- Fichier auto-cree : `./chaos_route.db`
- Pas de connection pooling

#### Prod (PostgreSQL 16)
- Connection pooling : pool_size=20, max_overflow=30
- Pool timeout : 30s, recycle : 1800s, pre-ping actif
- Health check Docker : `pg_isready`

#### Auto-migration au demarrage
1. `Base.metadata.create_all()` — cree les tables manquantes
2. `_migrate_missing_columns()` — detecte et ajoute les colonnes manquantes via ALTER TABLE
3. `_backfill_qr_codes()` — genere les QR/badge codes manquants
4. `_cleanup_old_gps(days=30)` — purge positions GPS > 30 jours
5. Seed superadmin + templates inspection

> **Note** : Alembic est configure mais les migrations se font principalement via l'auto-migration au demarrage. Alembic sera utilise pour les migrations complexes (rename, drop, data migration).

---

## 10. Securite

### 10.1 Authentification

- JWT HS256 avec tokens courte duree (30 min access, 7 jours refresh)
- Hachage bcrypt pour les mots de passe
- Rate limiting sur login (5/min) et enregistrement (3/min)
- Auto-refresh transparent cote frontend

### 10.2 Autorisation

- RBAC complet : 33 resources x 4 actions
- Scope region : les utilisateurs ne voient que les donnees de leurs regions
- Superadmin bypass (compte unique d'administration)

### 10.3 API

- CORS whitelist stricte (pas de wildcard en prod)
- Headers de securite (X-Content-Type-Options, X-Frame-Options, X-XSS-Protection)
- HSTS force via Caddy
- Rate limiting global (60 req/min par IP)
- Request ID pour tracabilite

### 10.4 Mobile

- Authentification par UUID device (header X-Device-ID)
- Appareil doit etre enregistre et actif
- Cleartext traffic autorise (HTTP vers IP du serveur pour zones sans HTTPS)

### 10.5 Donnees

- CMR immutable apres emission (snapshot JSON fige)
- Journal d'audit (entity, action, changes JSON, user, timestamp)
- Purge GPS automatique apres 30 jours

---

## 11. Conventions de developpement

### 11.1 Code

- **Commentaires bilingues** FR+EN sur fonctions/classes
- **i18n** : travailler en FR uniquement, traductions EN/PT/NL en batch a la fin
- **Trailing slash** : obligatoire sur routes FastAPI list (GET) et create (POST)

### 11.2 Verification des effets de bord

Avant chaque modification, verifier la chaine complete :
```
Modele SQLAlchemy -> Schema Pydantic -> Route API -> Type TypeScript (web + mobile) -> Composant/Page
```

Un maillon manquant = bug silencieux en production.

### 11.3 Git

| Branche | Usage |
|---------|-------|
| `main` | Production V1 (deploye sur VPS) |
| `develop` | Developpement V2 |
| `hotfix/xxx` | Corrections V1 (branch from main, merge into main AND develop) |

**Tags** : `v1.0.0` = premiere release production (2026-02-18)

### 11.4 Sessions de dev

- 1 feature = 1 session = 1 commit
- Audit systematique apres chaque feature (modeles, API, frontend, mobile, auth)
- Ne pas se fier a une seule passe — tracer la chaine complete

---

## 12. Procedures operationnelles

### 12.1 Ajouter une nouvelle resource RBAC

1. Ajouter dans `backend/app/utils/auth.py` → liste `RESOURCES`
2. Ajouter dans `frontend/src/components/admin/PermissionMatrix.tsx` → liste `RESOURCES`
3. Creer les routes API avec `require_permission("resource", "action")`
4. Ajouter l'entree dans la sidebar (`Sidebar.tsx`) avec condition `hasPermission`
5. Les utilisateurs doivent se re-connecter pour voir la nouvelle resource

### 12.2 Ajouter un nouveau champ a un modele existant

1. Ajouter le champ dans le modele SQLAlchemy (`backend/app/models/`)
2. Ajouter dans le schema Pydantic (`backend/app/schemas/`)
3. Ajouter dans la route API si necessaire
4. Ajouter le type TypeScript (`frontend/src/types/index.ts`)
5. Ajouter dans le composant/page concerne
6. L'auto-migration au demarrage ajoutera la colonne automatiquement

### 12.3 Deployer un hotfix V1

```bash
# 1. Creer la branche
git checkout main
git checkout -b hotfix/description

# 2. Faire les corrections, tester

# 3. Merger dans main
git checkout main
git merge hotfix/description

# 4. Deployer
ssh user@76.13.58.182
cd /opt/chaos-route && sudo ./deploy.sh

# 5. Merger dans develop
git checkout develop
git merge hotfix/description

# 6. Supprimer la branche hotfix
git branch -d hotfix/description
```

### 12.4 Premiere installation serveur

1. Cloner le repository sur `/opt/chaos-route/`
2. Copier `.env.production.example` vers `.env.production` et configurer
3. Lancer `docker compose up -d`
4. Verifier `docker compose ps` — 3 services healthy
5. Se connecter avec `admin/admin` et changer le mot de passe immediatement
6. Creer les pays, regions, bases, puis les utilisateurs avec roles

---

## 13. Annexes

### 13.1 Ports utilises

| Port | Service | Acces |
|------|---------|-------|
| 80 | Caddy HTTP | Public |
| 443 | Caddy HTTPS | Public |
| 8000 | FastAPI (uvicorn) | Interne Docker |
| 5432 | PostgreSQL | Interne Docker |
| 5173 | Vite dev server | Local dev uniquement |
| 8002 | Backend dev | Local dev uniquement |

### 13.2 Volumes Docker

| Volume | Contenu | Persistance |
|--------|---------|-------------|
| `pgdata` | Donnees PostgreSQL | Oui |
| `caddy_data` | Certificats TLS | Oui |
| `caddy_config` | Config Caddy runtime | Oui |
| `./data` | Fichiers applicatifs (photos, exports) | Oui (bind mount) |
| `./apk` | APK mobile | Oui (bind mount) |

### 13.3 Enums de reference

#### Statuts de tournee
`DRAFT` -> `VALIDATED` -> `IN_PROGRESS` -> `RETURNING` -> `COMPLETED`

#### Types de vehicule
`SEMI`, `PORTEUR`, `PORTEUR_SURBAISSE`, `PORTEUR_REMORQUE`, `CITY`, `VL`

#### Types de temperature
- Classes : `SEC`, `FRAIS`, `GEL`
- Types vehicule : `SEC`, `FRAIS`, `GEL`, `BI_TEMP`, `TRI_TEMP`

#### Types de PDV
`EXPRESS`, `CONTACT`, `SUPER_ALIMENTAIRE`, `SUPER_GENERALISTE`, `HYPER`, `NETTO`, `DRIVE`, `URBAIN_PROXI`

#### Statuts vehicule
`ACTIVE`, `MAINTENANCE`, `OUT_OF_SERVICE`, `DISPOSED`

#### Types de carburant
`DIESEL`, `ESSENCE`, `GNV`, `ELECTRIQUE`, `HYBRIDE`

#### Statuts CMR
`DRAFT` -> `ISSUED` -> `DELIVERED` | `CANCELLED`

### 13.4 Limites de taux (rate limiting)

| Endpoint | Limite |
|----------|--------|
| Login | 5 requetes/minute |
| Enregistrement device | 3 requetes/minute |
| Position GPS | 30 requetes/minute |
| Autres | 60 requetes/minute |

### 13.5 Estimation volumetrie

| Donnee | Volume estime |
|--------|---------------|
| Positions GPS/jour | ~4 800 (200 chauffeurs x 8h x 3/min) |
| Tournees/jour | ~50-100 |
| Arrets/jour | ~500-1000 |
| Scans/jour | ~5 000 |
| Retention GPS | 30 jours (purge auto) |

---

*Document genere le 11 mars 2026 — Chaos RouteManager V1*
