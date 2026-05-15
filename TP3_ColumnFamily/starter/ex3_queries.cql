-- TP3 - Exercice 3 : Requêtes CQL
-- Use Case : SmartGrid DZ

USE smartgrid;

-- ─── 3.1 : Mesures d'un capteur sur les 6 dernières heures ────────────────────
-- La partition (capteur_id, date_jour) est obligatoire.
-- La plage de timestamps est un filtre efficace sur la clustering key.

SELECT capteur_id, timestamp, tension_v, courant_a, puissance_kw, alerte
FROM mesures_par_capteur
WHERE capteur_id = 550e8400-e29b-41d4-a716-446655440000  -- remplacer par l'UUID réel
  AND date_jour  = '2025-06-01'
  AND timestamp >= '2025-06-01 08:00:00+0000'
  AND timestamp <= '2025-06-01 14:00:00+0000';


-- ─── 3.2 : Dernière mesure de chaque capteur d'une wilaya ─────────────────────
-- Cassandra ne supporte pas GROUP BY sur des partitions différentes.
-- La solution correcte : interroger chaque capteur individuellement avec LIMIT 1.
-- En pratique, l'application maintient la liste des capteurs par wilaya (Redis,
-- table dédiée, ou variable applicative) et effectue des requêtes parallèles.

-- Requête pour UN capteur connu (répéter pour chaque capteur de la wilaya) :
SELECT capteur_id, timestamp, tension_v, puissance_kw, alerte
FROM mesures_par_capteur
WHERE capteur_id = 550e8400-e29b-41d4-a716-446655440000
  AND date_jour  = '2025-06-01'
LIMIT 1;   -- CLUSTERING ORDER BY timestamp DESC → retourne la mesure la plus récente


-- ─── 3.3 : Capteurs en alerte dans la wilaya "Alger" aujourd'hui ──────────────
-- On utilise la table alertes_par_wilaya dédiée à cette requête.
-- Pas besoin de ALLOW FILTERING : wilaya + date_jour forment la partition key.

-- Nombre total d'alertes :
SELECT COUNT(*) AS nb_alertes_alger
FROM alertes_par_wilaya
WHERE wilaya    = 'Alger'
  AND date_jour = '2025-06-01';

-- Liste des alertes (les plus récentes d'abord, grâce au CLUSTERING ORDER DESC) :
SELECT timestamp, capteur_id, code_alerte, description, gravite, resolue
FROM alertes_par_wilaya
WHERE wilaya    = 'Alger'
  AND date_jour = '2025-06-01'
LIMIT 100;


-- ─── 3.4 : Consommation totale par heure sur une journée (dashboard) ──────────
-- La table agregats_horaires stocke des données pré-calculées par wilaya.
-- Requête légère et déterministe : 24 lignes maximum par wilaya par jour.

SELECT date_heure,
       nb_capteurs,
       puissance_moy_kw,
       puissance_max_kw,
       puissance_min_kw,
       nb_alertes
FROM agregats_horaires
WHERE wilaya = 'Alger'
  AND date_heure >= '2025-06-01 00:00:00+0000'
  AND date_heure <  '2025-06-02 00:00:00+0000';


-- ─── 3.5 : Détection d'anomalie — tension hors plage 200–240V ─────────────────
-- Les capteurs en anomalie ont déjà code_alerte = 'VOLT_OOB' dans alertes_par_wilaya.
-- On interroge cette table plutôt que de scanner mesures_par_capteur.

SELECT capteur_id, timestamp, description
FROM alertes_par_wilaya
WHERE wilaya      = 'Alger'
  AND date_jour   = '2025-06-01'
  AND code_alerte = 'VOLT_OOB'   -- filtre sur clustering key secondaire
LIMIT 200;

-- Remarque : si on voulait filtrer sur tension_v directement dans
-- mesures_par_capteur, il faudrait ALLOW FILTERING (voir 3.7 — à éviter).


-- ─── 3.6 : Top 10 capteurs les plus actifs cette semaine ──────────────────────
-- Cassandra ne trie pas entre partitions.
-- Stratégie recommandée : pré-calculer dans une table dédiée (materialized view
-- ou compteur applicatif) ou agréger côté application après COUNT(*) par capteur.
-- Exemple avec compteur par capteur (table à créer) :

-- Option A — avec une table de compteurs (recommandée en production) :
-- SELECT capteur_id, nb_mesures_semaine
-- FROM compteurs_capteur
-- WHERE semaine = '2025-W23'
-- ORDER BY nb_mesures_semaine DESC   ← possible si clustering key
-- LIMIT 10;

-- Option B — agrégation applicative (acceptable pour le TP) :
-- On récupère COUNT(*) pour chaque capteur sur chaque jour de la semaine,
-- puis on trie en Python/Java.

-- Requête par capteur + jour (à répéter pour chaque (capteur, jour)) :
SELECT capteur_id, COUNT(*) AS nb_mesures
FROM mesures_par_capteur
WHERE capteur_id = 550e8400-e29b-41d4-a716-446655440000
  AND date_jour  = '2025-06-01';


-- ─── 3.7 : ALLOW FILTERING — pourquoi l'éviter ? ─────────────────────────────

-- ❌ REQUÊTE DANGEREUSE (ne pas utiliser en production) :
-- SELECT * FROM mesures_par_capteur
-- WHERE wilaya = 'Alger'           -- wilaya n'est PAS dans la partition key
--   AND tension_v < 200
-- ALLOW FILTERING;
--
-- Problèmes :
--   1. Scan complet de TOUTES les partitions sur TOUS les nœuds.
--   2. Latence O(N) avec N = nombre total de lignes → dégradation catastrophique
--      à l'échelle (50 000 lignes/insertion × 5 min = 250 000 lignes, croissant).
--   3. Pression mémoire sur les coordinateurs.
--   4. Cassandra affiche un avertissement dans les logs.

-- ✅ REQUÊTE CORRECTE — utiliser la table dédiée alertes_par_wilaya :
SELECT capteur_id, timestamp, description
FROM alertes_par_wilaya
WHERE wilaya      = 'Alger'
  AND date_jour   = '2025-06-01'
  AND code_alerte = 'VOLT_OOB';
--
-- Cette requête accède à UNE seule partition → latence O(1).
-- C'est la règle fondamentale Cassandra : "Model your queries, not your entities."
