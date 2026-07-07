# ÉTAT — Mission isolation multi-tenant (preuve adverse)

> Fichier de persistance. À la reprise après coupure : lire ce fichier, reprendre à PROCHAINE ACTION.

## Mission
Aucun tenant ne peut lire/écrire/déduire les données d'un autre tenant, PROUVÉ par des tests adverses automatisés rejouables en CI.
- Méthode : phases gated (STOP + GO explicite de Dominic à chaque fin de phase, aucun commit sans GO).
- Trailer commits : `Assisted-by: Claude:claude-fable-5`.
- Plan de référence : PAS de doc "4 phases" séparé dans le repo. Référence = docs/CHAOS_ROUTE_architecture_scalabilite.md (modèle (a) : base partagée + tenant_id, isolation logique) + mémoire projet. "Phase 4" = prompt d'origine de Dominic.
- Cœur confirmé de première main (database.py) : `_apply_tenant_filter` forme closure correcte (bug tid= figé résolu), couvre SELECT+UPDATE+DELETE, bypass si tenant None (superadmin). `_stamp_tenant_on_insert` stampe les INSERT. `set_session_tenant` posé dans deps.py.

## Phase en cours
**Exécution (GO global "règle le sujet, classe mondiale").** Branche `security/tenant-isolation`, un sujet/commit, preuve d'abord, PAS de déploiement (revue avant merge).

### Avancement — TERMINÉ (branche security/tenant-isolation, NON déployé)
- [x] **C1 WebSocket** — cloisonné par tenant. Commit `e1b574f`.
- [x] **C2 endpoints fichiers** — auth + select tenant-filtré + `<AuthImage>`. Commit `2e900ac`.
- [x] **M1** gardes import_time_matrix/import_manifest. Commit `8a32322`.
- [x] **M3** — PROUVÉ SAIN : db.get() en session fraîche est filtré (pas de bypass identity-map). Commit `8a32322`. Aucun correctif nécessaire.
- [x] **M2** AuditLog → TenantMixin (stamp+filtre auto, colonne auto-migrée). Commit `2df1c84`.
- [x] **M4** — NON-PROBLÈME : lookup base tenant-filtré = pas d'oracle. Aucun code.
- [x] **CI** matrice adverse (.github/workflows/tenant-isolation.yml à la racine git). Commit `35cab05`.
- [x] B1 SupportType : hors périmètre (métier/tarifs), non touché.

### Tests adverses (backend/tests/test_tenant_isolation_adversarial.py) — 6 verts
WS scope + WS tenant requis ; photo température cross-tenant 404 + propriétaire 200 ; fichiers sans auth 401/403 ; db.get filtré (session fraîche) ; audit cross-tenant invisible + stampé. Suite backend complète : 72 passed.

### À FAIRE (décision Dominic)
Revue + merge `security/tenant-isolation` → main + déploiement. ⚠️ Au démarrage prod, `audit_logs.tenant_id` sera ajouté (nullable) et backfillé tenant 1 par les micro-migrations (cf. [[project_startup_automigration]]) — pas de migration manuelle. Les changements front (AuthImage, plan PDV) nécessitent le rebuild front (inclus dans deploy.sh).

## Fait / vérifié
- Mémoire rechargée : isolation coeur déployée 2026-06-19 (TenantMixin ~50 modèles, filtre central `_apply_tenant_filter` via do_orm_execute/with_loader_criteria, durci UPDATE/DELETE en masse le 2026-06-22, commit 87414d6). Bug historique du cache lambda (tid= constante) corrigé (6b99c6b).
- Dettes résiduelles DÉJÀ CONNUES (mémoire, à re-vérifier dans le code) : audit.py + parameter.py non tenant-scopés ; import_manifest / import_time_matrix non gardés contre l'import superadmin (tenant NULL) ; tenant_id nullable (pas NOT NULL) ; backfill démarrage aspire les NULL vers tenant 1.
- Tests d'isolation existants : backend/tests/test_tenant_isolation.py + test_reference_data_isolation.py (couverture à évaluer).
- Cartographie lancée (3 agents parallèles) : A=modèles/TenantMixin, B=API/SQL brut/exports/fichiers, C=solveur/jobs/caches/logs/mobile/frontend.

