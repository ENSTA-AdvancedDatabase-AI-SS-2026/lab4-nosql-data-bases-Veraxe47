"""
TP5 - Benchmark Comparatif NoSQL
Mesurer les performances de Redis, MongoDB, Cassandra, Neo4j
"""
import time
import statistics
import json
import random
import string
import threading
from typing import Callable, List, Tuple
import redis
from pymongo import MongoClient, InsertOne
from cassandra.cluster import Cluster
from cassandra.query import BatchStatement, BatchType
from neo4j import GraphDatabase

# ─── Utilitaires de mesure ────────────────────────────────────────────────────

def measure_latency(fn: Callable, iterations: int = 1000) -> dict:
    """
    Exécuter fn iterations fois et retourner les statistiques
    """
    latencies = []
    for _ in range(iterations):
        start = time.perf_counter()
        fn()
        latencies.append((time.perf_counter() - start) * 1000)  # en ms

    latencies.sort()
    return {
        "mean_ms": statistics.mean(latencies),
        "p50_ms": latencies[int(0.50 * len(latencies))],
        "p95_ms": latencies[int(0.95 * len(latencies))],
        "p99_ms": latencies[int(0.99 * len(latencies))],
        "max_ms": max(latencies),
        "throughput_rps": 1000 / statistics.mean(latencies)
    }


def print_results(name: str, results: dict):
    print(f"\n{'='*50}")
    print(f" {name}")
    print(f"{'='*50}")
    for k, v in results.items():
        print(f"  {k:20s}: {v:.2f}")


def random_string(length: int = 16) -> str:
    return ''.join(random.choices(string.ascii_lowercase + string.digits, k=length))


# ─── Ex1 : Benchmark Écriture ─────────────────────────────────────────────────

def benchmark_write_redis(n: int = 100_000):
    """
    Insérer n enregistrements dans Redis et mesurer le débit.
    Utilise un pipeline pour maximiser le débit.
    """
    print(f"\n[Redis] Connexion et insertion de {n:,} enregistrements...")
    r = redis.Redis(host='localhost', port=6379, decode_responses=True)
    r.flushdb()  # Nettoyer la base avant le test

    BATCH_SIZE = 1000
    total_start = time.perf_counter()

    # Insertion par batches via pipeline
    for batch_start in range(0, n, BATCH_SIZE):
        pipe = r.pipeline(transaction=False)
        for i in range(batch_start, min(batch_start + BATCH_SIZE, n)):
            key = f"user:{i}"
            value = json.dumps({
                "id": i,
                "name": random_string(8),
                "email": f"user{i}@example.com",
                "score": random.randint(0, 10000),
                "ts": time.time()
            })
            pipe.set(key, value, ex=3600)  # TTL 1h
        pipe.execute()

    elapsed = time.perf_counter() - total_start
    throughput = n / elapsed

    print(f"  ✓ {n:,} enregistrements insérés en {elapsed:.2f}s")
    print(f"  ✓ Débit : {throughput:,.0f} enregistrements/sec")

    # Mesure des latences sur un sous-ensemble
    keys = [f"user:{random.randint(0, n-1)}" for _ in range(1000)]
    idx = [0]

    def point_lookup():
        r.get(keys[idx[0] % len(keys)])
        idx[0] += 1

    stats = measure_latency(point_lookup, iterations=1000)
    print_results("Redis — Latences Point Lookup (post-insert)", stats)

    return {"throughput_rps": throughput, "elapsed_s": elapsed}


def benchmark_write_mongodb(n: int = 100_000):
    """
    Insérer n documents dans MongoDB et mesurer le débit.
    Utilise bulk_write pour maximiser le débit.
    """
    print(f"\n[MongoDB] Connexion et insertion de {n:,} documents...")
    client = MongoClient("mongodb://admin:admin123@localhost:27017/")
    db = client["benchmark"]
    col = db["users"]
    col.drop()  # Nettoyer avant le test
    col.create_index("id")
    col.create_index("score")

    BATCH_SIZE = 1000
    total_start = time.perf_counter()

    for batch_start in range(0, n, BATCH_SIZE):
        operations = []
        for i in range(batch_start, min(batch_start + BATCH_SIZE, n)):
            operations.append(InsertOne({
                "id": i,
                "name": random_string(8),
                "email": f"user{i}@example.com",
                "score": random.randint(0, 10000),
                "ts": time.time(),
                "tags": [random_string(4) for _ in range(3)]
            }))
        col.bulk_write(operations, ordered=False)

    elapsed = time.perf_counter() - total_start
    throughput = n / elapsed

    print(f"  ✓ {n:,} documents insérés en {elapsed:.2f}s")
    print(f"  ✓ Débit : {throughput:,.0f} documents/sec")

    # Mesure des latences sur un sous-ensemble
    sample_ids = [random.randint(0, n - 1) for _ in range(1000)]
    idx = [0]

    def point_lookup():
        col.find_one({"id": sample_ids[idx[0] % len(sample_ids)]})
        idx[0] += 1

    stats = measure_latency(point_lookup, iterations=1000)
    print_results("MongoDB — Latences Point Lookup (post-insert)", stats)

    client.close()
    return {"throughput_rps": throughput, "elapsed_s": elapsed}


