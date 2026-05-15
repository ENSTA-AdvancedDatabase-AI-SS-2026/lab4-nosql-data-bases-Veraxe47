/**
 * TP2 - Exercice 1 : Modélisation MongoDB
 * Use Case : HealthCare DZ - Dossiers Médicaux
 */

use("medical_db");

// ─── 1.1 : Créer la collection avec validation ────────────────────────────────
// On supprime d'abord si elle existe déjà (idempotence)
db.patients.drop();

db.createCollection("patients", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["cin", "nom", "prenom", "dateNaissance", "sexe"],
      properties: {
        cin: {
          bsonType: "string",
          minLength: 12,
          maxLength: 18,
          description: "Numéro CIN obligatoire (string)"
        },
        nom: {
          bsonType: "string",
          minLength: 2,
          description: "Nom de famille obligatoire"
        },
        prenom: {
          bsonType: "string",
          minLength: 2,
          description: "Prénom obligatoire"
        },
        dateNaissance: {
          bsonType: "date",
          description: "Date de naissance (ISODate) obligatoire"
        },
        sexe: {
          bsonType: "string",
          enum: ["M", "F"],
          description: "Sexe : M ou F"
        },
        adresse: {
          bsonType: "object",
          properties: {
            wilaya:   { bsonType: "string" },
            commune:  { bsonType: "string" }
          }
        },
        groupeSanguin: {
          bsonType: "string",
          enum: ["A+","A-","B+","B-","AB+","AB-","O+","O-"]
        },
        antecedents: { bsonType: "array" },
        allergies:   { bsonType: "array" },
        consultations: {
          bsonType: "array",
          items: {
            bsonType: "object",
            required: ["date", "medecin", "diagnostic"],
            properties: {
              date:       { bsonType: "date" },
              diagnostic: { bsonType: "string" },
              medecin: {
                bsonType: "object",
                required: ["nom", "specialite"],
                properties: {
                  nom:       { bsonType: "string" },
                  specialite:{ bsonType: "string" }
                }
              }
            }
          }
        }
      }
    }
  },
  validationAction: "warn"   // "warn" pour ne pas bloquer en dev
});

print("✅ Collection 'patients' créée avec validation JSON Schema.");

