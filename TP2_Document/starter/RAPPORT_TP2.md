# RAPPORT.md — TP2 MongoDB : Gestion de Dossiers Médicaux
## HealthCare DZ — Hôpital Numérique

---

## 1. Justification du choix Embedding vs Referencing

### Principe appliqué

Le choix entre **embedding** (imbrication) et **referencing** (référencement) repose sur trois critères :

| Critère | Embedding | Referencing |
|---|---|---|
| Fréquence d'accès conjoint | Données toujours lues ensemble | Données lues séparément |
| Volume / croissance | Borné (< 16 Mo / document) | Illimité |
| Cohérence d'écriture | Atomique dans un seul document | Transactions multi-documents |

### Décisions de modélisation

#### `consultations` → **EMBEDDED** dans `patients`

Les consultations sont **systématiquement lues avec le dossier patient**. Un médecin qui ouvre une fiche patient a besoin de tout l'historique des consultations immédiatement. L'embedding permet de récupérer le dossier complet en **un seul accès disque**, sans jointure.

Le nombre de consultations par patient est borné dans le temps (quelques dizaines par an, sur quelques années) : le document reste bien en dessous de la limite de 16 Mo.

#### `analyses` → **REFERENCED** dans une collection séparée

Les analyses sont volumineuses (résultats structurés variables selon le type), potentiellement nombreuses sur une longue période, et souvent **consultées séparément** (bilan laboratoire indépendant du dossier clinique). Le référencement via `patient_id` permet :
- de ne pas gonfler le document patient,
- d'appliquer un **index TTL** directement sur la collection analyses (impossible sur un sous-tableau embedded),
- d'interroger les analyses sans charger les dossiers patients (ex. : tous les patients avec glycémie > 1.26 g/L).

#### `medecin` → **EMBEDDED** dans chaque consultation

La fiche médecin (nom, spécialité) est petite et ne change pas pour une consultation passée. L'embedding évite un $lookup supplémentaire pour chaque consultation lue. En contrepartie, si un médecin change de spécialité, les consultations historiques reflètent l'état au moment de la consultation — ce qui est **médicalement correct**.

#### `antecedents` et `allergies` → **Arrays simples** dans `patients`

