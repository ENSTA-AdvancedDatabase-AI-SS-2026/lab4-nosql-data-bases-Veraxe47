/**
 * TP2 - Exercice 4 : Index et Optimisation
 */

use("medical_db");

// ─── 4.1 : Créer les index appropriés ────────────────────────────────────────

/**
 * Index 1 : Composé (wilaya, antecedents)
 * Justification : La requête 2.1 filtre d'abord par wilaya (champ à cardinalité
 * moyenne) puis par antécédent. Mettre wilaya en premier exploite l'index sur
 * le préfixe le plus sélectif disponible, réduisant fortement les docs examinés.
 */
db.patients.createIndex(
  { "adresse.wilaya": 1, antecedents: 1 },
  { name: "idx_wilaya_antecedents" }
);

/**
 * Index 2 : Consultations par date
 * Justification : utilisé par ex3.3 ($match sur consultations.date dans les 12
 * derniers mois) et par toute recherche chronologique. Sans cet index, MongoDB
 * doit scanner chaque sous-document consultation dans tous les patients.
 */
db.patients.createIndex(
  { "consultations.date": 1 },
  { name: "idx_consultation_date" }
);

/**
 * Index 3 : Texte sur diagnostics (full-text search)
 * Justification : requis par la requête 2.5 ($text search). Sans index texte,
 * l'opérateur $text est impossible. Un seul index texte par collection.
 */
db.patients.createIndex(
  { "consultations.diagnostic": "text" },
  { name: "idx_text_diagnostic" }
);

/**
 * Index 4 : Analyses par patient_id
 * Justification : la collection analyses est référencée depuis patients.
 * Chaque $lookup ou requête directe filtre par patient_id. Sans index,
 * chaque jointure fait un COLLSCAN sur analyses (O(n) par patient).
 */
db.analyses.createIndex(
  { patient_id: 1 },
  { name: "idx_analyses_patient" }
);

/**
 * Index 5 (bonus) : Composé pour patients à risque (ex 3.4)
 * Justification : le $match filtre sur antecedents ($all) ET dateNaissance.
 * Un index multiclé sur antecedents + dateNaissance couvre les deux critères.
 */
db.patients.createIndex(
  { antecedents: 1, dateNaissance: 1 },
  { name: "idx_antecedents_datenaissance" }
);

print("✅ Tous les index créés.");
printjson(db.patients.getIndexes().map(i => i.name));

// ─── 4.2 : Comparer avec explain() ────────────────────────────────────────────

const requeteTest = {
  "adresse.wilaya": "Alger",
  antecedents: "Diabète type 2"
};

// On supprime temporairement l'index pour simuler l'état AVANT
db.patients.dropIndex("idx_wilaya_antecedents");

print("\n=== AVANT index (idx_wilaya_antecedents supprimé) ===");
const explainAvant = db.patients.find(requeteTest).explain("executionStats");
const statsAvant   = explainAvant.executionStats;
print("  Stage          :", explainAvant.queryPlanner.winningPlan.stage);
print("  nReturned      :", statsAvant.nReturned);
print("  docsExaminés   :", statsAvant.totalDocsExamined);
print("  keysExaminées  :", statsAvant.totalKeysExamined);
print("  Temps (ms)     :", statsAvant.executionTimeMillis);

// Recréer l'index
db.patients.createIndex(
  { "adresse.wilaya": 1, antecedents: 1 },
  { name: "idx_wilaya_antecedents" }
);

print("\n=== APRÈS index (idx_wilaya_antecedents) ===");
const explainApres = db.patients.find(requeteTest).explain("executionStats");
const statsApres   = explainApres.executionStats;
print("  Stage          :", explainApres.queryPlanner.winningPlan.stage
                          + " → " + (explainApres.queryPlanner.winningPlan.inputStage
                                  || explainApres.queryPlanner.winningPlan).stage);
print("  nReturned      :", statsApres.nReturned);
print("  docsExaminés   :", statsApres.totalDocsExamined);
print("  keysExaminées  :", statsApres.totalKeysExamined);
print("  Temps (ms)     :", statsApres.executionTimeMillis);

// ─── 4.3 : Index composé — ordre des champs ────────────────────────────────────
/**
 * L'index idx_wilaya_antecedents place "adresse.wilaya" en premier.
 * Règle ESR (Equality → Sort → Range) :
 *   - wilaya : égalité exacte → en premier
 *   - antecedents : égalité sur tableau multiclé → en second
 * Cet ordre permet d'utiliser l'index pour les requêtes sur wilaya seule
 * (préfixe) ET pour wilaya+antecedents ensemble.
 * L'inverse (antecedents, wilaya) ne serait pas exploitable pour wilaya seul.
 */
print("\n=== 4.3 : Index composé — justification de l'ordre ===");
print("  wilaya (égalité) AVANT antecedents (multiclé) : conforme à la règle ESR.");

// ─── 4.4 : Index TTL pour archivage automatique des analyses ──────────────────
/**
 * Expire automatiquement les analyses de plus de 5 ans (5 * 365.25 jours).
 * MongoDB supprime les documents dont le champ `date` est antérieur
 * à (now - expireAfterSeconds). Le nettoyage s'effectue toutes les 60 s.
 */
db.analyses.createIndex(
  { date: 1 },
  {
    expireAfterSeconds: Math.floor(5 * 365.25 * 24 * 3600),  // ≈ 157 788 000 s
    name: "idx_ttl_analyses_5ans"
  }
);

print("\n✅ Index TTL créé : analyses expirées après 5 ans.");
print("   expireAfterSeconds =", Math.floor(5 * 365.25 * 24 * 3600));
