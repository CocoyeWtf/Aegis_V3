# Journal des exercices de restauration (STIME B2)

Consigner ici chaque test de restauration (`restore_test.sh`).

| Date | Dump testé | Durée | RPO constaté | Résultat | Opérateur | Remarques |
|------|-----------|-------|--------------|----------|-----------|-----------|
| 2026-07-08 | cmro_20260708_193154.dump.age (12 Mo) | 21 s | < 1 h (dump du jour) | ✅ OK — 187 users, 170 PDV, 102 tables | Claude Code (session déploiement STIME) | 1 erreur pg_restore ignorée : FK tour_surcharges inapplicable à cause de 2 lignes orphelines héritées (surcharge_type_id=0, cf. AUDIT_2026-07-08.md) — décision de nettoyage en attente |
