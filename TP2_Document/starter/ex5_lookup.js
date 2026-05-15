/**
 * TP2 - Exercice 5 : $lookup et Données Référencées
 * Use Case : Jointures entre patients et analyses
 */

use("medical_db");

// ─── 5.1 : Dossier complet d'un patient (patients + analyses) ────────────────
print("=== 5.1 : Dossier complet — Ahmed Bensalem ===");

const dossierComplet = db.patients.aggregate([
  // Cibler un patient précis
  { $match: { cin: "198001012300001" } },

  // Joindre les analyses référencées
  {
    $lookup: {
      from:         "analyses",
      localField:   "_id",
      foreignField: "patient_id",
      as:           "resultats_analyses"
    }
  },

  // Projection propre du dossier
  {
    $project: {
      _id:                 0,
      cin:                 1,
      nom:                 1,
      prenom:              1,
      dateNaissance:       1,
      groupeSanguin:       1,
      antecedents:         1,
      allergies:           1,
      nb_consultations:    { $size: "$consultations" },
      consultations:       1,
      nb_analyses:         { $size: "$resultats_analyses" },
      resultats_analyses:  1
    }
  }
]).toArray();

printjson(dossierComplet);

// ─── 5.2 : Patients dont la glycémie dépasse 1.26 g/L ───────────────────────
print("\n=== 5.2 : Patients avec glycémie > 1.26 g/L ===");

const glycemieAnormale = db.analyses.aggregate([
  // Filtrer les analyses de type Glycémie au-dessus du seuil
  {
    $match: {
      type: "Glycémie",
      "resultats.glycemie_a_jeun": { $gt: 1.26 }
    }
  },

  // Joindre avec la collection patients pour obtenir nom/prénom
  {
    $lookup: {
      from:         "patients",
      localField:   "patient_id",
      foreignField: "_id",
      as:           "patient"
    }
  },

  // Dérouler le tableau patient (toujours 1 élément)
  { $unwind: "$patient" },

  // Trier par glycémie décroissante
  { $sort: { "resultats.glycemie_a_jeun": -1 } },

  // Projection finale
  {
    $project: {
      _id:          0,
      nom:          "$patient.nom",
      prenom:       "$patient.prenom",
      wilaya:       "$patient.adresse.wilaya",
      date_analyse: "$date",
      glycemie:     "$resultats.glycemie_a_jeun",
      HbA1c:        "$resultats.HbA1c",
      laboratoire:  1
    }
  }
]).toArray();

printjson(glycemieAnormale);
print("Patients avec glycémie > 1.26 g/L :", glycemieAnormale.length);

// ─── 5.3 : Taux d'analyses anormales par wilaya ──────────────────────────────
print("\n=== 5.3 : Taux d'analyses anormales par wilaya ===");

/**
 * Définition : une analyse est "anormale" si elle vérifie l'une des conditions :
 *   - Glycémie à jeun > 1.10 g/L
 *   - LDL > 1.60 g/L
 *   - Hb < 12 g/dL (NFS — anémie)
 *   - Créatinine > 130 µmol/L
 */
const analysesAnormalesParWilaya = db.analyses.aggregate([
  // Joindre avec patients pour obtenir la wilaya
  {
    $lookup: {
      from:         "patients",
      localField:   "patient_id",
      foreignField: "_id",
      as:           "patient"
    }
  },
  { $unwind: "$patient" },

  // Ajouter un flag "anormale" selon le type d'analyse
  {
    $addFields: {
      est_anormale: {
        $switch: {
          branches: [
            {
              case:  { $and: [
                { $eq:  ["$type", "Glycémie"] },
                { $gt:  ["$resultats.glycemie_a_jeun", 1.10] }
              ]},
              then: true
            },
            {
              case:  { $and: [
                { $eq:  ["$type", "Lipidogramme"] },
                { $gt:  ["$resultats.LDL", 1.60] }
              ]},
              then: true
            },
            {
              case:  { $and: [
                { $eq:  ["$type", "NFS"] },
                { $lt:  ["$resultats.hb", 12] }
              ]},
              then: true
            },
            {
              case:  { $and: [
                { $eq:  ["$type", "Créatinine"] },
                { $gt:  ["$resultats.creatinine", 130] }
              ]},
              then: true
            }
          ],
          default: false
        }
      }
    }
  },

  // Grouper par wilaya
  {
    $group: {
      _id:              "$patient.adresse.wilaya",
      total_analyses:   { $sum: 1 },
      analyses_anormales: { $sum: { $cond: ["$est_anormale", 1, 0] } }
    }
  },

  // Calculer le taux en %
  {
    $addFields: {
      taux_anormal_pct: {
        $round: [
          {
            $multiply: [
              { $divide: ["$analyses_anormales", "$total_analyses"] },
              100
            ]
          },
          1
        ]
      }
    }
  },

  { $sort: { taux_anormal_pct: -1 } },

  {
    $project: {
      _id:                  0,
      wilaya:               "$_id",
      total_analyses:       1,
      analyses_anormales:   1,
      taux_anormal_pct:     1
    }
  }
]).toArray();

printjson(analysesAnormalesParWilaya);