def benchmark_write_cassandra(n: int = 100_000):
    """
    Insérer n rows dans Cassandra et mesurer le débit.
    Utilise des UNLOGGED BATCH pour les performances.
    """
    print(f"\n[Cassandra] Connexion et insertion de {n:,} lignes...")
    cluster = Cluster(['localhost'])
    session = cluster.connect()

    # Créer keyspace et table
    session.execute("""
        CREATE KEYSPACE IF NOT EXISTS benchmark
        WITH replication = {'class': 'SimpleStrategy', 'replication_factor': '1'}
    """)
    session.set_keyspace('benchmark')
    session.execute("DROP TABLE IF EXISTS users")
    session.execute("""
        CREATE TABLE users (
            id       int PRIMARY KEY,
            name     text,
            email    text,
            score    int,
            ts       double
        )
    """)

    insert_stmt = session.prepare(
        "INSERT INTO users (id, name, email, score, ts) VALUES (?, ?, ?, ?, ?)"
    )

    BATCH_SIZE = 50   # Cassandra préfère des petits batchs non logués
    total_start = time.perf_counter()

    for batch_start in range(0, n, BATCH_SIZE):
        batch = BatchStatement(batch_type=BatchType.UNLOGGED)
        for i in range(batch_start, min(batch_start + BATCH_SIZE, n)):
            batch.add(insert_stmt, (
                i,
                random_string(8),
                f"user{i}@example.com",
                random.randint(0, 10000),
                time.time()
            ))
        session.execute(batch)

    elapsed = time.perf_counter() - total_start
    throughput = n / elapsed

    print(f"  ✓ {n:,} lignes insérées en {elapsed:.2f}s")
    print(f"  ✓ Débit : {throughput:,.0f} lignes/sec")

    # Mesure des latences point lookup
    sample_ids = [random.randint(0, n - 1) for _ in range(1000)]
    select_stmt = session.prepare("SELECT * FROM users WHERE id = ?")
    idx = [0]

    def point_lookup():
        session.execute(select_stmt, (sample_ids[idx[0] % len(sample_ids)],))
        idx[0] += 1

    stats = measure_latency(point_lookup, iterations=1000)
    print_results("Cassandra — Latences Point Lookup (post-insert)", stats)

    cluster.shutdown()
    return {"throughput_rps": throughput, "elapsed_s": elapsed}


# ─── Ex2 : Benchmark Lecture ─────────────────────────────────────────────────

def benchmark_read_redis():
    """
    Point lookup (GET), range via ZRANGE, complex via pipeline multi-get.
    Suppose que les données ont été insérées par benchmark_write_redis().
    """
    print("\n[Redis] Benchmarks de lecture...")
    r = redis.Redis(host='localhost', port=6379, decode_responses=True)

    # --- Peupler un Sorted Set pour les range queries ---
    n = 10_000
    pipe = r.pipeline(transaction=False)
    for i in range(n):
        pipe.zadd("scores", {f"user:{i}": random.randint(0, 10000)})
    pipe.execute()

    # 1. Point lookup — GET simple
    sample_keys = [f"user:{random.randint(0, n-1)}" for _ in range(1000)]
    idx = [0]

    def point_lookup():
        r.get(sample_keys[idx[0] % len(sample_keys)])
        idx[0] += 1

    stats_point = measure_latency(point_lookup, iterations=1000)
    print_results("Redis — Point Lookup (GET)", stats_point)

    # 2. Range query — ZRANGE par score
    def range_query():
        r.zrangebyscore("scores", 1000, 5000, start=0, num=100)

    stats_range = measure_latency(range_query, iterations=1000)
    print_results("Redis — Range Query (ZRANGE)", stats_range)

    # 3. Complex — pipeline multi-get de 10 clés aléatoires
    def complex_query():
        pipe = r.pipeline(transaction=False)
        for k in random.choices(sample_keys, k=10):
            pipe.get(k)
        pipe.execute()

    stats_complex = measure_latency(complex_query, iterations=1000)
    print_results("Redis — Complex Query (pipeline multi-get x10)", stats_complex)

    return {
        "point_lookup": stats_point,
        "range_query": stats_range,
        "complex_query": stats_complex
    }