## Rapport Agent A (modèles) — reçu
- 41 modèles TenantMixin. Cœur (filtre/stamp) confirmé OK.
- ❌ CRITIQUE `AuditLog` (audit.py) : pas de tenant_id → lecture croisée de l'audit + non filtrable.
- ⚠️ `Parameter` : pas de tenant_id (scoping region_id nullable seulement).
- ⚠️ `SupportType` : global mais champs financiers (unit_value/content_item_value = consignes) qui diffèrent par pays.
- ⚠️ `Role`/`Permission` + assoc `user_roles`/`user_regions`/`base_activity_link` : pas de tenant_id (dépendent de User.tenant_id + validation API à prouver).
- Tests existants : Carrier + KmTax + DistanceMatrix (ORM), /distance-matrix (API), KPI region guard 403. GAPS : aucun test adverse API (GET /tours/{id} d'un autre tenant → doit 404 ; POST avec base_id d'un autre tenant), audit/param/supporttype, lazy-load via relations, concurrence 2 tenants même process (déjà la cause du bug 6b99c6b).

## Rapport Agent C (solveur/jobs/caches/logs/frontend) — reçu
- ❌❌ CRITIQUE **WebSocket tracking** `ws_tracking.py` : `manager` singleton + `broadcast()` envoie à TOUS les clients connectés sans filtre tenant. Émetteurs : driver.py GPS (595-604), stop events (676/792/864/900), tour status ; assignments.py (65-71) ; tours.py (~2464). => fuite live GPS/nom chauffeur/code tournée cross-tenant. FUITE RÉELLE PROUVABLE.
- ⚠️ Solveur `aide_decision.py:18-28` : pas de validation que `base_origin_id` ∈ régions user (ORM filtre les données mais permet le probing d'existence de base).
- ✅ Caches : aucun cache module-level à risque (holidays lru_cache OK ; dicts request-scoped). BON.
- ✅ Frontend : n'envoie pas tenant_id ; region_id validé côté serveur (kpi.py 403). BON.
- ⚠️ `_cleanup_old_gps` (database.py:249) : DELETE gps par date sans tenant — c'est de la rétention (tous tenants), pas une fuite ; low.
- Audit : superadmin-only mais renvoie tous les tenants (cf. Agent A).

## Rapport Agent B (API/SQL/fichiers/exports) — reçu + POINTS CLÉS VÉRIFIÉS DE PREMIÈRE MAIN
- SQL brut : uniquement startup (aucun endpoint). Bypass filtre : tous corrects (superadmin None). Exports : ORM → filtrés. BON.
- ❌ Endpoints FICHIERS SANS AUTH (get_db seul → tenant jamais posé → filtre OFF → cross-tenant) : VÉRIFIÉ temperature.py:189 `/checks/{id}/photo` et pdvs.py:260 `/plans/{filename}`. Même motif rapporté (à confirmer test) : declarations.py:271 photos, inspections.py:194 photos, support_types.py:145 image (SupportType global→moindre).
- ❌ import_time_matrix (imports.py:246) + import_manifest (408) : PAS de garde superadmin (import_data:576 l'a, ligne 604). → risque d'orphelins tenant=NULL (récidive de l'incident juin).
- ⚠️ `db.get(TenantMixin, id)` (245 occurrences) : l'agent soupçonne un bypass du with_loader_criteria via l'identity map. À PROUVER/RÉFUTER par test (session per-request fraîche → probablement filtré ; ne pas affirmer sans preuve).
- WS tracking VÉRIFIÉ : JWT validé mais broadcast() = liste globale, zéro partition tenant → fuite live.

## CARTE CONSOLIDÉE (chemins où tenant_id n'est PAS garanti) — voir message à Dominic
Sévérités : [C1] WS broadcast global · [C2] endpoints fichiers sans auth · [M1] import_manifest/time_matrix non gardés · [M2] AuditLog sans tenant_id (endpoint superadmin-only) · [M3] db.get identity-map (à prouver) · [M4] solveur base_origin_id non validé (probing) · [B1] SupportType valeurs financières globales (hors périmètre fuite, business).

## PROCHAINE ACTION
STOP — carte + plan gated présentés à Dominic. ATTENDRE GO explicite avant Phase 1 (tests adverses rouges). Aucun commit.

## Décisions prises
- (aucune encore — investigation)

## Questions ouvertes pour Dominic
- (à remplir avec la carte)