Données peu volumineuses, toujours pertinentes pour le contexte clinique immédiat (alertes allergies lors d'une prescription). Aucun intérêt à les externaliser.

---

## 2. Résultats `explain()` — Avant / Après indexation

### Requête testée (Ex 4.2)

```javascript
db.patients.find({
  "adresse.wilaya": "Alger",
  antecedents: "Diabète type 2"
})
```

### Tableau comparatif

| Métrique | SANS index | AVEC index `(wilaya, antecedents)` | Gain |
|---|---|---|---|
| Stage MongoDB | `COLLSCAN` | `IXSCAN → FETCH` | — |
| `nReturned` | 4 | 4 | identique |
| `totalDocsExamined` | 20 | 4 | **×5 moins** |
| `totalKeysExamined` | 0 | 4 | — |
| `executionTimeMillis` | ~2 ms | < 1 ms | **×2+ plus rapide** |

> ⚠️ Sur 20 documents le gain en ms est faible — il devient massif à des centaines de milliers de patients. Ce qui importe ici est que **docsExaminés = nReturned** avec l'index : MongoDB ne touche que les documents pertinents.

### Interprétation

- **COLLSCAN** (sans index) : MongoDB parcourt l'intégralité des 20 documents, évalue chaque condition → coût O(n).
- **IXSCAN → FETCH** (avec index) : MongoDB traverse l'index B-tree directement sur `(wilaya, antecedents)`, récupère uniquement les 4 pointeurs correspondants, puis fetch les 4 documents → coût O(log n + k).

---

## 3. Pipeline d'agrégation le plus complexe — Explication étape par étape

### Pipeline choisi : Ex 3.5 — Top 5 médecins & taux de ré-consultation

```javascript
db.patients.aggregate([
  { $unwind: "$consultations" },
  { $group: {
      _id: "$consultations.medecin.nom",
      specialite:          { $first: "$consultations.medecin.specialite" },
      total_consultations: { $sum: 1 },
      patients_uniques:    { $addToSet: "$_id" }
  }},
  { $addFields: {
      nb_patients_uniques: { $size: "$patients_uniques" },
      taux_reconsultation: { /* formule */ }
  }},
  { $sort:  { total_consultations: -1 } },
  { $limit: 5 },
  { $project: { ... } }
])
```

#### Étape 1 — `$unwind: "$consultations"`

Chaque document patient contenant N consultations est **dupliqué en N documents**, un par consultation. Cela permet de grouper par médecin au niveau de la consultation individuelle.

**Entrée :** 20 docs patients (2 à 4 consultations chacun) → **Sortie :** ~55 docs consultations.

#### Étape 2 — `$group` par médecin

On regroupe tous les documents par nom de médecin :
- `$sum: 1` → compte toutes les consultations de ce médecin (toutes patients confondus).
- `$addToSet: "$_id"` → collecte les **_id patients distincts** dans un ensemble (Set), éliminant automatiquement les doublons. C'est la clé du taux de ré-consultation : un patient qui consulte 3 fois le même médecin apparaît 3 fois dans `total_consultations` mais une seule fois dans `patients_uniques`.

#### Étape 3 — `$addFields` pour les métriques calculées

```
taux_reconsultation = (total_consultations - nb_patients_uniques)
                      / nb_patients_uniques × 100
```

- Si un médecin a vu 10 consultations pour 8 patients uniques → taux = (10-8)/8 × 100 = **25 %** : 25 % des patients sont revenus au moins une fois.
- `$size: "$patients_uniques"` calcule dynamiquement la cardinalité du Set.

#### Étape 4 — `$sort` + `$limit`

Tri par `total_consultations` décroissant, puis on garde les **5 médecins les plus actifs**. Le tri avant le $limit garantit que MongoDB n'a pas besoin de trier 1 million de résultats : le tri se fait sur l'ensemble réduit post-$group.

#### Étape 5 — `$project`

Reformatage de la sortie : suppression de `_id`, renommage des champs, concaténation du taux avec `%`. Le `taux_reconsultation` est affiché sous forme de chaîne lisible.

---

## 4. Justification des index (Ex 4.3 — ordre des champs)

### Index composé `{ "adresse.wilaya": 1, antecedents: 1 }`

L'ordre suit la **règle ESR** (Equality → Sort → Range) :

1. **Equality** sur `wilaya` en premier : c'est un filtre d'égalité exacte sur un champ à cardinalité modérée (~48 wilayas). MongoDB peut immédiatement se positionner dans le B-tree sur la bonne wilaya.

2. **Multiclé** sur `antecedents` en second : MongoDB filtre ensuite dans le sous-ensemble déjà restreint par wilaya.

L'index inverse `(antecedents, wilaya)` fonctionnerait aussi mais serait moins efficace pour des requêtes sur wilaya seule, car le préfixe `antecedents` seul est un tableau multiclé très répandu.

### Index TTL `{ date: 1 }` sur `analyses`

```javascript
db.analyses.createIndex(
  { date: 1 },
  { expireAfterSeconds: 157_788_000 }  // 5 × 365.25 jours
)
```

MongoDB exécute un processus de fond (`TTLMonitor`) toutes les **60 secondes** qui supprime les documents dont `date < now - expireAfterSeconds`. Cela automatise l'archivage légal des analyses médicales sans scripts externes.

---

## 5. Réponses aux questions de réflexion

### Q1 — Embedding vs Referencing : quand changer de stratégie ?

On bascule vers le **referencing** quand :
- Le document risque de dépasser 16 Mo (limite MongoDB), par ex. si un patient accumule des milliers d'analyses avec images médicales.
- Les données sont accédées **indépendamment** plus souvent qu'ensemble.
- On a besoin d'un **index TTL** sur un sous-ensemble (impossible sur un array embedded).
- Des **mises à jour concurrentes** sur les sous-documents causent des conflits (plusieurs infirmières mettent à jour le même dossier simultanément).

### Q2 — Gestion de la cohérence lors d'une commande atomique (bonus Transactions)

MongoDB 4.0+ supporte les transactions multi-documents ACID :

```javascript
const session = db.getMongo().startSession();
session.startTransaction();
try {
  db.patients.updateOne(
    { _id: patientId },
    { $push: { consultations: nouvelleConsultation } },
    { session }
  );
  db.analyses.insertOne(
    { patient_id: patientId, ...nouvelleAnalyse },
    { session }
  );
  session.commitTransaction();
} catch (e) {
  session.abortTransaction();
  throw e;
}
```

Sans transaction, si l'insertion d'analyse échoue après l'update du patient, on se retrouve avec une consultation sans analyse — incohérence médicale grave.

### Q3 — Limites du schéma flexible MongoDB en contexte médical

Le schéma flexible est un atout (chaque type d'analyse a des résultats différents) mais un risque en médecine :
- **Validation `$jsonSchema`** avec `validationAction: "error"` en production pour bloquer les données malformées.
- Risque de **dérive de schéma** : deux développeurs peuvent stocker `glycemie_jeun` et `glycemie_a_jeun` — les requêtes ratent la moitié des données.
- **Solution** : versionner le schéma (`schema_version: 2`) et migrer les anciens documents explicitement.

---

*Rapport rédigé dans le cadre du TP2 — Module MongoDB, Université / École d'Ingénieurs.*
