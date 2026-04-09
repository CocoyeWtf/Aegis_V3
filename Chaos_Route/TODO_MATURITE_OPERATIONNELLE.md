# Checklist de maturite operationnelle -- CHAOS Platform

> Audit realise le 2026-04-03 -- revise apres echange avec Dominic.
> Seuls les items reellement utiles dans le contexte actuel sont conserves.
> Legende verdict : FAIRE = necessaire | REPORTER = utile plus tard | SUPPRIMER = pas pertinent

---

## Niveau 1 -- Bloquant avant tout vrai utilisateur

**Avancement global : ~90%**

| # | Item | A quoi ca sert | Verdict | Statut | Detail |
|---|------|---------------|---------|--------|--------|
| 1.1 | Sauvegardes PostgreSQL | Si la base crashe, on peut restaurer les donnees | A VERIFIER | :warning: 80% | Dominic confirme backup nocturne en place sur le VPS. Pas de trace dans le repo (probablement crontab systeme). **A verifier cote serveur semaine du 07/04** |
| 1.2 | Procedure de restauration testee | Verifier qu'on SAIT restaurer (un backup non teste = pas de backup) | FAIRE | :warning: 30% | Procedure de restauration documentee dans `docs/operations/RUNBOOK_INCIDENT.md`. **Test reel prevu semaine du 07/04** |
| 1.3 | Migrations Alembic | Versionner les changements de structure BDD comme Git versionne le code | REPORTER | :large_blue_circle: Reporte | `init_db()` fait le travail. Utile uniquement quand plusieurs devs ou env staging strict. Risque de regression si on migre maintenant |
| 1.4 | Secrets hors du code | Empecher qu'un pirate qui lit le code source obtienne vos mots de passe | FAIT | :white_check_mark: 100% | `.env` OK, `.gitignore` OK. Cles SMS par defaut supprimees de `sms.py` et `sms_gateway/config.py` (2026-04-03) |
| 1.5 | HTTPS partout | Chiffrer les communications pour que personne ne puisse lire les donnees en transit | FAIRE | :warning: 90% | Caddy + HSTS OK. **Reste** : desactiver `usesCleartextTraffic` dans `mobile/app.json` (mais verifier d'abord que le SMS gateway passe en HTTPS) |
| 1.6 | Keycloak | Systeme d'authentification centralise | SUPPRIMER | :large_blue_circle: N/A | Vous avez votre propre auth JWT+RBAC, ca fonctionne bien |
| 1.7 | Redemarrage auto Docker | Si un service plante la nuit, il redemarre tout seul | FAIT | :white_check_mark: 100% | `restart: unless-stopped` sur tous les services |
| 1.8 | Health checks Docker | Docker detecte si un service est "vivant mais bloque" et le relance | FAIT | :white_check_mark: 100% | Health checks sur les 3 services : db (pg_isready), app (python urllib /api/), caddy (wget). Caddy demarre seulement quand app est healthy (2026-04-03) |

---

## Niveau 2 -- Necessaire avant deploiement multi-sites

**Avancement global : ~30%**

| # | Item | A quoi ca sert | Verdict | Statut | Detail |
|---|------|---------------|---------|--------|--------|
| 2.1 | Logs centralises (Loki) | Quand un utilisateur signale un bug, vous pouvez chercher ce qui s'est passe SANS vous connecter au serveur | FAIRE | :x: 0% | Aujourd'hui il faut faire `docker logs` en SSH. Avec plusieurs sites c'est ingeerable |
| 2.2 | Alerting (service down) | Etre prevenu AVANT que les utilisateurs vous appellent pour dire "ca marche pas" | FAIRE | :x: 0% | Un simple check toutes les 5 min qui envoie un SMS/email si le serveur ne repond plus |
| 2.3 | Dashboard Grafana | Voir d'un coup d'oeil si le systeme va bien (nb utilisateurs connectes, erreurs, temps de reponse) | REPORTER | :x: 0% | Utile mais pas bloquant. L'alerting (2.2) est plus important |
| 2.4 | CI/CD | Automatiser le deploiement : vous faites `git push`, le serveur se met a jour tout seul, apres avoir verifie que rien n'est casse | FAIRE | :x: 0% | Aujourd'hui deploiement 100% manuel = risque d'erreur humaine |
| 2.5 | Procedure de rollback | Si une mise a jour casse quelque chose, comment revenir en arriere en 5 minutes | FAIT | :white_check_mark: 100% | Documentee dans `docs/operations/PROCEDURE_ROLLBACK.md` (2026-04-03). 4 scenarios + checklist pre-deploiement |
| 2.6 | Environnement staging | Un serveur de test identique a la prod pour valider les changements AVANT de les pousser aux utilisateurs | REPORTER | :warning: 30% | Important pour multi-sites mais pas bloquant avec un seul site. Un simple docker-compose sur une autre machine suffit |
| 2.7 | Migration zero-downtime | Pouvoir mettre a jour la BDD sans couper le service | SUPPRIMER | :large_blue_circle: Reporte | Sans Alembic, pas applicable. Et avec vos volumes actuels, 30 secondes de maintenance planifiee suffisent |
| 2.8 | RLS teste avec vrais utilisateurs | Verifier qu'un user de la base de Liege ne voit pas les donnees de Bruxelles | FAIRE | :warning: 50% | Le code RBAC + scope region existe. **Reste** : tester manuellement avec 2-3 comptes de roles differents et documenter le resultat |

---

## Niveau 3 -- Necessaire avant 100+ utilisateurs

**Avancement global : ~45%**

| # | Item | A quoi ca sert | Verdict | Statut | Detail |
|---|------|---------------|---------|--------|--------|
| 3.1 | Tests d'integration | Des scripts automatiques qui verifient que les fonctions critiques marchent encore apres chaque modification | FAIRE | :warning: 15% | Quelques tests existent. Priorite : tester auth + tours + booking. Empeche les regressions |
| 3.2 | Tests dans le CI | Les tests du point 3.1 se lancent automatiquement a chaque `git push` | FAIRE (apres 2.4 et 3.1) | :x: 0% | Depend du CI/CD (2.4) et des tests (3.1) |
| 3.3 | Tests de charge | Savoir combien d'utilisateurs simultanes le systeme supporte avant de ramer | REPORTER | :x: 0% | Utile avant 100+ users. Pas urgent a 30 users |
| 3.4 | Rate limiting | Empecher un attaquant d'envoyer 10000 requetes/seconde pour faire tomber le serveur | FAIT | :white_check_mark: 90% | Deja en place (slowapi). Le stockage en memoire est une limite mais acceptable tant que vous avez un seul serveur |
| 3.5 | Audit log | Savoir QUI a fait QUOI et QUAND -- indispensable en cas de litige ou d'enquete | FAIT | :white_check_mark: 95% | Deja excellent : login, CRUD, RGPD, tout est trace |
| 3.6 | Rotation des secrets | Changer regulierement les mots de passe techniques (cle JWT, cle API SMS) pour limiter les degats si l'un est compromis | FAIRE | :x: 0% | Pas un outil a installer : juste une procedure documentee "tous les 6 mois, changer X et Y" |
| 3.7 | Runbook d'incident | Un document qui dit : "si la prod tombe a 8h un lundi, voici les etapes exactes pour la remettre en route" | FAIT | :white_check_mark: 100% | Redige dans `docs/operations/RUNBOOK_INCIDENT.md` (2026-04-03). 8 scenarios couverts avec commandes exactes |
| 3.8 | Contact d'astreinte | Qui appeler si ca tombe | FAIRE | :x: 0% | Meme si c'est vous seul : le formaliser pour le groupe |
| 3.9 | SLA informel | Dire aux utilisateurs "on vise 99% de disponibilite, maintenance possible le dimanche soir" | REPORTER | :x: 0% | Utile pour gerer les attentes mais pas technique |

---

## Niveau 4 -- Necessaire avant 500+ utilisateurs / donnees sensibles

**Avancement global : ~40%**

| # | Item | A quoi ca sert | Verdict | Statut | Detail |
|---|------|---------------|---------|--------|--------|
| 4.1 | BDD separees par env | Eviter qu'un test en dev corrompe les donnees de prod | FAIT | :warning: 70% | Dev = SQLite local, Prod = PostgreSQL. Pas parfait mais suffisant. Staging PostgreSQL a prevoir pour multi-sites |
| 4.2-4.4 | ClickHouse / Redis / Kafka | Technologies de data/cache/messaging | SUPPRIMER | :large_blue_circle: N/A | Pas dans votre stack, pas necessaire |
| 4.5 | Pen test externe | Un expert en securite essaie de pirater votre systeme et vous dit ce qu'il a trouve | FAIRE (quand budget) | :x: 0% | ~2000-5000 EUR. Necessaire avant deploiement groupe officiel. C'est ce qui donne confiance a l'IT |
| 4.6 | RGPD complet | Conformite legale obligatoire pour les donnees personnelles (chauffeurs, GPS, etc.) | EN COURS | :white_check_mark: 90% | Code OK. Documents rediges : DPIA (`docs/operations/DPIA_CHAOS_PLATFORM.md`), Registre CNIL (`docs/operations/REGISTRE_TRAITEMENTS_CNIL.md`), Procedure breach (`docs/operations/PROCEDURE_NOTIFICATION_BREACH.md`). **Reste** : designer le DPO, faire valider DPIA par un juriste |
| 4.7 | WAF | Un bouclier devant votre API qui bloque les attaques connues (injections SQL, bots, etc.) | FAIRE | :x: 0% | Cloudflare gratuit/pro suffit. Vous avez deja du sanitizing et des security headers mais un WAF ajoute une couche |
| 4.8 | Plan Kubernetes | Orchestration de conteneurs pour haute disponibilite et scaling automatique | REPORTER | :x: 0% | Docker Compose suffit pour 500 users. K8s = complexite enorme pour un gain minime a votre echelle |
| 4.9 | Goulots d'etranglement | Savoir OU le systeme va saturer en premier | REPORTER | :warning: 30% | Se fera naturellement avec les tests de charge (3.3) |

---

## Niveau 5 -- Strategique / Gouvernance

**Avancement global : ~30%**

| # | Item | A quoi ca sert | Verdict | Statut | Detail |
|---|------|---------------|---------|--------|--------|
| 5.1 | Documentation architecture | Permettre a un nouveau developpeur ou a l'IT groupe de comprendre le systeme | FAIT | :white_check_mark: 80% | ARCHITECTURE.md + CAHIER_TECHNIQUE.md existent. Ajouter un schema d'infra serait un plus |
| 5.2 | Onboarding nouveau site | Document pas-a-pas pour deployer CHAOS sur un nouveau depot/site | FAIRE | :x: 0% | Indispensable pour le multi-sites. Sans ca, chaque deploiement depend de vous |
| 5.3 | Versioning API | Pouvoir modifier l'API sans casser les anciens clients | SUPPRIMER | :large_blue_circle: Reporte | Vous controlez le mobile ET le backend. Inutile tant qu'il n'y a pas de clients externes |
| 5.4 | PCA (Plan de Continuite) | Que se passe-t-il si le serveur brule ? Comment on repart ? | FAIRE | :x: 0% | Document court : ou sont les backups, comment remonter sur un autre serveur, combien de temps ca prend |
| 5.5 | Sortie du shadow IT | Faire reconnaitre officiellement CHAOS par l'IT du groupe | FAIRE | :x: 0% | C'est politique, pas technique. Mais c'est LE point qui debloque tout le reste (budget, support, securite) |

---

## Resume revise

| Niveau | Avancement | Items a faire | Items supprimes/reportes |
|--------|-----------|---------------|------------------------|
| 1 | **~90%** | 2 items restants (HTTPS mobile, test restore) | 2 supprimes (Keycloak, Alembic) |
| 2 | **~30%** | 4 items (CI/CD, alerting, staging, RLS test) | 3 reportes (Grafana, staging, zero-downtime) |
| 3 | **~45%** | 4 items (tests, rotation secrets, astreinte, SLA) | 2 reportes (charge, SLA) |
| 4 | **~40%** | 2 items (pen test, WAF) | 4 supprimes (ClickHouse/Redis/Kafka/K8s) |
| 5 | **~30%** | 3 items (onboarding site, PCA, sortie shadow IT) | 1 supprime (versioning API) |

---

## Focus Cybersecurite -- Ce qui reste a faire

| Priorite | Action | Effort | Statut |
|----------|--------|--------|--------|
| ~~1~~ | ~~Supprimer cle SMS par defaut du code~~ | ~~15 min~~ | :white_check_mark: FAIT 2026-04-03 |
| 2 | Desactiver cleartext mobile (apres HTTPS sur SMS gateway) | 30 min | A FAIRE -- verifier SMS gateway HTTPS d'abord |
| ~~3~~ | ~~Health check sur service app~~ | ~~15 min~~ | :white_check_mark: FAIT 2026-04-03 |
| 4 | WAF (Cloudflare) | 2h | SEMAINE 07/04 |
| 5 | Pen test externe | Budget | A PLANIFIER |
| 6 | Rotation des secrets (procedure) | 1h doc | A FAIRE |

## Focus RGPD -- Ce qui reste a faire

| Priorite | Action | Effort | Statut |
|----------|--------|--------|--------|
| ~~1~~ | ~~DPIA (Analyse d'impact)~~ | ~~1-2 jours~~ | :white_check_mark: REDIGE `docs/operations/DPIA_CHAOS_PLATFORM.md` -- a valider par juriste |
| 2 | Designer un DPO | Decision | A FAIRE -- obligatoire si +250 employes ou traitement grande echelle |
| ~~3~~ | ~~Registre des traitements format CNIL~~ | ~~1 jour~~ | :white_check_mark: REDIGE `docs/operations/REGISTRE_TRAITEMENTS_CNIL.md` |
| ~~4~~ | ~~Procedure notification breach~~ | ~~2h doc~~ | :white_check_mark: REDIGE `docs/operations/PROCEDURE_NOTIFICATION_BREACH.md` |
| 5 | Droit a la portabilite | 1 jour dev | A FAIRE -- endpoint export donnees perso format standard |
| 6 | Notice/consentement app mobile | 1 jour dev | A FAIRE -- informer les chauffeurs du tracking GPS |

---

---

## Documentation -- Aide en ligne

**La page Aide (?) doit etre mise a jour avec les modes operatoires de toutes les fonctionnalites.**

| # | Section a documenter | Statut |
|---|---------------------|--------|
| 1 | Modifier stops en live (retirer/ajouter PDV) | :white_check_mark: FAIT |
| 2 | Alertes operationnelles | :white_check_mark: FAIT |
| 3 | Chauffeurs base (CRUD) | A FAIRE |
| 4 | Fenetres de livraison par activite (SEC/FRAIS/GEL) | A FAIRE |
| 5 | Upload plan du site PDV (PDF) | A FAIRE |
| 6 | Filtre jour/nuit sur la carte planification | A FAIRE |
| 7 | Gestion des vehicules (flotte propre) | A FAIRE |
| 8 | Booking approvisionneurs | A FAIRE |
| 9 | Controle temperature | A FAIRE |
| 10 | Tri vidanges | A FAIRE |
| 11 | Suivi consignes bieres | A FAIRE |
| 12 | Declarations chauffeur (anomalies/accidents) | A FAIRE |
| 13 | Inspections vehicules | A FAIRE |
| 14 | Reprises contenants | A FAIRE |
| 15 | CMR / Lettre de voiture | A FAIRE |
| 16 | Poste de garde | A FAIRE |

---

*Revise le 2026-04-09. Corrections code + documentation operationnelle appliquees. Version pragmatique.*
