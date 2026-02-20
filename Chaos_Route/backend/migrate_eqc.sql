-- Migration EQP → EQC (Equivalent Combi)
-- Les colonnes DB gardent leurs noms (eqp_count, capacity_eqp, etc.)
-- mais stockent désormais des EQC. 1 EQP = 1.64 EQC.
--
-- Exécuter sur le serveur ET en local :
--   sqlite3 app.db < migrate_eqc.sql

-- Contrats : capacité par défaut à 50 EQC
UPDATE contracts SET capacity_eqp = 50;

-- PDVs : convertir sas_capacity de EQP en EQC (×1.64, arrondi)
UPDATE pdvs SET sas_capacity = ROUND(sas_capacity * 1.64) WHERE sas_capacity IS NOT NULL;

-- Pas de conversion des volumes : la DB sera vidée,
-- les prochains imports seront directement en EQC.
