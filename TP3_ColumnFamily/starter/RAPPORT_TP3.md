# RAPPORT — TP3 : Cassandra IoT & Séries Temporelles
## SmartGrid DZ — Surveillance de Réseau Électrique

---

## 1. Justification des Partition Keys

### Règle fondamentale appliquée
> Une bonne Partition Key distribue les données uniformément sur les nœuds **et** garantit que toutes les lignes nécessaires à une requête résident dans la même partition.

### Table `mesures_par_capteur` — PK : `(capteur_id, date_jour)`

| Critère | Analyse |
|---|---|
| **Cardinalité** | 10 000 capteurs × N jours → millions de partitions distinctes |
| **Distribution** | Les UUID sont distribués aléatoirement sur l'anneau Murmur3 → pas de skew |
| **Taille de partition** | 1 440 lignes/jour max (1 mesure/min) → bien en dessous du seuil critique (~100 000) |
| **Requête supportée** | `WHERE capteur_id = X AND date_jour = Y AND timestamp BETWEEN T1 AND T2` → accès O(1) |

**Risque de hot partition sans `date_jour` :** Si la clé de partition était juste `capteur_id`, une partition grossirait indéfiniment (1 440 lignes/jour × 365 jours = 525 600 lignes/an par capteur × 10 000 capteurs). La lecture de la partition entière surchargerait un seul nœud. Le bucket quotidien plafonne la partition à 1 440 lignes et distribue la charge sur tous les nœuds au fil du temps.

### Table `alertes_par_wilaya` — PK : `(wilaya, date_jour)`

| Critère | Analyse |
|---|---|
| **Cardinalité** | 5 wilayas × 365 jours = 1 825 partitions/an → faible mais acceptable |
| **Taille de partition** | ~5 % × 10 000 capteurs = 500 alertes/min max → gérable |
| **Requête supportée** | `WHERE wilaya = 'Alger' AND date_jour = '2025-06-01'` → accès O(1) |

**Risque si `wilaya` seul :** Une partition unique par wilaya contiendrait toutes les alertes depuis le déploiement → hot partition garantie. Le bucket `date_jour` limite à une journée d'alertes par partition.

### Table `agregats_horaires` — PK : `wilaya`

| Critère | Analyse |
|---|---|
| **Cardinalité** | 5 partitions (une par wilaya) → très faible |
| **Taille de partition** | 8 760 lignes/an (24h × 365 j) → négligeable |
| **Requête supportée** | `WHERE wilaya = 'Alger' AND date_heure >= ... AND date_heure < ...` → accès O(1) |

Ici le faible volume justifie `wilaya` seul comme partition key : 5 partitions légères, pas de risque de hot partition.

---

## 2. Pourquoi `ALLOW FILTERING` est Dangereux en Production

### Mécanisme interne

Cassandra distribue les données selon le hash de la Partition Key. Quand une requête ne spécifie pas la clé de partition complète, le coordinateur doit interroger **tous les nœuds** et scanner **toutes les partitions** pour trouver les lignes correspondantes.

```sql
-- ❌ DANGEREUX
SELECT * FROM mesures_par_capteur
WHERE wilaya = 'Alger' AND tension_v < 200
ALLOW FILTERING;
```

### Conséquences

| Impact | Description |
|---|---|
| **Latence O(N)** | La durée croît linéairement avec le volume total de données |
| **Surcharge réseau** | Le coordinateur reçoit les réponses de tous les nœuds en même temps |
| **Pression mémoire** | Agrégation en mémoire de potentiellement des millions de lignes |
| **Dégradation globale** | Un seul utilisateur peut saturer le cluster entier |
| **Effet boule de neige** | Plus la table grandit (TTL = 90 jours), plus la requête ralentit |

### Quantification dans notre cas
Après 90 jours : 10 000 capteurs × 1 440 lignes/j × 90 j = **1,296 milliard de lignes** à scanner pour une requête ALLOW FILTERING. À 10 000 lignes/s de scan, cela représente **36 heures de traitement** pour une seule requête.

### Solution correcte
Concevoir une table dédiée à la requête, comme `alertes_par_wilaya` :

```sql
-- ✅ CORRECT — accès à une seule partition
SELECT * FROM alertes_par_wilaya
WHERE wilaya = 'Alger' AND date_jour = '2025-06-01' AND code_alerte = 'VOLT_OOB';
```

C'est la règle fondamentale Cassandra : **"Model your queries, not your entities."** Chaque requête fréquente mérite sa propre table, quitte à dupliquer les données.

---

