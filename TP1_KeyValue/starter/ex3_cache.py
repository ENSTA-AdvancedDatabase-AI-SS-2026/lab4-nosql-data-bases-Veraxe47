"""
TP1 - Exercice 3 : Pattern Cache-Aside avec TTL
Use Case : Cache des pages produits ShopFast
"""
import redis
import json
import time
from typing import Optional

r = redis.Redis(host='localhost', port=6379, decode_responses=True)


def slow_db_get_product(product_id: int) -> Optional[dict]:
    """Simule une requête PostgreSQL lente (2 secondes)"""
    time.sleep(2)
    products = {
        1: {"id": 1, "name": "Samsung Galaxy A54", "price": 65000, "stock": 15},
        2: {"id": 2, "name": "Laptop HP 15-inch", "price": 120000, "stock": 8},
        3: {"id": 3, "name": "Casque JBL Bluetooth", "price": 12000, "stock": 50},
        4: {"id": 4, "name": "Clavier Mécanique", "price": 8000, "stock": 30},
    }
    return products.get(product_id)


def get_product_cached(r, product_id: int, ttl: int = 600) -> Optional[dict]:
    """
    Pattern Cache-Aside :
    1. Chercher dans Redis (clé: "product_cache:{product_id}")
    2. Si MISS → chercher dans slow_db → stocker dans Redis avec TTL
    3. Retourner le produit
    4. Afficher si c'est un HIT ou MISS avec la latence
    """
    start = time.time()
    cache_key = f"product_cache:{product_id}"

    cached = r.get(cache_key)
    if cached is not None:
        elapsed = (time.time() - start) * 1000
        print(f"  CACHE HIT  ({elapsed:.1f}ms)")
        return json.loads(cached)

    # Cache MISS — aller chercher en base
    product = slow_db_get_product(product_id)
    if product is not None:
        r.setex(cache_key, ttl, json.dumps(product))

    elapsed = (time.time() - start) * 1000
    print(f"  CACHE MISS ({elapsed:.1f}ms)")
    return product


def invalidate_product_cache(r, product_id: int):
    """Supprimer le cache d'un produit (après mise à jour en DB)"""
    r.delete(f"product_cache:{product_id}")
    print(f"  Cache invalidé pour le produit #{product_id}")


def benchmark_cache(r, product_id: int, iterations: int = 20):
    """
    Effectuer 'iterations' appels à get_product_cached
    Afficher :
    - Temps moyen cache HIT
    - Temps moyen cache MISS
    - Taux de cache hit (%)
    """
    hit_times = []
    miss_times = []

    for i in range(iterations):
        cache_key = f"product_cache:{product_id}"
        is_cached = r.exists(cache_key)

        start = time.time()
        get_product_cached(r, product_id)
        elapsed = (time.time() - start) * 1000

        if is_cached:
            hit_times.append(elapsed)
        else:
            miss_times.append(elapsed)

    print("\n--- Résultats Benchmark ---")
    if miss_times:
        print(f"  Temps moyen MISS : {sum(miss_times)/len(miss_times):.1f}ms  ({len(miss_times)} occurrence(s))")
    if hit_times:
        print(f"  Temps moyen HIT  : {sum(hit_times)/len(hit_times):.1f}ms  ({len(hit_times)} occurrence(s))")
    total = len(hit_times) + len(miss_times)
    hit_rate = (len(hit_times) / total * 100) if total else 0
    print(f"  Taux de cache hit : {hit_rate:.1f}%")


if __name__ == "__main__":
    r.flushdb()

    print("=== Test Cache-Aside ===")
    print("\nPremier appel (MISS attendu):")
    get_product_cached(r, 1)

    print("\nDeuxième appel (HIT attendu):")
    get_product_cached(r, 1)

    print("\nInvalidation du cache:")
    invalidate_product_cache(r, 1)

    print("\nAprès invalidation (MISS attendu):")
    get_product_cached(r, 1)

    print("\n=== Benchmark (10 itérations) ===")
    r.flushdb()
    benchmark_cache(r, 1, iterations=10)