def benchmark_read_mongodb():
    """
    find_one (point lookup), find avec range, aggregate pipeline.
    Suppose que les données ont été insérées par benchmark_write_mongodb().
    """
    print("\n[MongoDB] Benchmarks de lecture...")
    client = MongoClient("mongodb://admin:admin123@localhost:27017/")
    col = client["benchmark"]["users"]
    n = col.count_documents({})
    if n == 0:
        print("  ⚠ Collection vide. Lancez benchmark_write_mongodb() d'abord.")
        client.close()
        return {}

    sample_ids = [random.randint(0, n - 1) for _ in range(1000)]
    idx = [0]

    # 1. Point lookup — find_one par id indexé
    def point_lookup():
        col.find_one({"id": sample_ids[idx[0] % len(sample_ids)]})
        idx[0] += 1

    stats_point = measure_latency(point_lookup, iterations=1000)
    print_results("MongoDB — Point Lookup (find_one)", stats_point)

    # 2. Range query — find par plage de score
    def range_query():
        lo = random.randint(0, 8000)
        list(col.find({"score": {"$gte": lo, "$lte": lo + 2000}}, limit=50))

    stats_range = measure_latency(range_query, iterations=1000)
    print_results("MongoDB — Range Query (find score range)", stats_range)

    # 3. Complex — aggregate pipeline : moyenne des scores par tranche
    def aggregate_query():
        list(col.aggregate([
            {"$bucket": {
                "groupBy": "$score",
                "boundaries": [0, 2000, 4000, 6000, 8000, 10001],
                "default": "Other",
                "output": {"count": {"$sum": 1}, "avg_score": {"$avg": "$score"}}
            }}
        ]))

    stats_agg = measure_latency(aggregate_query, iterations=200)
    print_results("MongoDB — Complex Query (aggregate pipeline)", stats_agg)

    client.close()
    return {
        "point_lookup": stats_point,
        "range_query": stats_range,
        "aggregate": stats_agg
    }


# ─── Ex3 : Charge concurrente ─────────────────────────────────────────────────