## 3. Comparaison TWCS vs STCS vs LCS

### Vue d'ensemble

| Stratégie | Déclencheur | Résultat | Espace disque |
|---|---|---|---|
| **STCS** — SizeTieredCompactionStrategy | Quand N SSTables de même taille s'accumulent | Fusion en une grosse SSTable | Temporairement ×2 pendant la compaction |
| **LCS** — LeveledCompactionStrategy | Continu, par niveaux (L0→L1→L2…) | SSTables petites de taille fixe (~160 MB) | Stable (~10× la taille des données) |
| **TWCS** — TimeWindowCompactionStrategy | Fenêtre temporelle expirée | Compaction intra-fenêtre puis suppression bloc | Optimal avec TTL |

### STCS — SizeTieredCompactionStrategy

**Principe :** Regroupe les SSTables par tailles similaires. Quand 4 SSTables de ~10 MB existent, elles fusionnent en une SSTable de ~40 MB.

**Quand l'utiliser :**
- Tables à forte écriture sans TTL strict (logs événementiels sans expiration).
- Workloads write-heavy où la lecture est secondaire.
- Cas de départ quand on ne sait pas encore le profil d'accès.

**Inconvénients pour SmartGrid DZ :**
- Mauvaise gestion des TTL : une SSTable contenant 90 % de données expirées n'est compactée que lors d'un merge avec d'autres SSTables, gaspillant de l'espace disque.
- Amplification des lectures : plusieurs SSTables à parcourir simultanément.

### LCS — LeveledCompactionStrategy

**Principe :** Maintient des niveaux de SSTables (L0, L1, L2…). Chaque niveau a une taille 10× supérieure au précédent. Les SSTables de L1+ ne se chevauchent pas → lecture garantie sur ≤ 2 SSTables.

**Quand l'utiliser :**
- Tables à lecture intensive (dashboards, tables de référence).
- Données stables qui ne changent pas souvent.
- Quand la latence de lecture doit être minimale et prévisible.

**Inconvénients pour SmartGrid DZ :**
- Surcharge CPU et I/O en écriture : le background compaction est intensif.
- Mauvaise gestion des TTL (même problème que STCS).
- Inadapté aux séries temporelles à haute fréquence d'écriture.

### TWCS — TimeWindowCompactionStrategy ✅ Notre choix

**Principe :** Regroupe les SSTables par fenêtres temporelles (ex. 1 jour). Les données d'une fenêtre passée ne sont plus modifiées → compaction intra-fenêtre uniquement. Quand une fenêtre entière est expirée par TTL, la SSTable est supprimée **en bloc sans merge**.

**Quand l'utiliser :**
- Séries temporelles avec TTL (IoT, métriques, logs horodatés).
- Données écrites en ordre chronologique croissant.
- Workloads où les données récentes sont les plus lues.

**Avantages pour SmartGrid DZ :**

| Avantage | Impact |
|---|---|
| Suppression O(1) par fenêtre | Quand une journée de données expire, la SSTable entière est supprimée sans relecture |
| Pas de write amplification | Seule la fenêtre courante est compactée |
| Localité temporelle | Les requêtes sur les 6 dernières heures lisent 1 seule SSTable |
| Faible I/O background | Le compacteur est inactif sur les fenêtres passées |

**Configuration retenue :**

```cql
-- mesures_par_capteur (TTL 90j) → fenêtre de 1 jour
compaction_window_unit = 'DAYS', compaction_window_size = 1

-- alertes_par_wilaya (TTL 1 an) → fenêtre de 7 jours
compaction_window_unit = 'DAYS', compaction_window_size = 7

-- agregats_horaires (TTL 5 ans) → fenêtre de 30 jours
compaction_window_unit = 'DAYS', compaction_window_size = 30
```

La taille de fenêtre doit être alignée avec la fréquence d'expiration : une fenêtre trop petite crée trop de SSTables ; une fenêtre trop grande retarde la libération de l'espace disque.

---

## Conclusion

Le schéma SmartGrid DZ illustre les trois principes fondamentaux de Cassandra :

1. **Modéliser pour les requêtes** — trois tables dédiées pour trois accès différents.
2. **Éviter les hot partitions** — bucket temporel dans la Partition Key.
3. **Exploiter les TTL avec TWCS** — suppression automatique et efficace des données historiques.

Ces choix permettent d'ingérer **10 000 mesures/minute** (≈ 167 mesures/seconde) avec une latence d'écriture stable et une dégradation nulle dans le temps, contrairement à une approche relationnelle PostgreSQL qui saturerait rapidement en insertions massives.
