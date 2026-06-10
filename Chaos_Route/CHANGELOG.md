# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Changed
- Ordonnancement : barre d'actions compactée sur une seule ligne — boutons à
  hauteur unique (32px), *Recalculer* et *Imprimer* en icône seule (infobulle),
  *Valider* et *WMS* en libellé court + icône. Évite le débordement sur une 2ᵉ
  ligne apparu avec l'ajout de l'export, et gagne de la hauteur d'écran.
- Bandeau (Header) : refonte géométrique — hauteur unique (32px) pour tous les
  contrôles, sélecteur de langue segmenté d'un bloc, séparateurs verticaux entre
  groupes, icônes SVG (épingle/soleil/lune/cadenas) au lieu des emojis. Alignement
  et rythme homogènes.

### Fixed
- Aide à la décision : erreur 500 (niveaux 1 et 2) quand la durée totale calculée
  tombait fractionnaire (ex. 133.08 min) — `SuggestedTour.total_duration_minutes`
  (typé `int`) rejetait le float (Pydantic `int_from_float`). Les champs minutes
  (`total_duration_minutes`, `duration_from_previous_minutes`) arrondissent
  désormais float→int via un validator. Tests de régression ajoutés.

### Added
- Construction (Exploitation transport) : nouvelle nature **Transfert PDV à PDV**
  (mode « Mouvement ») — origine (chargement) → destination (dépose), sans
  quantité. Champ **Commentaire** ajouté au mode Mouvement (transfert +
  déplacement base + garage), persisté dans `tours.remarks`. Nouveau type
  `TourType.TRANSFERT_PDV` (migration enum PG incluse).

### Fixed
- Ordonnancement : faux chevauchement (overlap) entre deux tours d'une même
  répartition livrés des jours différents (ex. tour livré le 04/06 09:00-15:53
  vs tour livré le 05/06 05:00). La détection backend comparait uniquement
  l'heure ; elle compare désormais sur une timeline absolue (jour de livraison
  + heure), comme le frontend. Logique extraite en `tours_time_overlap()` + tests.

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