// ─── 1.2 : Insérer 20 patients avec données algériennes réalistes ─────────────
const patients = [
  // ── Patient 1 ──
  {
    cin: "198001012300001",
    nom: "Bensalem", prenom: "Ahmed",
    dateNaissance: new Date("1980-01-01"),
    sexe: "M",
    adresse: { wilaya: "Alger", commune: "Bab Ezzouar" },
    groupeSanguin: "O+",
    antecedents: ["Diabète type 2", "HTA"],
    allergies: ["Pénicilline"],
    consultations: [
      {
        date: new Date("2024-01-15"),
        medecin: { nom: "Dr. Mansouri", specialite: "Cardiologie" },
        diagnostic: "Hypertension artérielle",
        tension: { systolique: 145, diastolique: 92 },
        medicaments: [{ nom: "Amlodipine", dosage: "5mg", duree: "30 jours" }],
        notes: "Surveillance tensionnelle recommandée"
      },
      {
        date: new Date("2024-04-10"),
        medecin: { nom: "Dr. Mansouri", specialite: "Cardiologie" },
        diagnostic: "HTA équilibrée",
        tension: { systolique: 130, diastolique: 85 },
        medicaments: [{ nom: "Amlodipine", dosage: "5mg", duree: "30 jours" }],
        notes: "Bon contrôle tensionnel"
      },
      {
        date: new Date("2024-09-05"),
        medecin: { nom: "Dr. Zerrouk", specialite: "Endocrinologie" },
        diagnostic: "Diabète type 2 déséquilibré",
        medicaments: [
          { nom: "Metformine", dosage: "1000mg", duree: "90 jours" },
          { nom: "Glicazide",  dosage: "30mg",   duree: "90 jours" }
        ],
        notes: "HbA1c à 8.2 — régime strict"
      }
    ]
  },
  // ── Patient 2 ──
  {
    cin: "199205153001002",
    nom: "Hamidi", prenom: "Fatima",
    dateNaissance: new Date("1992-05-15"),
    sexe: "F",
    adresse: { wilaya: "Oran", commune: "Es Sénia" },
    groupeSanguin: "A+",
    antecedents: ["Asthme"],
    allergies: ["Aspirine"],
    consultations: [
      {
        date: new Date("2024-02-20"),
        medecin: { nom: "Dr. Bekhti", specialite: "Pneumologie" },
        diagnostic: "Crise d'asthme modérée",
        medicaments: [
          { nom: "Salbutamol",   dosage: "100µg", duree: "7 jours" },
          { nom: "Bécométhasone",dosage: "250µg", duree: "30 jours" }
        ],
        notes: "Éviter les allergènes"
      },
      {
        date: new Date("2024-06-11"),
        medecin: { nom: "Dr. Bekhti", specialite: "Pneumologie" },
        diagnostic: "Asthme stable",
        medicaments: [{ nom: "Bécométhasone", dosage: "250µg", duree: "60 jours" }],
        notes: "Spirométrie normale"
      }
    ]
  },
  // ── Patient 3 ──
  {
    cin: "197503084500003",
    nom: "Khelifi", prenom: "Mohamed",
    dateNaissance: new Date("1975-03-08"),
    sexe: "M",
    adresse: { wilaya: "Constantine", commune: "Ali Mendjeli" },
    groupeSanguin: "B+",
    antecedents: ["HTA", "Obésité"],
    allergies: [],
    consultations: [
      {
        date: new Date("2023-11-12"),
        medecin: { nom: "Dr. Laib", specialite: "Médecine générale" },
        diagnostic: "Obésité grade II",
        medicaments: [],
        notes: "Régime hypocalorique, activité physique"
      },
      {
        date: new Date("2024-03-22"),
        medecin: { nom: "Dr. Mansouri", specialite: "Cardiologie" },
        diagnostic: "Hypertension artérielle",
        tension: { systolique: 155, diastolique: 98 },
        medicaments: [
          { nom: "Périndopril", dosage: "5mg", duree: "30 jours" },
          { nom: "Indapamide",  dosage: "1.5mg",duree: "30 jours" }
        ],
        notes: "Bilan lipidique demandé"
      },
      {
        date: new Date("2024-07-30"),
        medecin: { nom: "Dr. Mansouri", specialite: "Cardiologie" },
        diagnostic: "HTA partiellement contrôlée",
        tension: { systolique: 142, diastolique: 90 },
        medicaments: [
          { nom: "Périndopril", dosage: "10mg", duree: "30 jours" },
          { nom: "Amlodipine",  dosage: "5mg",  duree: "30 jours" }
        ],
        notes: "Majoration du traitement"
      }
    ]
  },
  // ── Patient 4 ──
  {
    cin: "200010206700004",
    nom: "Bouzid", prenom: "Yasmine",
    dateNaissance: new Date("2000-10-20"),
    sexe: "F",
    adresse: { wilaya: "Alger", commune: "Kouba" },
    groupeSanguin: "O-",
    antecedents: [],
    allergies: [],
    consultations: [
      {
        date: new Date("2024-01-08"),
        medecin: { nom: "Dr. Laib", specialite: "Médecine générale" },
        diagnostic: "Rhinite allergique",
        medicaments: [
          { nom: "Cétirizine",    dosage: "10mg", duree: "14 jours" },
          { nom: "Fluticasone",   dosage: "50µg", duree: "30 jours" }
        ],
        notes: ""
      },
      {
        date: new Date("2024-08-19"),
        medecin: { nom: "Dr. Laib", specialite: "Médecine générale" },
        diagnostic: "Angine bactérienne",
        medicaments: [{ nom: "Amoxicilline", dosage: "1g", duree: "7 jours" }],
        notes: ""
      }
    ]
  },
  // ── Patient 5 ──
  {
    cin: "196508124200005",
    nom: "Touati", prenom: "Abdelkader",
    dateNaissance: new Date("1965-08-12"),
    sexe: "M",
    adresse: { wilaya: "Annaba", commune: "El Bouni" },
    groupeSanguin: "AB+",
    antecedents: ["Diabète type 2", "HTA", "Insuffisance rénale chronique"],
    allergies: ["Sulfamides"],
    consultations: [
      {
        date: new Date("2023-10-05"),
        medecin: { nom: "Dr. Saadi", specialite: "Néphrologie" },
        diagnostic: "IRC stade 3",
        medicaments: [{ nom: "Bicarbonate", dosage: "500mg", duree: "90 jours" }],
        notes: "DFG = 42 ml/min"
      },
      {
        date: new Date("2024-02-15"),
        medecin: { nom: "Dr. Zerrouk", specialite: "Endocrinologie" },
        diagnostic: "Diabète type 2 compliqué",
        medicaments: [{ nom: "Insuline Glargine", dosage: "20UI", duree: "30 jours" }],
        notes: "Transition insuline en raison IRC"
      },
      {
        date: new Date("2024-06-20"),
        medecin: { nom: "Dr. Saadi", specialite: "Néphrologie" },
        diagnostic: "IRC stade 3 stable",
        medicaments: [{ nom: "Bicarbonate", dosage: "500mg", duree: "90 jours" }],
        notes: "DFG = 40 ml/min — stable"
      },
      {
        date: new Date("2024-10-01"),
        medecin: { nom: "Dr. Mansouri", specialite: "Cardiologie" },
        diagnostic: "Hypertension artérielle non contrôlée",
        tension: { systolique: 165, diastolique: 105 },
        medicaments: [{ nom: "Amlodipine", dosage: "10mg", duree: "30 jours" }],
        notes: "Adaptation traitement urgent"
      }
    ]
  },
  // ── Patient 6 ──
  {
    cin: "198812309100006",
    nom: "Cherif", prenom: "Soraya",
    dateNaissance: new Date("1988-12-30"),
    sexe: "F",
    adresse: { wilaya: "Blida", commune: "Boufarik" },
    groupeSanguin: "A-",
    antecedents: ["Hypothyroïdie"],
    allergies: [],
    consultations: [
      {
        date: new Date("2024-03-14"),
        medecin: { nom: "Dr. Zerrouk", specialite: "Endocrinologie" },
        diagnostic: "Hypothyroïdie traitée",
        medicaments: [{ nom: "Lévothyroxine", dosage: "75µg", duree: "90 jours" }],
        notes: "TSH à 3.2 — bon équilibre"
      },
      {
        date: new Date("2024-09-25"),
        medecin: { nom: "Dr. Zerrouk", specialite: "Endocrinologie" },
        diagnostic: "Hypothyroïdie stable",
        medicaments: [{ nom: "Lévothyroxine", dosage: "75µg", duree: "90 jours" }],
        notes: "TSH à 2.8"
      }
    ]
  },
  // ── Patient 7 ──
  {
    cin: "197107226800007",
    nom: "Maouche", prenom: "Karim",
    dateNaissance: new Date("1971-07-22"),
    sexe: "M",
    adresse: { wilaya: "Sétif", commune: "Ain Oulmane" },
    groupeSanguin: "B-",
    antecedents: ["Diabète type 2", "HTA"],
    allergies: ["Pénicilline"],
    consultations: [
      {
        date: new Date("2024-01-30"),
        medecin: { nom: "Dr. Laib", specialite: "Médecine générale" },
        diagnostic: "Diabète type 2 équilibré",
        medicaments: [{ nom: "Metformine", dosage: "850mg", duree: "90 jours" }],
        notes: "HbA1c à 6.9"
      },
      {
        date: new Date("2024-05-10"),
        medecin: { nom: "Dr. Mansouri", specialite: "Cardiologie" },
        diagnostic: "HTA contrôlée",
        tension: { systolique: 128, diastolique: 80 },
        medicaments: [{ nom: "Ramipril", dosage: "5mg", duree: "30 jours" }],
        notes: ""
      },
      {
        date: new Date("2024-11-02"),
        medecin: { nom: "Dr. Laib", specialite: "Médecine générale" },
        diagnostic: "Grippe saisonnière",
        medicaments: [{ nom: "Paracétamol", dosage: "1g", duree: "5 jours" }],
        notes: ""
      }
    ]
  },
  // ── Patient 8 ──
  {
    cin: "199304178300008",
    nom: "Aissaoui", prenom: "Nadia",
    dateNaissance: new Date("1993-04-17"),
    sexe: "F",
    adresse: { wilaya: "Alger", commune: "Hydra" },
    groupeSanguin: "O+",
    antecedents: [],
    allergies: [],
    consultations: [
      {
        date: new Date("2024-02-05"),
        medecin: { nom: "Dr. Laib", specialite: "Médecine générale" },
        diagnostic: "Gastrite aiguë",
        medicaments: [
          { nom: "Oméprazole",  dosage: "20mg", duree: "14 jours" },
          { nom: "Dompéridone", dosage: "10mg", duree: "7 jours"  }
        ],
        notes: ""
      },
      {
        date: new Date("2024-07-12"),
        medecin: { nom: "Dr. Laib", specialite: "Médecine générale" },
        diagnostic: "Lombalgie aiguë",
        medicaments: [
          { nom: "Ibuprofène",   dosage: "400mg", duree: "7 jours" },
          { nom: "Myorelaxant",  dosage: "4mg",   duree: "5 jours" }
        ],
        notes: "Kinésithérapie recommandée"
      }
    ]
  },
  // ── Patient 9 ──
  {
    cin: "196001013500009",
    nom: "Benali", prenom: "Mustapha",
    dateNaissance: new Date("1960-01-01"),
    sexe: "M",
    adresse: { wilaya: "Oran", commune: "Bir El Djir" },
    groupeSanguin: "AB-",
    antecedents: ["Diabète type 2", "HTA", "Dyslipidémie"],
    allergies: [],
    consultations: [
      {
        date: new Date("2023-09-14"),
        medecin: { nom: "Dr. Mansouri", specialite: "Cardiologie" },
        diagnostic: "Dyslipidémie mixte",
        medicaments: [{ nom: "Atorvastatine", dosage: "20mg", duree: "90 jours" }],
        notes: "LDL à 1.8 g/L"
      },
      {
        date: new Date("2024-01-20"),
        medecin: { nom: "Dr. Zerrouk", specialite: "Endocrinologie" },
        diagnostic: "Diabète type 2 déséquilibré",
        medicaments: [
          { nom: "Metformine", dosage: "1000mg", duree: "90 jours" },
          { nom: "Sitagliptine",dosage: "100mg",  duree: "90 jours" }
        ],
        notes: "HbA1c à 9.1"
      },
      {
        date: new Date("2024-05-05"),
        medecin: { nom: "Dr. Mansouri", specialite: "Cardiologie" },
        diagnostic: "Hypertension artérielle",
        tension: { systolique: 150, diastolique: 95 },
        medicaments: [
          { nom: "Amlodipine",  dosage: "5mg",  duree: "30 jours" },
          { nom: "Ramipril",    dosage: "10mg", duree: "30 jours" }
        ],
        notes: ""
      },
      {
        date: new Date("2024-09-18"),
        medecin: { nom: "Dr. Mansouri", specialite: "Cardiologie" },
        diagnostic: "Bilan cardiovasculaire annuel",
        tension: { systolique: 138, diastolique: 87 },
        medicaments: [],
        notes: "ECG normal"
      }
    ]
  },
  // ── Patient 10 ──
  {
    cin: "200205094900010",
    nom: "Guendouz", prenom: "Amina",
    dateNaissance: new Date("2002-05-09"),
    sexe: "F",
    adresse: { wilaya: "Constantine", commune: "El Khroub" },
    groupeSanguin: "A+",
    antecedents: ["Anémie ferriprive"],
    allergies: [],
    consultations: [
      {
        date: new Date("2024-03-03"),
        medecin: { nom: "Dr. Laib", specialite: "Médecine générale" },
        diagnostic: "Anémie ferriprive sévère",
        medicaments: [{ nom: "Fer + Acide folique", dosage: "80mg", duree: "60 jours" }],
        notes: "Hb à 8.2 g/dL"
      },
      {
        date: new Date("2024-06-15"),
        medecin: { nom: "Dr. Laib", specialite: "Médecine générale" },
        diagnostic: "Anémie en cours de correction",
        medicaments: [{ nom: "Fer + Acide folique", dosage: "80mg", duree: "60 jours" }],
        notes: "Hb à 10.5 g/dL"
      }
    ]
  },
  // ── Patient 11 ──
  {
    cin: "197806305600011",
    nom: "Rahmani", prenom: "Rachid",
    dateNaissance: new Date("1978-06-30"),
    sexe: "M",
    adresse: { wilaya: "Blida", commune: "Meftah" },
    groupeSanguin: "O+",
    antecedents: ["HTA"],
    allergies: [],
    consultations: [
      {
        date: new Date("2024-02-28"),
        medecin: { nom: "Dr. Bekhti", specialite: "Pneumologie" },
        diagnostic: "Bronchite chronique",
        medicaments: [
          { nom: "Amoxicilline", dosage: "1g",    duree: "7 jours" },
          { nom: "Salbutamol",   dosage: "100µg", duree: "14 jours" }
        ],
        notes: "Arrêt tabac recommandé"
      },
      {
        date: new Date("2024-07-04"),
        medecin: { nom: "Dr. Mansouri", specialite: "Cardiologie" },
        diagnostic: "HTA contrôlée",
        tension: { systolique: 125, diastolique: 78 },
        medicaments: [{ nom: "Ramipril", dosage: "5mg", duree: "30 jours" }],
        notes: ""
      }
    ]
  },
  // ── Patient 12 ──
  {
    cin: "196910257100012",
    nom: "Messaoud", prenom: "Zineb",
    dateNaissance: new Date("1969-10-25"),
    sexe: "F",
    adresse: { wilaya: "Annaba", commune: "Seraidi" },
    groupeSanguin: "B+",
    antecedents: ["Diabète type 2", "HTA", "Ostéoporose"],
    allergies: ["AINS"],
    consultations: [
      {
        date: new Date("2023-12-10"),
        medecin: { nom: "Dr. Zerrouk", specialite: "Endocrinologie" },
        diagnostic: "Diabète type 2 équilibré",
        medicaments: [
          { nom: "Metformine", dosage: "850mg", duree: "90 jours" },
          { nom: "Glicazide",  dosage: "30mg",  duree: "90 jours" }
        ],
        notes: "HbA1c à 7.2"
      },
      {
        date: new Date("2024-04-18"),
        medecin: { nom: "Dr. Laib", specialite: "Médecine générale" },
        diagnostic: "Ostéoporose traitée",
        medicaments: [
          { nom: "Calcium + Vit D", dosage: "1000mg", duree: "90 jours" },
          { nom: "Alendronate",    dosage: "70mg",   duree: "30 jours" }
        ],
        notes: "Densitométrie osseuse réalisée"
      },
      {
        date: new Date("2024-09-12"),
        medecin: { nom: "Dr. Mansouri", specialite: "Cardiologie" },
        diagnostic: "Hypertension artérielle",
        tension: { systolique: 148, diastolique: 93 },
        medicaments: [{ nom: "Amlodipine", dosage: "5mg", duree: "30 jours" }],
        notes: ""
      }
    ]
  },
  // ── Patient 13 ──
  {
    cin: "198509167800013",
    nom: "Boudjemaa", prenom: "Sofiane",
    dateNaissance: new Date("1985-09-16"),
    sexe: "M",
    adresse: { wilaya: "Sétif", commune: "Sétif Centre" },
    groupeSanguin: "A-",
    antecedents: [],
    allergies: [],
    consultations: [
      {
        date: new Date("2024-01-22"),
        medecin: { nom: "Dr. Laib", specialite: "Médecine générale" },
        diagnostic: "Sinusite aiguë",
        medicaments: [
          { nom: "Amoxicilline + Acide clavulanique", dosage: "1g", duree: "7 jours" },
          { nom: "Pseudoéphédrine", dosage: "60mg", duree: "5 jours" }
        ],
        notes: ""
      },
      {
        date: new Date("2024-10-08"),
        medecin: { nom: "Dr. Bekhti", specialite: "Pneumologie" },
        diagnostic: "Toux chronique — bilan",
        medicaments: [],
        notes: "Radiographie thorax demandée"
      }
    ]
  },
  // ── Patient 14 ──
  {
    cin: "197204218900014",
    nom: "Lakehal", prenom: "Houria",
    dateNaissance: new Date("1972-04-21"),
    sexe: "F",
    adresse: { wilaya: "Alger", commune: "Dar El Beida" },
    groupeSanguin: "O+",
    antecedents: ["Diabète type 2", "HTA"],
    allergies: ["Pénicilline"],
    consultations: [
      {
        date: new Date("2024-02-12"),
        medecin: { nom: "Dr. Zerrouk", specialite: "Endocrinologie" },
        diagnostic: "Diabète type 2",
        medicaments: [{ nom: "Metformine", dosage: "1000mg", duree: "90 jours" }],
        notes: "HbA1c à 7.8"
      },
      {
        date: new Date("2024-06-22"),
        medecin: { nom: "Dr. Mansouri", specialite: "Cardiologie" },
        diagnostic: "HTA — ajustement traitement",
        tension: { systolique: 152, diastolique: 96 },
        medicaments: [
          { nom: "Amlodipine",  dosage: "10mg", duree: "30 jours" },
          { nom: "Furosémide",  dosage: "40mg", duree: "30 jours" }
        ],
        notes: "OMI bilatéraux"
      },
      {
        date: new Date("2024-11-15"),
        medecin: { nom: "Dr. Mansouri", specialite: "Cardiologie" },
        diagnostic: "HTA améliorée",
        tension: { systolique: 136, diastolique: 84 },
        medicaments: [{ nom: "Amlodipine", dosage: "5mg", duree: "30 jours" }],
        notes: ""
      }
    ]
  },
  // ── Patient 15 ──
  {
    cin: "199608253400015",
    nom: "Ferhat", prenom: "Imane",
    dateNaissance: new Date("1996-08-25"),
    sexe: "F",
    adresse: { wilaya: "Oran", commune: "Oran Centre" },
    groupeSanguin: "AB+",
    antecedents: [],
    allergies: ["Latex"],
    consultations: [
      {
        date: new Date("2024-03-30"),
        medecin: { nom: "Dr. Laib", specialite: "Médecine générale" },
        diagnostic: "Cystite aiguë",
        medicaments: [{ nom: "Fosfomycine", dosage: "3g", duree: "1 jour" }],
        notes: ""
      },
      {
        date: new Date("2024-08-01"),
        medecin: { nom: "Dr. Bekhti", specialite: "Pneumologie" },
        diagnostic: "Allergie respiratoire au latex",
        medicaments: [
          { nom: "Loratadine",   dosage: "10mg",  duree: "30 jours" },
          { nom: "Fluticasone",  dosage: "100µg", duree: "30 jours" }
        ],
        notes: "Éviter contact latex"
      }
    ]
  },
  // ── Patient 16 ──
  {
    cin: "196307192000016",
    nom: "Hadj Aissa", prenom: "Saïd",
    dateNaissance: new Date("1963-07-19"),
    sexe: "M",
    adresse: { wilaya: "Alger", commune: "El Harrach" },
    groupeSanguin: "B+",
    antecedents: ["Diabète type 2", "HTA", "Cardiopathie ischémique"],
    allergies: [],
    consultations: [
      {
        date: new Date("2023-08-10"),
        medecin: { nom: "Dr. Mansouri", specialite: "Cardiologie" },
        diagnostic: "Angor stable",
        medicaments: [
          { nom: "Aspirine",      dosage: "75mg",  duree: "180 jours" },
          { nom: "Bisoprolol",    dosage: "5mg",   duree: "180 jours" },
          { nom: "Atorvastatine", dosage: "40mg",  duree: "180 jours" }
        ],
        notes: "ETT réalisé"
      },
      {
        date: new Date("2024-01-18"),
        medecin: { nom: "Dr. Zerrouk", specialite: "Endocrinologie" },
        diagnostic: "Diabète type 2",
        medicaments: [{ nom: "Insuline Glargine", dosage: "24UI", duree: "30 jours" }],
        notes: "HbA1c à 8.5"
      },
      {
        date: new Date("2024-07-25"),
        medecin: { nom: "Dr. Mansouri", specialite: "Cardiologie" },
        diagnostic: "Bilan cardiologique annuel",
        tension: { systolique: 132, diastolique: 82 },
        medicaments: [],
        notes: "Stable — ECG inchangé"
      }
    ]
  },
  // ── Patient 17 ──
  {
    cin: "198411268600017",
    nom: "Tidjet", prenom: "Lynda",
    dateNaissance: new Date("1984-11-26"),
    sexe: "F",
    adresse: { wilaya: "Tizi Ouzou", commune: "Azazga" },
    groupeSanguin: "A+",
    antecedents: ["Migraine chronique"],
    allergies: [],
    consultations: [
      {
        date: new Date("2024-04-05"),
        medecin: { nom: "Dr. Laib", specialite: "Médecine générale" },
        diagnostic: "Crise migraineuse",
        medicaments: [
          { nom: "Sumatriptan", dosage: "50mg", duree: "PRN" },
          { nom: "Magnésium",   dosage: "300mg",duree: "30 jours" }
        ],
        notes: "Journal des crises recommandé"
      },
      {
        date: new Date("2024-09-11"),
        medecin: { nom: "Dr. Laib", specialite: "Médecine générale" },
        diagnostic: "Migraine — traitement de fond",
        medicaments: [
          { nom: "Propranolol", dosage: "40mg", duree: "90 jours" },
          { nom: "Magnésium",   dosage: "300mg",duree: "90 jours" }
        ],
        notes: "4 crises/mois → traitement de fond instauré"
      }
    ]
  },
  // ── Patient 18 ──
  {
    cin: "197602148100018",
    nom: "Sellami", prenom: "Nordine",
    dateNaissance: new Date("1976-02-14"),
    sexe: "M",
    adresse: { wilaya: "Annaba", commune: "Annaba Centre" },
    groupeSanguin: "O-",
    antecedents: ["HTA", "Dyslipidémie"],
    allergies: [],
    consultations: [
      {
        date: new Date("2024-01-05"),
        medecin: { nom: "Dr. Mansouri", specialite: "Cardiologie" },
        diagnostic: "Dyslipidémie — bilan",
        medicaments: [{ nom: "Rosuvastatine", dosage: "10mg", duree: "90 jours" }],
        notes: "LDL à 1.6 g/L"
      },
      {
        date: new Date("2024-05-20"),
        medecin: { nom: "Dr. Mansouri", specialite: "Cardiologie" },
        diagnostic: "HTA + Dyslipidémie suivies",
        tension: { systolique: 135, diastolique: 85 },
        medicaments: [
          { nom: "Ramipril",     dosage: "5mg",  duree: "30 jours" },
          { nom: "Rosuvastatine",dosage: "10mg", duree: "90 jours" }
        ],
        notes: "Objectifs LDL < 1.0 si risque élevé"
      },
      {
        date: new Date("2024-10-12"),
        medecin: { nom: "Dr. Mansouri", specialite: "Cardiologie" },
        diagnostic: "Contrôle lipidique — amélioré",
        tension: { systolique: 130, diastolique: 82 },
        medicaments: [],
        notes: "LDL à 0.9 g/L — objectif atteint"
      }
    ]
  },
  // ── Patient 19 ──
  {
    cin: "199109037200019",
    nom: "Chebli", prenom: "Rania",
    dateNaissance: new Date("1991-09-03"),
    sexe: "F",
    adresse: { wilaya: "Blida", commune: "Blida Centre" },
    groupeSanguin: "B+",
    antecedents: [],
    allergies: [],
    consultations: [
      {
        date: new Date("2024-04-22"),
        medecin: { nom: "Dr. Laib", specialite: "Médecine générale" },
        diagnostic: "Carence en vitamine D",
        medicaments: [{ nom: "Vit D3", dosage: "100 000UI", duree: "1 ampoule" }],
        notes: "25-OH Vit D à 10 ng/mL"
      },
      {
        date: new Date("2024-08-30"),
        medecin: { nom: "Dr. Laib", specialite: "Médecine générale" },
        diagnostic: "Fatigue chronique — bilan",
        medicaments: [{ nom: "Fer + Vit D", dosage: "60mg", duree: "30 jours" }],
        notes: "Contrôle NFS prévu"
      }
    ]
  },
  // ── Patient 20 ──
  {
    cin: "196205074600020",
    nom: "Benmoussa", prenom: "Hocine",
    dateNaissance: new Date("1962-05-07"),
    sexe: "M",
    adresse: { wilaya: "Sétif", commune: "Bougaa" },
    groupeSanguin: "A+",
    antecedents: ["Diabète type 2", "HTA", "Rétinopathie diabétique"],
    allergies: ["Sulfamides"],
    consultations: [
      {
        date: new Date("2023-11-28"),
        medecin: { nom: "Dr. Zerrouk", specialite: "Endocrinologie" },
        diagnostic: "Diabète type 2 — réévaluation",
        medicaments: [
          { nom: "Insuline Glargine",  dosage: "28UI", duree: "30 jours" },
          { nom: "Insuline Rapide",    dosage: "8UI",  duree: "30 jours" }
        ],
        notes: "HbA1c à 9.4 — schéma basal-bolus"
      },
      {
        date: new Date("2024-03-08"),
        medecin: { nom: "Dr. Mansouri", specialite: "Cardiologie" },
        diagnostic: "HTA — contrôle",
        tension: { systolique: 158, diastolique: 100 },
        medicaments: [
          { nom: "Amlodipine",  dosage: "10mg", duree: "30 jours" },
          { nom: "Ramipril",    dosage: "10mg", duree: "30 jours" }
        ],
        notes: "Risque CV très élevé"
      },
      {
        date: new Date("2024-07-16"),
        medecin: { nom: "Dr. Zerrouk", specialite: "Endocrinologie" },
        diagnostic: "Rétinopathie diabétique — suivi",
        medicaments: [],
        notes: "Fond d'œil : rétinopathie non proliférante — surveillance semestrielle"
      },
      {
        date: new Date("2024-11-05"),
        medecin: { nom: "Dr. Mansouri", specialite: "Cardiologie" },
        diagnostic: "HTA partiellement contrôlée",
        tension: { systolique: 144, diastolique: 90 },
        medicaments: [{ nom: "Furosémide", dosage: "40mg", duree: "30 jours" }],
        notes: "Ajout diurétique"
      }
    ]
  }
];

