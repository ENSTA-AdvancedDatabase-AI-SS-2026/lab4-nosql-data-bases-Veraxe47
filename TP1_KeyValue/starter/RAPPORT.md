# RAPPORT.md — TP1 Redis : Système de Cache E-commerce
## ShopFast — Plateforme E-commerce Algérienne

---

## 1. Comparaison de performance : Cache HIT vs MISS

### Méthode de mesure

Le benchmark a été réalisé sur l'exercice 3 (Cache-Aside) avec 10 itérations sur le produit #1.  
La base de données simulée introduit un délai fixe de **2 secondes** par requête.

### Résultats observés

| Scénario     | Temps moyen | Occurrences |
|--------------|-------------|-------------|
| Cache MISS   | ~2 010 ms   | 1           |
| Cache HIT    | ~1 ms       | 9           |
| **Taux hit** | **90 %**    |             |

### Interprétation

Le gain est de l'ordre de **×2000** entre un MISS et un HIT. Dès le deuxième appel, Redis répond en moins d'une milliseconde car la valeur est en mémoire vive, alors qu'un accès PostgreSQL simulé coûte 2 secondes. En production, même sans le `time.sleep()`, un accès réseau + requête SQL représente typiquement 5 à 50 ms, contre < 1 ms pour Redis.

Le taux de hit de 90 % sur 10 itérations illustre le bénéfice immédiat du Cache-Aside : **une seule miss initiale, puis toutes les requêtes suivantes sont servies depuis le cache** jusqu'à expiration du TTL (600 s par défaut).

---

## 2. Justification des choix de modélisation

### Ex1 — Structures de données

| Besoin métier | Structure Redis | Justification |
|---|---|---|
| Fiche produit (nom, prix, stock…) | **Hash** (`product:{id}`) | Accès par champ (`HGET`), mise à jour partielle possible sans réécrire tout l'objet |
| Panier utilisateur | **Hash** (`cart:{user_id}`) | Clé = product_id, valeur = quantité ; `HINCRBY` permet d'incrémenter atomiquement |
| Historique de navigation | **List** (`history:{user_id}`) | `LPUSH` + `LTRIM` = fenêtre glissante efficace en O(1) ; ordre chronologique naturel |
| Produits par catégorie | **Set** (`category:{name}`) | Pas de doublon, `SINTER` natif pour les intersections (multi-catégories) |

### Ex3 — Cache-Aside

- La sérialisation JSON permet de stocker n'importe quel dict Python comme une String Redis.
- `SETEX` (SET + EXpire atomique) garantit qu'aucune clé ne reste sans TTL.
- L'invalidation explicite (`DEL`) est déclenchée après toute mise à jour en base, ce qui évite de servir des données périmées.

### Ex4 — Sorted Set pour le classement

- `ZINCRBY` est atomique : plusieurs workers peuvent enregistrer des ventes simultanément sans race condition.
- `ZREVRANGE` + `WITHSCORES` retourne les produits triés du plus vendu au moins vendu en O(log N + M).
- `ZREVRANK` donne le rang 0-based ; on ajoute 1 pour l'affichage 1-based.

---

## 3. Réponses aux questions de réflexion

### Q1 — Que se passe-t-il si Redis redémarre ?

Deux comportements possibles selon la configuration :

- **Sans persistence** (`redis.conf` par défaut sans `save`/`appendonly`) : toutes les données en mémoire sont perdues. À la reprise, le cache est vide : **100 % de MISS** jusqu'à ce qu'il se re-remplisse organiquement. Les performances chutent temporairement, mais l'application reste correcte car elle retombe sur la base PostgreSQL.

- **Avec persistence** (notre `redis.conf` active `appendonly yes` + `appendfsync everysec`) : Redis rejoue le journal AOF au démarrage et récupère la quasi-totalité des données (perte maximale d'1 seconde). Le cache est ainsi restauré automatiquement.

> **Bonne pratique :** concevoir l'application pour qu'elle fonctionne dégradément sans Redis (fallback sur la DB), et activer l'AOF en production pour réduire le cold-start.

---

### Q2 — Comment gérer la cohérence cache/DB en cas d'accès concurrent ?

Le problème classique est le **"cache stampede"** (ou dog-pile effect) : si le TTL expire et que 100 requêtes arrivent simultanément, elles font toutes un MISS et frappent la DB en même temps.

Stratégies :

1. **Verrou distribué (mutex)** : avant d'aller en DB, poser une clé Redis temporaire (`SET lock:{id} 1 NX EX 5`). Seul le premier thread va en DB et recharge le cache ; les autres attendent ou retournent la donnée périmée.

2. **Cache probabiliste / early re-computation** : recharger le cache quelques secondes *avant* l'expiration réelle, avec une petite probabilité croissante à l'approche du TTL (algorithme XFetch).

3. **Write-through** : à chaque écriture en DB, mettre à jour Redis en même temps. Évite les MISS après un update, mais couple écriture et cache.

4. **Invalidation par événement** : utiliser un bus (Kafka, Redis Streams) pour propager les invalidations plutôt que de se reposer uniquement sur le TTL.

> Dans notre implémentation, `invalidate_product_cache()` doit être appelé immédiatement après tout `UPDATE` en base pour garantir la cohérence.

---

### Q3 — Quand un TTL trop court est-il problématique ?

Un TTL trop court réduit le taux de hit et peut provoquer :

| Problème | Description |
|---|---|
| **Surcharge de la DB** | Les données expirent avant d'être réutilisées ; chaque requête repart en base |
| **Cache stampede** | Si beaucoup de clés expirent en même temps (ex : rechargement de catalogue à minuit) |
| **Latence perçue élevée** | L'utilisateur subit fréquemment les 2 s du MISS alors que la donnée n'a pas changé |
| **Coût réseau / CPU** | Re-sérialisation et stockage répétés pour des données stables |

**Exemples concrets :**
- Une fiche produit dont le prix ne change qu'une fois par jour → TTL de 60 s = inutilement court.
- Un stock mis à jour en temps réel → TTL de 600 s = trop long, le stock affiché sera faux.

**Règle générale :** le TTL doit être calibré sur la **fréquence de mise à jour** de la donnée, pas sur une valeur arbitraire. Coupler TTL raisonnable + invalidation explicite est la meilleure approche.

---

## 4. Bonus — Rate-limiting par utilisateur

Pour implémenter un rate-limiter (ex : max 100 requêtes/minute par utilisateur) :

```python
def is_rate_limited(r, user_id: str, limit: int = 100, window: int = 60) -> bool:
    key = f"rate:{user_id}"
    pipe = r.pipeline()
    pipe.incr(key)
    pipe.expire(key, window)
    results = pipe.execute()
    count = results[0]
    return count > limit
```

- `INCR` + `EXPIRE` dans un pipeline : atomique et O(1).
- Si `count > limit`, on renvoie HTTP 429 Too Many Requests.
- La clé expire automatiquement après la fenêtre glissante.

---

*Rapport rédigé dans le cadre du TP1 — Module Redis, Université / École d'Ingénieurs.*
