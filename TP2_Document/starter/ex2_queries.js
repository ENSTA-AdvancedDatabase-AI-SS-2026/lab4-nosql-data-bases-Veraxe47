/**
 * TP2 - Exercice 2 : Requêtes de Base
 * Use Case : HealthCare DZ - Requêtes sur les dossiers médicaux
 */

use("medical_db");

// ─── 2.1 : Patients diabétiques de plus de 50 ans à Alger ─────────────────────
print("=== 2.1 : Patients diabétiques > 50 ans à Alger ===");

const dateLimit50ans = new Date();
dateLimit50ans.setFullYear(dateLimit50ans.getFullYear() - 50);

const diabetiquesAlger = db.patients.find(
  {
    "adresse.wilaya": "Alger",
    antecedents: "Diabète type 2",
    dateNaissance: { $lte: dateLimit50ans }
  },
  {
    _id: 0,
    nom: 1,
    prenom: 1,
    dateNaissance: 1,
    "adresse.wilaya": 1,
    antecedents: 1
  }
).toArray();

printjson(diabetiquesAlger);
print("Nombre :", diabetiquesAlger.length);

// ─── 2.2 : Patients allergiques à la Pénicilline avec ≥ 3 consultations ────────
print("\n=== 2.2 : Allergiques Pénicilline avec au moins 3 consultations ===");

const allergiquesConsultations = db.patients.find(
  {
    allergies: "Pénicilline",
    $expr: { $gte: [{ $size: "$consultations" }, 3] }
  },
  {
    _id: 0,
    nom: 1,
    prenom: 1,
    allergies: 1,
    // Projeter le nombre de consultations comme champ calculé n'est pas possible
    // en find() sans $addFields — on affiche les consultations directement
    consultations: 1
  }
).toArray();

allergiquesConsultations.forEach(p => {
  print(`  ${p.prenom} ${p.nom} — ${p.consultations.length} consultation(s)`);
});

// ─── 2.3 : Projection — Nom, Prénom, et dernière consultation seulement ────────
print("\n=== 2.3 : Nom, prénom + dernière consultation ===");

// MongoDB ne permet pas de projeter le dernier élément d'un tableau directement
// en find() sans $slice. On utilise $slice: -1 pour obtenir le dernier élément.
const projectionDerniereConsultation = db.patients.find(
  {},
  {
    _id: 0,
    nom: 1,
    prenom: 1,
    consultations: { $slice: -1 }
  }
).toArray();

projectionDerniereConsultation.forEach(p => {
  const c = p.consultations[0];
  print(`  ${p.prenom} ${p.nom} — Dernière : ${c.diagnostic} (${c.date.toISOString().slice(0,10)})`);
});

// ─── 2.4 : Patients sans antécédents et tension systolique > 140 ────────────────
print("\n=== 2.4 : Sans antécédents + tension systolique > 140 ===");

const sansAntecedentsTension = db.patients.find(
  {
    $or: [
      { antecedents: { $exists: false } },
      { antecedents: { $size: 0 } }
    ],
    "consultations.tension.systolique": { $gt: 140 }
  },
  {
    _id: 0,
    nom: 1,
    prenom: 1,
    antecedents: 1,
    "consultations.tension": 1,
    "consultations.diagnostic": 1,
    "consultations.date": 1
  }
).toArray();

printjson(sansAntecedentsTension);

// ─── 2.5 : Recherche textuelle sur les diagnostics ─────────────────────────────
print("\n=== 2.5 : Recherche textuelle — 'Hypertension' ===");

// Prérequis : index texte (créé dans ex4_indexes.js)
// db.patients.createIndex({ "consultations.diagnostic": "text" })

try {
  const rechercheTexte = db.patients.find(
    { $text: { $search: "Hypertension" } },
    {
      _id: 0,
      nom: 1,
      prenom: 1,
      score: { $meta: "textScore" }
    }
  ).sort({ score: { $meta: "textScore" } }).toArray();

  printjson(rechercheTexte);
} catch (e) {
  print("⚠️  Index texte non disponible — exécuter ex4_indexes.js d'abord.");
  // Fallback avec $regex
  const rechercheRegex = db.patients.find(
    { "consultations.diagnostic": { $regex: "Hypertension", $options: "i" } },
    { _id: 0, nom: 1, prenom: 1 }
  ).toArray();
  print("Résultats via regex :");
  printjson(rechercheRegex);
}
