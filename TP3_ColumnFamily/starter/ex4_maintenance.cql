-- TP3 - Exercice 4 : Compaction et Maintenance
-- Use Case : SmartGrid DZ

USE smartgrid;

-- ─── 4.1 : Choix de la stratégie de compaction ────────────────────────────────
--
-- Trois stratégies principales :
--
-- ┌─────────────────────────────────┬──────────────────────────────────────────┐
-- │ Stratégie                       │ Cas d'usage                              │
-- ├─────────────────────────────────┼──────────────────────────────────────────┤
-- │ STCS (SizeTieredCompactionStrat)│ Écriture intensive, pas de TTL fort      │
-- │ LCS  (LeveledCompactionStrategy)│ Lecture intensive, peu d'écritures       │
-- │ TWCS (TimeWindowCompaction...)  │ Séries temporelles + TTL → NOTRE CAS     │
-- └─────────────────────────────────┴──────────────────────────────────────────┘
--
-- Pourquoi TWCS pour SmartGrid DZ ?
--   • Les mesures IoT sont écrites par ordre chronologique et expirées par TTL.
--   • TWCS regroupe les SSTables par fenêtre temporelle (ex. 1 jour).
--   • Quand une fenêtre est entièrement expirée, Cassandra supprime la SSTable
--     en bloc sans la relire → suppression O(1) au lieu de O(N).
--   • Évite les write amplifications de STCS et le coût CPU de LCS.


-- ─── 4.2 : Configurer TWCS pour chaque table ──────────────────────────────────

-- mesures_par_capteur : TTL 90 jours → fenêtre de 1 jour (équilibre entre
-- nombre de fichiers ouverts et granularité d'expiration).
ALTER TABLE mesures_par_capteur
WITH compaction = {
  'class'                   : 'TimeWindowCompactionStrategy',
  'compaction_window_unit'  : 'DAYS',
  'compaction_window_size'  : 1,
  'unsafe_aggressive_sstable_expiration': 'true'  -- supprime les SSTables
                                                   -- entièrement expirées sans merge
};

-- alertes_par_wilaya : TTL 1 an → fenêtre de 7 jours (moins de SSTables à gérer,
-- les alertes sont peu volumineuses).
ALTER TABLE alertes_par_wilaya
WITH compaction = {
  'class'                   : 'TimeWindowCompactionStrategy',
  'compaction_window_unit'  : 'DAYS',
  'compaction_window_size'  : 7,
  'unsafe_aggressive_sstable_expiration': 'true'
};

-- agregats_horaires : TTL 5 ans → fenêtre de 30 jours (volume très faible,
-- inutile d'avoir une granularité fine).
ALTER TABLE agregats_horaires
WITH compaction = {
  'class'                   : 'TimeWindowCompactionStrategy',
  'compaction_window_unit'  : 'DAYS',
  'compaction_window_size'  : 30,
  'unsafe_aggressive_sstable_expiration': 'true'
};


-- ─── 4.3 : Vérifier les TTL — lignes expirant dans les 7 prochains jours ──────
-- Cassandra ne propose pas de requête native "combien de lignes expirent dans N jours".
-- On peut approximer avec TTL() qui retourne les secondes restantes avant expiration.

-- Lignes dont le TTL restant est ≤ 7 jours (604 800 secondes) :
SELECT capteur_id, date_jour, timestamp,
       TTL(tension_v)    AS ttl_restant_secondes,
       WRITETIME(tension_v) AS ecrit_le
FROM mesures_par_capteur
WHERE capteur_id = 550e8400-e29b-41d4-a716-446655440000
  AND date_jour  = '2025-06-01'
  AND TTL(tension_v) <= 604800    -- filtre applicatif (ALLOW FILTERING implicite)
ALLOW FILTERING;
-- Note : ce type de requête est acceptable en MAINTENANCE (exécution ponctuelle,
-- hors production), pas en flux applicatif continu.

-- Alternative recommandée : compter les lignes dont WRITETIME + TTL_defaut < now+7j.
-- Cela se fait côté application (Python/Spark) en lisant les SSTables directement
-- via sstableutil ou cassandra-medusa.


-- ─── 4.4 : Analyser et corriger une partition "hot" ───────────────────────────
--
-- Détection :
--   1. nodetool tpstats        → saturation du thread pool "Read"
--   2. nodetool cfstats smartgrid.mesures_par_capteur
--                              → "Maximum live cells per slice" trop élevé
--   3. cassandra-stress / DataStax OpsCenter → carte de chaleur des partitions
--   4. Requête de diagnostic : mesurer la taille d'une partition suspecte.

-- Estimation de la taille d'une partition (nombre de cellules) :
SELECT COUNT(*) FROM mesures_par_capteur
WHERE capteur_id = 550e8400-e29b-41d4-a716-446655440000
  AND date_jour  = '2025-06-01';
-- Si COUNT > ~100 000 → partition trop grosse.

--
-- Causes et corrections :
--
-- ┌──────────────────────────┬───────────────────────────────────────────────────┐
-- │ Cause                    │ Correction                                        │
-- ├──────────────────────────┼───────────────────────────────────────────────────┤
-- │ Pas de bucket temporel   │ Ajouter date_jour dans la partition key (déjà fait│
-- │ → partition infinie      │ dans notre schéma)                                │
-- ├──────────────────────────┼───────────────────────────────────────────────────┤
-- │ Capteur très actif        │ Subdiviser : bucket par heure si >1 mesure/s     │
-- │ (>86 400 mesures/jour)   │ PRIMARY KEY ((capteur_id, date_jour, heure), ts)  │
-- ├──────────────────────────┼───────────────────────────────────────────────────┤
-- │ Wilaya trop large comme  │ Ajouter date_jour en clé de partition (déjà fait) │
-- │ partition key unique     │ + équilibrer avec l'ID commune si besoin          │
-- ├──────────────────────────┼───────────────────────────────────────────────────┤
-- │ Skew de distribution     │ Ajouter un "salt" (ex. capteur_id % 10) pour      │
-- │ (certains nœuds surchargés│ redistribuer les tokens sur l'anneau             │
-- └──────────────────────────┴───────────────────────────────────────────────────┘

-- Commande de rééquilibrage (ligne de commande) :
-- nodetool repair smartgrid
-- nodetool cleanup smartgrid

-- Vérification de l'anneau et de la distribution :
-- nodetool ring
-- nodetool status
