/**
 * TP2 - Exercice 3 : Pipelines d'Agrégation
 * Use Case : Statistiques médicales HealthCare DZ
 */

use("medical_db");

// ─── 3.1 : Distribution des diagnostics par wilaya ────────────────────────────
print("=== 3.1 : Top diagnostics par wilaya ===");

const diagParWilaya = db.patients.aggregate([
  // Dérouler le tableau des consultations (1 doc par consultation)
  { $unwind: "$consultations" },

  // Grouper par wilaya + diagnostic et compter
  {
    $group: {
      _id: {
        wilaya:     "$adresse.wilaya",
        diagnostic: "$consultations.diagnostic"
      },
      count: { $sum: 1 }
    }
  },

  // Trier par wilaya puis par count décroissant
  { $sort: { "_id.wilaya": 1, count: -1 } },

  // Garder les 20 premières combinaisons les plus fréquentes
  { $limit: 20 },

  // Reformater la sortie
  {
    $project: {
      _id: 0,
      wilaya:     "$_id.wilaya",
      diagnostic: "$_id.diagnostic",
      count:      1
    }
  }
]).toArray();

printjson(diagParWilaya);

// ─── 3.2 : Médicament le plus prescrit par spécialité ─────────────────────────
print("\n=== 3.2 : Top médicament par spécialité ===");

const medsParSpecialite = db.patients.aggregate([
  // Dérouler les consultations
  { $unwind: "$consultations" },

  // Dérouler les médicaments de chaque consultation
  { $unwind: "$consultations.medicaments" },

  // Grouper par spécialité + médicament
  {
    $group: {
      _id: {
        specialite:    "$consultations.medecin.specialite",
        nom_medicament:"$consultations.medicaments.nom"
      },
      prescriptions: { $sum: 1 }
    }
  },

  // Trier par prescriptions décroissant
  { $sort: { prescriptions: -1 } },

  // Regrouper par spécialité pour garder le top 1
  {
    $group: {
      _id:         "$_id.specialite",
      top_medicament: { $first: "$_id.nom_medicament" },
      prescriptions:  { $first: "$prescriptions" }
    }
  },

  // Reformater
  {
    $project: {
      _id: 0,
      specialite:     "$_id",
      top_medicament: 1,
      prescriptions:  1
    }
  },

  { $sort: { specialite: 1 } }
]).toArray();

printjson(medsParSpecialite);

// ─── 3.3 : Évolution mensuelle des consultations (12 derniers mois) ────────────
print("\n=== 3.3 : Consultations par mois (12 derniers mois) ===");

const evolutionMensuelle = db.patients.aggregate([
  { $unwind: "$consultations" },

  // Filtrer les 12 derniers mois
  {
    $match: {
      "consultations.date": {
        $gte: new Date(new Date().setFullYear(new Date().getFullYear() - 1))
      }
    }
  },

  // Grouper par année + mois
  {
    $group: {
      _id: {
        annee: { $year:  "$consultations.date" },
        mois:  { $month: "$consultations.date" }
      },
      total_consultations: { $sum: 1 }
    }
  },

  // Trier chronologiquement
  { $sort: { "_id.annee": 1, "_id.mois": 1 } },

  // Formater la date en "YYYY-MM"
  {
    $project: {
      _id: 0,
      periode: {
        $concat: [
          { $toString: "$_id.annee" },
          "-",
          {
            $cond: {
              if:   { $lt: ["$_id.mois", 10] },
              then: { $concat: ["0", { $toString: "$_id.mois" }] },
              else: { $toString: "$_id.mois" }
            }
          }
        ]
      },
      total_consultations: 1
    }
  }
]).toArray();

printjson(evolutionMensuelle);

// ─── 3.4 : Patients à risque multiple (Diabète + HTA + âge > 60) ──────────────
print("\n=== 3.4 : Profil patients à risque élevé ===");

const dateLimit60ans = new Date();
dateLimit60ans.setFullYear(dateLimit60ans.getFullYear() - 60);

const patientsRisque = db.patients.aggregate([
  // Filtrer sur les antécédents ET l'âge
  {
    $match: {
      antecedents: { $all: ["Diabète type 2", "HTA"] },
      dateNaissance: { $lte: dateLimit60ans }
    }
  },

  // Calculer l'âge et le nombre de consultations
  {
    $addFields: {
      age: {
        $floor: {
          $divide: [
            { $subtract: [new Date(), "$dateNaissance"] },
            1000 * 60 * 60 * 24 * 365.25
          ]
        }
      },
      nb_consultations: { $size: "$consultations" }
    }
  },

  // Statistiques globales du groupe
  {
    $group: {
      _id:                        null,
      nb_patients:                { $sum: 1 },
      age_moyen:                  { $avg: "$age" },
      consultations_moy:          { $avg: "$nb_consultations" },
      antecedents_supplementaires:{
        $push: {
          patient: { $concat: ["$prenom", " ", "$nom"] },
          antecedents: "$antecedents",
          nb_consultations: "$nb_consultations"
        }
      }
    }
  },

  {
    $project: {
      _id: 0,
      nb_patients:       1,
      age_moyen:         { $round: ["$age_moyen", 1] },
      consultations_moy: { $round: ["$consultations_moy", 1] },
      detail_patients:   "$antecedents_supplementaires"
    }
  }
]).toArray();

printjson(patientsRisque);

// ─── 3.5 : Top 5 médecins & taux de ré-consultation ──────────────────────────
print("\n=== 3.5 : Top 5 médecins & taux de ré-consultation ===");

const rapportMedecins = db.patients.aggregate([
  { $unwind: "$consultations" },

  // Grouper par médecin — compter patients uniques et consultations totales
  {
    $group: {
      _id:                  "$consultations.medecin.nom",
      specialite:           { $first: "$consultations.medecin.specialite" },
      total_consultations:  { $sum: 1 },
      patients_uniques:     { $addToSet: "$_id" }   // set des _id patients distincts
    }
  },

  // Calculer le nombre de patients uniques et le taux de ré-consultation
  {
    $addFields: {
      nb_patients_uniques: { $size: "$patients_uniques" },
      taux_reconsultation: {
        $round: [
          {
            $multiply: [
              {
                $divide: [
                  { $subtract: ["$total_consultations", { $size: "$patients_uniques" }] },
                  { $size: "$patients_uniques" }
                ]
              },
              100
            ]
          },
          1
        ]
      }
    }
  },

  // Trier par consultations totales décroissant
  { $sort: { total_consultations: -1 } },

  // Top 5
  { $limit: 5 },

  {
    $project: {
      _id: 0,
      medecin:              "$_id",
      specialite:           1,
      total_consultations:  1,
      nb_patients_uniques:  1,
      taux_reconsultation:  { $concat: [{ $toString: "$taux_reconsultation" }, "%"] }
    }
  }
]).toArray();

printjson(rapportMedecins);