def benchmark_concurrent(db_fn: Callable, n_clients: int = 50, requests_per_client: int = 200):
    """
    Lancer n_clients threads simultanés.
    Chaque thread effectue requests_per_client requêtes.
    Mesurer les latences globales et la dégradation vs single client.
    """
    all_latencies = []
    lock = threading.Lock()
    errors = [0]

    def worker():
        local_latencies = []
        for _ in range(requests_per_client):
            try:
                start = time.perf_counter()
                db_fn()
                elapsed_ms = (time.perf_counter() - start) * 1000
                local_latencies.append(elapsed_ms)
            except Exception:
                with lock:
                    errors[0] += 1
        with lock:
            all_latencies.extend(local_latencies)

    # Mesure baseline (single thread)
    baseline_latencies = []
    for _ in range(requests_per_client):
        start = time.perf_counter()
        db_fn()
        baseline_latencies.append((time.perf_counter() - start) * 1000)

    baseline_mean = statistics.mean(baseline_latencies)
    print(f"\n  Baseline (single thread) mean: {baseline_mean:.2f} ms")

    # Lancer n_clients threads simultanés
    wall_start = time.perf_counter()
    threads = [threading.Thread(target=worker) for _ in range(n_clients)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    wall_elapsed = time.perf_counter() - wall_start

    if not all_latencies:
        print("  ⚠ Aucune latence collectée.")
        return {}

    all_latencies.sort()
    total_requests = len(all_latencies)
    concurrent_mean = statistics.mean(all_latencies)
    degradation = (concurrent_mean / baseline_mean - 1) * 100

    results = {
        "n_clients": n_clients,
        "requests_per_client": requests_per_client,
        "total_requests": total_requests,
        "errors": errors[0],
        "wall_time_s": wall_elapsed,
        "throughput_rps": total_requests / wall_elapsed,
        "baseline_mean_ms": baseline_mean,
        "concurrent_mean_ms": concurrent_mean,
        "p50_ms": all_latencies[int(0.50 * len(all_latencies))],
        "p95_ms": all_latencies[int(0.95 * len(all_latencies))],
        "p99_ms": all_latencies[int(0.99 * len(all_latencies))],
        "degradation_pct": degradation
    }

    print_results(f"Concurrent ({n_clients} clients × {requests_per_client} req)", results)
    print(f"\n  ⚡ Dégradation vs baseline : {degradation:+.1f}%")
    if errors[0] > 0:
        print(f"  ⚠ Erreurs : {errors[0]}")

    return results


# ─── Ex4 : Rapport ────────────────────────────────────────────────────────────

RAPPORT_TEMPLATE = """
# RAPPORT.md — Benchmark NoSQL Comparatif

## Tableau de Décision

| Critère              | Redis          | MongoDB        | Cassandra      | Neo4j          |
|----------------------|----------------|----------------|----------------|----------------|
| Débit écriture       | ★★★★★ très élevé | ★★★★☆ élevé  | ★★★★★ très élevé | ★★☆☆☆ moyen |
| Débit lecture        | ★★★★★ très élevé | ★★★★☆ élevé  | ★★★★☆ élevé   | ★★★☆☆ moyen  |
| Requêtes complexes   | ★★☆☆☆ limité  | ★★★★★ agrégats | ★★★☆☆ moyen   | ★★★★★ traversal |
| Scalabilité          | ★★★★☆ cluster | ★★★★☆ sharding | ★★★★★ natif   | ★★★☆☆ limitée |
| **Use case idéal**   | **Cache / Session** | **Documents / API** | **IoT / Logs** | **Graphe / Réseau** |

## Analyse

### Redis
- **Atout** : latences sub-milliseconde grâce au stockage en mémoire.
- **Limite** : volume limité par la RAM disponible.
- **Idéal pour** : caches, sessions, rate-limiting, leaderboards.

### MongoDB
- **Atout** : requêtes expressives (aggregate, $lookup), schéma flexible.
- **Limite** : les agrégations complexes peuvent être lentes sans index appropriés.
- **Idéal pour** : API REST, catalogues produits, CMS.

### Cassandra
- **Atout** : écriture haute disponibilité, partitionnement natif.
- **Limite** : requêtes restreintes au modèle de partition key.
- **Idéal pour** : séries temporelles, IoT, logs d'événements.

### Neo4j
- **Atout** : traversal de graphes, relations N-N efficaces.
- **Limite** : pas optimisé pour l'écriture en masse ni les requêtes tabulaires.
- **Idéal pour** : réseaux sociaux, moteurs de recommandation, détection de fraude.

## Recommandation

Pour un produit standard avec un mix lectures/écritures, **MongoDB** offre le meilleur
équilibre entre flexibilité et performance. Si la latence est critique, combinez avec
**Redis** en cache. Pour les événements à fort volume, ajoutez **Cassandra**.
"""


def write_rapport():
    with open("RAPPORT.md", "w", encoding="utf-8") as f:
        f.write(RAPPORT_TEMPLATE.strip())
    print("\n📄 RAPPORT.md généré avec succès.")


# ─── Main ─────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("🚀 Benchmark NoSQL - Comparatif des 4 technologies")
    print("="*60)

    N = 10_000  # Réduire pour les tests, 100_000 pour la production

    # ── Ex1 : Écriture ──────────────────────────────────────────
    print(f"\n📝 Benchmark Écriture ({N:,} enregistrements)")
    write_results = {}

    try:
        write_results["redis"] = benchmark_write_redis(N)
    except Exception as e:
        print(f"  [Redis] ⚠ Erreur: {e}")

    try:
        write_results["mongodb"] = benchmark_write_mongodb(N)
    except Exception as e:
        print(f"  [MongoDB] ⚠ Erreur: {e}")

    try:
        write_results["cassandra"] = benchmark_write_cassandra(N)
    except Exception as e:
        print(f"  [Cassandra] ⚠ Erreur: {e}")

    # ── Ex2 : Lecture ───────────────────────────────────────────
    print(f"\n📖 Benchmark Lecture (1 000 requêtes)")

    try:
        benchmark_read_redis()
    except Exception as e:
        print(f"  [Redis] ⚠ Erreur: {e}")

    try:
        benchmark_read_mongodb()
    except Exception as e:
        print(f"  [MongoDB] ⚠ Erreur: {e}")

    # ── Ex3 : Charge concurrente ─────────────────────────────────
    print(f"\n⚡ Test Charge Concurrente (50 clients × 200 requêtes)")

    try:
        r = redis.Redis(host='localhost', port=6379, decode_responses=True)
        keys = [f"user:{i}" for i in range(min(N, 1000))]

        def redis_read_fn():
            r.get(random.choice(keys))

        print("\n[Redis] Test charge concurrente...")
        benchmark_concurrent(redis_read_fn, n_clients=50, requests_per_client=200)
    except Exception as e:
        print(f"  [Redis] ⚠ Erreur: {e}")

    try:
        client = MongoClient("mongodb://admin:admin123@localhost:27017/")
        col = client["benchmark"]["users"]
        max_id = max(N - 1, 0)

        def mongo_read_fn():
            col.find_one({"id": random.randint(0, max_id)})

        print("\n[MongoDB] Test charge concurrente...")
        benchmark_concurrent(mongo_read_fn, n_clients=50, requests_per_client=200)
        client.close()
    except Exception as e:
        print(f"  [MongoDB] ⚠ Erreur: {e}")

    # ── Ex4 : Rapport ────────────────────────────────────────────
    write_rapport()

    print("\n✅ Benchmark terminé ! Consultez RAPPORT.md pour l'analyse.")
