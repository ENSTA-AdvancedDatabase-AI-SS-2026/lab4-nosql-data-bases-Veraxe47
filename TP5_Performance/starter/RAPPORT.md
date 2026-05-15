# RAPPORT.md — Benchmark NoSQL Comparatif

## Tableau de Décision

| Critère              | Redis              | MongoDB            | Cassandra          | Neo4j              |
|----------------------|--------------------|--------------------|--------------------|---------------------|
| Débit écriture       | ★★★★★ très élevé  | ★★★★☆ élevé       | ★★★★★ très élevé  | ★★☆☆☆ moyen        |
| Débit lecture        | ★★★★★ très élevé  | ★★★★☆ élevé       | ★★★★☆ élevé       | ★★★☆☆ moyen        |
| Requêtes complexes   | ★★☆☆☆ limité      | ★★★★★ agrégats    | ★★★☆☆ moyen       | ★★★★★ traversal    |
| Scalabilité          | ★★★★☆ cluster     | ★★★★☆ sharding    | ★★★★★ natif        | ★★★☆☆ limitée      |
| **Use case idéal**   | **Cache / Session**| **Documents / API**| **IoT / Logs**     | **Graphe / Réseau** |

---

## Analyse par Technologie

### Redis
- **Atout principal** : latences sub-milliseconde grâce au stockage 100 % en mémoire.
- **Technique utilisée** : pipeline pour les insertions en batch, ZRANGE pour les range queries.
- **Limite** : volume limité par la RAM disponible ; pas de requêtes complexes natives.
- **Idéal pour** : caches, sessions, rate-limiting, leaderboards temps réel.

### MongoDB
- **Atout principal** : requêtes expressives (`aggregate`, `$lookup`), schéma flexible, index riches.
- **Technique utilisée** : `bulk_write` (ordered=False) pour les insertions, `$bucket` pour les agrégations.
- **Limite** : les agrégations complexes peuvent être coûteuses sans index appropriés.
- **Idéal pour** : API REST, catalogues produits, CMS, documents semi-structurés.

### Cassandra
- **Atout principal** : écriture haute disponibilité, partitionnement natif, linéairement scalable.
- **Technique utilisée** : `UNLOGGED BATCH` (taille ≤ 50) pour les insertions performantes.
- **Limite** : les requêtes sont contraintes au modèle de partition key ; pas de JOIN.
- **Idéal pour** : séries temporelles, IoT, logs d'événements à fort débit.

### Neo4j
- **Atout principal** : traversal de graphes efficace, relations N-N naturelles en Cypher.
- **Limite** : pas optimisé pour les écritures en masse ni les requêtes tabulaires classiques.
- **Idéal pour** : réseaux sociaux, moteurs de recommandation, détection de fraude.

---

## Test de Charge Concurrente

Le test simule **50 clients simultanés** effectuant chacun **200 requêtes** (10 000 requêtes au total).

| Métrique              | Description                                              |
|-----------------------|----------------------------------------------------------|
| `throughput_rps`      | Requêtes par seconde mesurées sous charge                |
| `concurrent_mean_ms`  | Latence moyenne sous charge (vs baseline single thread)  |
| `degradation_pct`     | Augmentation de latence due à la concurrence             |
| `p95_ms` / `p99_ms`   | Queue latency — révèle les goulots d'étranglement        |

**Observations typiques :**
- **Redis** : très faible dégradation grâce à son modèle mono-thread event-loop.
- **MongoDB** : dégradation modérée ; le connection pool atténue la contention.
- **Cassandra** : bonne résistance à la charge grâce à son architecture distribuée.

---

## Recommandation Finale

Pour un produit standard avec mix lectures/écritures :

1. **MongoDB** comme base principale — flexibilité + performances équilibrées.
2. **Redis** en cache L1 devant MongoDB — latences sub-ms pour les données chaudes.
3. **Cassandra** si le produit génère des événements ou logs à fort volume.
4. **Neo4j** uniquement si des fonctionnalités graphe (recommandations, réseau social) sont nécessaires.
