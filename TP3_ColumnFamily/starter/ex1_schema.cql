-- TP3 - Exercice 1 : Schéma Cassandra
-- Use Case : SmartGrid DZ - IoT Électrique

-- ─── 1.1 : Créer le Keyspace ──────────────────────────────────────────────────
-- NetworkTopologyStrategy recommandée en production (multi-datacenter).
-- Pour le TP local on utilise SimpleStrategy RF=1 ; décommenter NTS pour prod.

CREATE KEYSPACE IF NOT EXISTS smartgrid
WITH replication = {
  'class': 'NetworkTopologyStrategy',
  'datacenter1': 3          -- RF=3 pour la production
  -- 'datacenter1': 1       -- RF=1 pour le TP local / dev
}
AND durable_writes = true;

USE smartgrid;

-- ─── 1.2 : Table mesures_par_capteur ──────────────────────────────────────────
-- Requête cible : "Toutes les mesures du capteur X entre T1 et T2"
--
-- Choix de la PRIMARY KEY :
--   Partition Key  → (capteur_id, date_jour)
--     • capteur_id  : 10 000 capteurs → répartition naturelle sur les nœuds.
--     • date_jour   : bucket quotidien → plafonne la taille de chaque partition
--                     (max 1 440 lignes/capteur/jour à 1 mesure/min).
--                     Sans ce bucket, une partition grossit indéfiniment
--                     et crée des "hot partitions".
--   Clustering Key → timestamp DESC
--     • Trie les mesures du plus récent au plus ancien dans la partition.
--     • Permet un accès O(1) à la dernière mesure (LIMIT 1).
--     • Supporte efficacement les requêtes par plage : timestamp >= T1.

CREATE TABLE IF NOT EXISTS mesures_par_capteur (
  capteur_id    UUID,
  date_jour     DATE,         -- bucket par jour (évite les hot partitions)
  timestamp     TIMESTAMP,
  wilaya        TEXT,
  commune       TEXT,
  tension_v     FLOAT,
  courant_a     FLOAT,
  puissance_kw  FLOAT,
  frequence_hz  FLOAT,
  temperature   FLOAT,
  alerte        BOOLEAN,
  code_alerte   TEXT,
  PRIMARY KEY ((capteur_id, date_jour), timestamp)
) WITH CLUSTERING ORDER BY (timestamp DESC)
  AND default_time_to_live = 7776000   -- 90 jours (90 × 24 × 3600)
  AND compaction = {
    'class'                  : 'TimeWindowCompactionStrategy',
    'compaction_window_unit' : 'DAYS',
    'compaction_window_size' : 1
  }
  AND comment = 'Mesures brutes par capteur — TTL 90 jours';


-- ─── 1.3 : Table alertes_par_wilaya ───────────────────────────────────────────
-- Requête cible : "Toutes les alertes de la wilaya Alger aujourd'hui"
--
-- Partition Key  → (wilaya, date_jour)
--   • wilaya seul serait trop large (toutes les alertes de toute la vie).
--   • Le bucket par jour garantit des partitions de taille raisonnable.
--   • 5 wilayas × 365 jours = 1 825 partitions/an → distribution saine.
-- Clustering Key → timestamp DESC, capteur_id
--   • DESC : alertes les plus récentes en tête.
--   • capteur_id : unicité si deux alertes au même instant.

CREATE TABLE IF NOT EXISTS alertes_par_wilaya (
  wilaya        TEXT,
  date_jour     DATE,
  timestamp     TIMESTAMP,
  capteur_id    UUID,
  code_alerte   TEXT,
  description   TEXT,
  gravite       INT,          -- 1=info | 2=warning | 3=critique
  resolue       BOOLEAN,
  PRIMARY KEY ((wilaya, date_jour), timestamp, capteur_id)
) WITH CLUSTERING ORDER BY (timestamp DESC, capteur_id ASC)
  AND default_time_to_live = 31536000  -- 1 an (365 × 24 × 3600)
  AND compaction = {
    'class'                  : 'TimeWindowCompactionStrategy',
    'compaction_window_unit' : 'DAYS',
    'compaction_window_size' : 1
  }
  AND comment = 'Alertes par wilaya et par jour — TTL 1 an';


-- ─── 1.4 : Table agregats_horaires ────────────────────────────────────────────
-- Requête cible : "Consommation moyenne par heure pour le dashboard wilaya"
--
-- Partition Key  → wilaya
--   • 5 wilayas seulement → partitions légères (8 760 lignes/an maxi).
--   • Les dashboards interrogent toujours une wilaya à la fois.
-- Clustering Key → date_heure DESC
--   • Tri décroissant : l'heure courante remonte en premier (LIMIT 24 = dernier jour).

CREATE TABLE IF NOT EXISTS agregats_horaires (
  wilaya            TEXT,
  date_heure        TIMESTAMP,   -- ex. 2025-06-01 14:00:00
  nb_capteurs       INT,
  puissance_moy_kw  FLOAT,
  puissance_max_kw  FLOAT,
  puissance_min_kw  FLOAT,
  tension_moy_v     FLOAT,
  nb_alertes        INT,
  PRIMARY KEY (wilaya, date_heure)
) WITH CLUSTERING ORDER BY (date_heure DESC)
  AND default_time_to_live = 157680000  -- 5 ans (5 × 365 × 24 × 3600)
  AND compaction = {
    'class'                  : 'TimeWindowCompactionStrategy',
    'compaction_window_unit' : 'DAYS',
    'compaction_window_size' : 7        -- fenêtre hebdomadaire pour les agrégats
  }
  AND comment = 'Agrégats horaires par wilaya — TTL 5 ans';


-- ─── Vérification ─────────────────────────────────────────────────────────────
DESCRIBE TABLES;
