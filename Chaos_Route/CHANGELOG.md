# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added
- Création de tours — **Enlèvement dédié** (sous le mode *Mouvement*) : nouvelle
  nature `ENLEVEMENT_DEDIE` permettant de choisir un **fournisseur** (point
  d'enlèvement déjà dans le distancier, ex. e066 = AVION — fonctionne comme un
  PDV), un **chauffeur PARC** (chauffeur Base, commentaire « Chauffeur PARC » par
  défaut) et un créneau **heure de début → heure de fin** (saisis à la main). Le
  km aller-retour base ↔ fournisseur est repris du distancier. Nouvelle colonne
  `tours.supplier_id` (migration auto : colonne + FK + valeur d'enum PG ajoutées).
- Création de tours — **Tour surprise** : tour attribué à un transporteur sans PDV
  au moment de la création (les PDV sont ajoutés plus tard depuis l'ordonnancement).
  Saisie base + transporteur + heure de départ.
- Ordonnancement — bouton **Confirmation Mail** : génère, transporteur par
  transporteur, le récapitulatif des tournées attribuées du jour (tableau Code Ch.
  | H.Départ | N° Mission | Chauffeurs | Observations/Enlèvement | Départ | Retour
  | PDV 1..N), avec aperçu validé « prêt à être transféré » puis envoi manuel à
  l'adresse e-mail enregistrée dans la fiche transporteur (endpoints
  `GET/POST /tours/transporter-confirmation`).

### Changed
- Ordonnancement : barre d'actions compactée sur une seule ligne — boutons à
  hauteur unique (32px), *Recalculer* et *Imprimer* en icône seule (infobulle),
  *Valider* et *WMS* en libellé court + icône. Évite le débordement sur une 2ᵉ
  ligne apparu avec l'ajout de l'export, et gagne de la hauteur d'écran.
- Ordonnancement : barre dissociée en 2 zones — filtres à gauche (se replient
  entre eux si besoin) et actions ancrées en haut à droite (`shrink-0`), pour que
  le bloc compteurs+boutons ne bascule plus jamais sur une 2ᵉ ligne pleine largeur.
- Bandeau (Header) : refonte géométrique — hauteur unique (32px) pour tous les
  contrôles, sélecteur de langue segmenté d'un bloc, séparateurs verticaux entre
  groupes, icônes SVG (épingle/soleil/lune/cadenas) au lieu des emojis. Alignement
  et rythme homogènes.

### Fixed
- Ordonnancement (tours Mouvement) : (1) un mouvement affecté à un seul chauffeur
  Base était classé sans mode → invisible au filtre « Propre » ; désormais classé
  *propre* dès qu'il y a une ressource propre (véhicule, tracteur ou chauffeur).
  (2) Le chauffeur Base s'affiche dans le **badge vert** (même emplacement que les
  transporteurs) au lieu du petit texte gris. (3) Le **commentaire** du tour et la
  **destination** apparaissent désormais sur la carte.
- Ordonnancement (Gantt) : un tour livré le jour B (départ/retour après minuit,
  ex. 00h01→05h15 le 05/06) s'affichait à gauche sur le jour A. Le Gantt positionne
  désormais les barres en **temps absolu** (offset du jour de livraison + heure),
  étend l'axe pour couvrir le jour B et marque la frontière de minuit (« J+1 »).
- Aide à la décision : erreur 500 (niveaux 1 et 2) quand la durée totale calculée
  tombait fractionnaire (ex. 133.08 min) — `SuggestedTour.total_duration_minutes`
  (typé `int`) rejetait le float (Pydantic `int_from_float`). Les champs minutes
  (`total_duration_minutes`, `duration_from_previous_minutes`) arrondissent
  désormais float→int via un validator. Tests de régression ajoutés.

### Added
- Ordonnancement : **permutation des PDV** en mode « Modifier » — flèches ↑/↓ sur
  chaque arrêt pour réordonner la tournée, avec recalcul serveur des temps, km et
  coût (`PUT /tours/{id}/reorder-stops`). « Modifier » déplie le tour pour exposer
  la liste des PDV.
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