db.patients.insertMany(patients);
print("✅ " + db.patients.countDocuments() + " patients insérés.");

// ─── 1.3 : Collection analyses (référencée) ────────────────────────────────────
// On récupère les _id insérés pour les références
const p = {};
db.patients.find({}, { cin: 1 }).forEach(doc => { p[doc.cin] = doc._id; });

db.analyses.drop();

const analyses = [
  // Analyses patient 1 — Bensalem Ahmed
  {
    patient_id: p["198001012300001"],
    date: new Date("2024-01-14"),
    type: "Glycémie",
    resultats: { glycemie_a_jeun: 1.68, unite: "g/L", norme: "< 1.10" },
    laboratoire: "Labo Central Alger",
    valide: true
  },
  {
    patient_id: p["198001012300001"],
    date: new Date("2024-09-04"),
    type: "NFS",
    resultats: { hb: 13.2, gb: 7800, plaquettes: 230000 },
    laboratoire: "Labo Central Alger",
    valide: true
  },
  // Analyses patient 5 — Touati Abdelkader
  {
    patient_id: p["196508124200005"],
    date: new Date("2024-02-14"),
    type: "Créatinine",
    resultats: { creatinine: 180, DFG: 40, unite: "µmol/L" },
    laboratoire: "Labo Annaba",
    valide: true
  },
  {
    patient_id: p["196508124200005"],
    date: new Date("2024-02-14"),
    type: "Glycémie",
    resultats: { glycemie_a_jeun: 2.10, HbA1c: 9.1, unite: "g/L" },
    laboratoire: "Labo Annaba",
    valide: true
  },
  // Analyses patient 9 — Benali Mustapha
  {
    patient_id: p["196001013500009"],
    date: new Date("2024-01-19"),
    type: "Lipidogramme",
    resultats: { LDL: 1.80, HDL: 0.45, triglycerides: 2.10, unite: "g/L" },
    laboratoire: "Labo Oran",
    valide: true
  },
  {
    patient_id: p["196001013500009"],
    date: new Date("2024-01-19"),
    type: "Glycémie",
    resultats: { glycemie_a_jeun: 2.45, HbA1c: 9.1, unite: "g/L" },
    laboratoire: "Labo Oran",
    valide: true
  },
  // Analyses patient 10 — Guendouz Amina
  {
    patient_id: p["200205094900010"],
    date: new Date("2024-03-02"),
    type: "NFS",
    resultats: { hb: 8.2, vgm: 68, ferritine: 5, unite: "g/dL" },
    laboratoire: "Labo Constantine",
    valide: true
  },
  {
    patient_id: p["200205094900010"],
    date: new Date("2024-06-14"),
    type: "NFS",
    resultats: { hb: 10.5, vgm: 74, ferritine: 12, unite: "g/dL" },
    laboratoire: "Labo Constantine",
    valide: true
  },
  // Analyses patient 16 — Hadj Aissa Saïd
  {
    patient_id: p["196307192000016"],
    date: new Date("2024-01-17"),
    type: "ECG",
    resultats: { rythme: "Sinusal", fc: 68, anomalies: "Séquelles IDM antérieur" },
    laboratoire: "CHU Alger",
    valide: true
  },
  {
    patient_id: p["196307192000016"],
    date: new Date("2024-01-17"),
    type: "Glycémie",
    resultats: { glycemie_a_jeun: 1.95, HbA1c: 8.5, unite: "g/L" },
    laboratoire: "CHU Alger",
    valide: true
  },
  // Analyses patient 20 — Benmoussa Hocine
  {
    patient_id: p["196205074600020"],
    date: new Date("2023-11-27"),
    type: "Glycémie",
    resultats: { glycemie_a_jeun: 2.80, HbA1c: 9.4, unite: "g/L" },
    laboratoire: "Labo Sétif",
    valide: true
  },
  {
    patient_id: p["196205074600020"],
    date: new Date("2024-03-07"),
    type: "Lipidogramme",
    resultats: { LDL: 1.50, HDL: 0.38, triglycerides: 2.60, unite: "g/L" },
    laboratoire: "Labo Sétif",
    valide: true
  }
];

db.analyses.insertMany(analyses);

print("✅ Modélisation terminée. Patients insérés:", db.patients.countDocuments());
print("✅ Analyses insérées:", db.analyses.countDocuments());
