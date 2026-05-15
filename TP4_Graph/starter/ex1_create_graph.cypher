// ═══════════════════════════════════════════════════════════════════════════
// TP4 - Exercice 1 : Création du graphe UniConnect DZ  (SOLUTION COMPLÈTE)
// ═══════════════════════════════════════════════════════════════════════════

// ─── Nettoyage ─────────────────────────────────────────────────────────────
MATCH (n) DETACH DELETE n;

// ─── 1.1 : Contraintes d'unicité ──────────────────────────────────────────
CREATE CONSTRAINT etudiant_id IF NOT EXISTS FOR (e:Etudiant)   REQUIRE e.id IS UNIQUE;
CREATE CONSTRAINT cours_code  IF NOT EXISTS FOR (c:Cours)      REQUIRE c.code IS UNIQUE;
CREATE CONSTRAINT competence_nom IF NOT EXISTS FOR (c:Competence) REQUIRE c.nom IS UNIQUE;
CREATE CONSTRAINT club_nom    IF NOT EXISTS FOR (c:Club)        REQUIRE c.nom IS UNIQUE;
CREATE CONSTRAINT entreprise_nom IF NOT EXISTS FOR (e:Entreprise) REQUIRE e.nom IS UNIQUE;

// ─── 1.2 : Compétences ────────────────────────────────────────────────────
UNWIND [
  {nom: "Python",          categorie: "Programmation"},
  {nom: "Java",            categorie: "Programmation"},
  {nom: "C++",             categorie: "Programmation"},
  {nom: "SQL",             categorie: "Bases de Données"},
  {nom: "NoSQL",           categorie: "Bases de Données"},
  {nom: "Machine Learning",categorie: "IA"},
  {nom: "Deep Learning",   categorie: "IA"},
  {nom: "React",           categorie: "Web"},
  {nom: "Docker",          categorie: "DevOps"},
  {nom: "Linux",           categorie: "Systèmes"},
  {nom: "Réseaux",         categorie: "Infrastructure"},
  {nom: "Algorithmes",     categorie: "Fondamentaux"}
] AS comp
MERGE (:Competence {nom: comp.nom, categorie: comp.categorie});

// ─── 1.3 : Cours ──────────────────────────────────────────────────────────
UNWIND [
  {code: "INFO401", intitule: "Bases de Données Avancées",  credits: 6, dept: "Informatique"},
  {code: "INFO402", intitule: "Intelligence Artificielle",  credits: 6, dept: "Informatique"},
  {code: "INFO403", intitule: "Développement Web",          credits: 4, dept: "Informatique"},
  {code: "INFO404", intitule: "Systèmes Distribués",        credits: 5, dept: "Informatique"},
  {code: "INFO405", intitule: "Cloud Computing",            credits: 4, dept: "Informatique"},
  {code: "INFO406", intitule: "Algorithmique Avancée",      credits: 5, dept: "Informatique"},
  {code: "MATH301", intitule: "Statistiques et Probabilités",credits: 4, dept: "Mathématiques"},
  {code: "RESEAU201",intitule: "Réseaux Informatiques",     credits: 4, dept: "Télécommunications"}
] AS cours
MERGE (:Cours {code: cours.code, intitule: cours.intitule,
               credits: cours.credits, departement: cours.dept});

// ─── Relations Cours → Compétence (REQUIERT) ──────────────────────────────
MATCH (c:Cours {code:"INFO401"}), (k:Competence {nom:"SQL"})     MERGE (c)-[:REQUIERT]->(k);
MATCH (c:Cours {code:"INFO401"}), (k:Competence {nom:"NoSQL"})   MERGE (c)-[:REQUIERT]->(k);
MATCH (c:Cours {code:"INFO402"}), (k:Competence {nom:"Python"})  MERGE (c)-[:REQUIERT]->(k);
MATCH (c:Cours {code:"INFO402"}), (k:Competence {nom:"Machine Learning"}) MERGE (c)-[:REQUIERT]->(k);
MATCH (c:Cours {code:"INFO403"}), (k:Competence {nom:"React"})   MERGE (c)-[:REQUIERT]->(k);
MATCH (c:Cours {code:"INFO404"}), (k:Competence {nom:"Docker"})  MERGE (c)-[:REQUIERT]->(k);
MATCH (c:Cours {code:"INFO404"}), (k:Competence {nom:"Linux"})   MERGE (c)-[:REQUIERT]->(k);
MATCH (c:Cours {code:"INFO405"}), (k:Competence {nom:"Docker"})  MERGE (c)-[:REQUIERT]->(k);
MATCH (c:Cours {code:"INFO406"}), (k:Competence {nom:"Algorithmes"}) MERGE (c)-[:REQUIERT]->(k);
MATCH (c:Cours {code:"MATH301"}), (k:Competence {nom:"Machine Learning"}) MERGE (c)-[:REQUIERT]->(k);

// ─── 1.4 : Clubs ──────────────────────────────────────────────────────────
UNWIND [
  {nom: "Club IA USTHB",    universite: "USTHB", domaine: "Intelligence Artificielle"},
  {nom: "Club Dev UMBB",    universite: "UMBB",  domaine: "Développement Logiciel"},
  {nom: "Club Cyber USTO",  universite: "USTO",  domaine: "Cybersécurité"},
  {nom: "Club Data UMC",    universite: "UMC",   domaine: "Data Science"},
  {nom: "Club Réseau UBMA", universite: "UBMA",  domaine: "Réseaux & Télécoms"}
] AS cl
MERGE (:Club {nom: cl.nom, universite: cl.universite, domaine: cl.domaine});

// ─── 1.5 : Entreprises ────────────────────────────────────────────────────
UNWIND [
  {nom: "Sonatrach",  secteur: "Énergie",     ville: "Alger"},
  {nom: "Djezzy",     secteur: "Télécom",     ville: "Alger"},
  {nom: "Ooredoo",    secteur: "Télécom",     ville: "Alger"},
  {nom: "Ericsson DZ",secteur: "Technologie", ville: "Alger"},
  {nom: "NCA Rouiba", secteur: "Industrie",   ville: "Alger"}
] AS ent
MERGE (:Entreprise {nom: ent.nom, secteur: ent.secteur, ville: ent.ville});

// ─── 1.6 : Import CSV des 10 étudiants initiaux ───────────────────────────
// (exécuter depuis Neo4j Browser avec le fichier dans le dossier import/)
LOAD CSV WITH HEADERS FROM 'file:///students.csv' AS row
MERGE (e:Etudiant {id: row.id})
SET e.prenom     = row.prenom,
    e.nom        = row.nom,
    e.universite = row.universite,
    e.filiere    = row.filiere,
    e.annee      = toInteger(row.annee),
    e.ville      = row.ville;

// ─── 1.7 : 50 étudiants complets (UNWIND) ────────────────────────────────
UNWIND [
  {id:"E001",prenom:"Ahmed",  nom:"Bensalem",  universite:"USTHB",filiere:"Informatique", annee:3,ville:"Alger"},
  {id:"E002",prenom:"Fatima", nom:"Ouali",     universite:"USTHB",filiere:"Informatique", annee:3,ville:"Alger"},
  {id:"E003",prenom:"Karim",  nom:"Meziane",   universite:"UMBB", filiere:"Informatique", annee:2,ville:"Boumerdes"},
  {id:"E004",prenom:"Yasmina",nom:"Hamdi",     universite:"USTO", filiere:"Informatique", annee:4,ville:"Oran"},
  {id:"E005",prenom:"Rania",  nom:"Belkacem",  universite:"UMC",  filiere:"GL",           annee:3,ville:"Constantine"},
  {id:"E006",prenom:"Mehdi",  nom:"Derbal",    universite:"USTHB",filiere:"Electronique", annee:2,ville:"Alger"},
  {id:"E007",prenom:"Sara",   nom:"Amrani",    universite:"UBMA", filiere:"Telecoms",     annee:3,ville:"Annaba"},
  {id:"E008",prenom:"Youcef", nom:"Cherif",    universite:"UMBB", filiere:"Mathematiques",annee:4,ville:"Boumerdes"},
  {id:"E009",prenom:"Lina",   nom:"Boudia",    universite:"USTHB",filiere:"Informatique", annee:1,ville:"Alger"},
  {id:"E010",prenom:"Anis",   nom:"Haddar",    universite:"USTO", filiere:"GL",           annee:3,ville:"Oran"},
  {id:"E011",prenom:"Omar",   nom:"Bouzidi",   universite:"USTHB",filiere:"Informatique", annee:4,ville:"Alger"},
  {id:"E012",prenom:"Nadia",  nom:"Khelifi",   universite:"UMBB", filiere:"GL",           annee:2,ville:"Boumerdes"},
  {id:"E013",prenom:"Sofiane",nom:"Rahmani",   universite:"USTO", filiere:"Informatique", annee:3,ville:"Oran"},
  {id:"E014",prenom:"Imane",  nom:"Bouchikh",  universite:"UMC",  filiere:"Electronique", annee:2,ville:"Constantine"},
  {id:"E015",prenom:"Rachid", nom:"Mekki",     universite:"UBMA", filiere:"Informatique", annee:3,ville:"Annaba"},
  {id:"E016",prenom:"Houda",  nom:"Zouaoui",   universite:"USTHB",filiere:"Mathematiques",annee:1,ville:"Alger"},
  {id:"E017",prenom:"Bilal",  nom:"Chouikhi",  universite:"UMBB", filiere:"Informatique", annee:4,ville:"Boumerdes"},
  {id:"E018",prenom:"Asma",   nom:"Benali",    universite:"USTO", filiere:"Telecoms",     annee:2,ville:"Oran"},
  {id:"E019",prenom:"Tarek",  nom:"Aissaoui",  universite:"UMC",  filiere:"Informatique", annee:3,ville:"Constantine"},
  {id:"E020",prenom:"Loubna", nom:"Belmoktar", universite:"UBMA", filiere:"GL",           annee:1,ville:"Annaba"},
  {id:"E021",prenom:"Hocine", nom:"Touati",    universite:"USTHB",filiere:"Informatique", annee:2,ville:"Alger"},
  {id:"E022",prenom:"Meriem", nom:"Slimani",   universite:"UMBB", filiere:"Electronique", annee:3,ville:"Boumerdes"},
  {id:"E023",prenom:"Zakaria",nom:"Ferhat",    universite:"USTO", filiere:"Informatique", annee:1,ville:"Oran"},
  {id:"E024",prenom:"Sabrina",nom:"Guenifi",   universite:"UMC",  filiere:"GL",           annee:4,ville:"Constantine"},
  {id:"E025",prenom:"Ryad",   nom:"Benhamou",  universite:"UBMA", filiere:"Informatique", annee:2,ville:"Annaba"},
  {id:"E026",prenom:"Nawal",  nom:"Iddir",     universite:"USTHB",filiere:"Telecoms",     annee:3,ville:"Alger"},
  {id:"E027",prenom:"Djamel", nom:"Amara",     universite:"UMBB", filiere:"Informatique", annee:2,ville:"Boumerdes"},
  {id:"E028",prenom:"Karima", nom:"Ouadah",    universite:"USTO", filiere:"Mathematiques",annee:3,ville:"Oran"},
  {id:"E029",prenom:"Moussa", nom:"Belbachir", universite:"UMC",  filiere:"Informatique", annee:1,ville:"Constantine"},
  {id:"E030",prenom:"Sihem",  nom:"Bouguerba", universite:"UBMA", filiere:"GL",           annee:3,ville:"Annaba"},
  {id:"E031",prenom:"Redouane",nom:"Hamidi",   universite:"USTHB",filiere:"Informatique", annee:4,ville:"Alger"},
  {id:"E032",prenom:"Yasmine",nom:"Mezabi",    universite:"UMBB", filiere:"Informatique", annee:2,ville:"Boumerdes"},
  {id:"E033",prenom:"Ilyas",  nom:"Zidane",    universite:"USTO", filiere:"Electronique", annee:3,ville:"Oran"},
  {id:"E034",prenom:"Nour",   nom:"Tiziouine", universite:"UMC",  filiere:"Informatique", annee:2,ville:"Constantine"},
  {id:"E035",prenom:"Adel",   nom:"Benkhelfallah",universite:"UBMA",filiere:"Telecoms",   annee:4,ville:"Annaba"},
  {id:"E036",prenom:"Salma",  nom:"Belgherbi", universite:"USTHB",filiere:"GL",           annee:1,ville:"Alger"},
  {id:"E037",prenom:"Walid",  nom:"Benhammou", universite:"UMBB", filiere:"Informatique", annee:3,ville:"Boumerdes"},
  {id:"E038",prenom:"Ghania", nom:"Sebbane",   universite:"USTO", filiere:"GL",           annee:2,ville:"Oran"},
  {id:"E039",prenom:"Nazim",  nom:"Boussouf",  universite:"UMC",  filiere:"Informatique", annee:4,ville:"Constantine"},
  {id:"E040",prenom:"Amira",  nom:"Khaled",    universite:"UBMA", filiere:"Informatique", annee:1,ville:"Annaba"},
  {id:"E041",prenom:"Amine",  nom:"Berrabah",  universite:"USTHB",filiere:"Informatique", annee:3,ville:"Alger"},
  {id:"E042",prenom:"Djamila",nom:"Hadj",      universite:"UMBB", filiere:"Mathematiques",annee:2,ville:"Boumerdes"},
  {id:"E043",prenom:"Fares",  nom:"Mebarki",   universite:"USTO", filiere:"Informatique", annee:4,ville:"Oran"},
  {id:"E044",prenom:"Soraya", nom:"Bendjama",  universite:"UMC",  filiere:"GL",           annee:3,ville:"Constantine"},
  {id:"E045",prenom:"Raouf",  nom:"Chikhi",    universite:"UBMA", filiere:"Electronique", annee:2,ville:"Annaba"},
  {id:"E046",prenom:"Yasmine",nom:"Saadoune",  universite:"USTHB",filiere:"Informatique", annee:1,ville:"Alger"},
  {id:"E047",prenom:"Kamel",  nom:"Moulai",    universite:"UMBB", filiere:"Informatique", annee:4,ville:"Boumerdes"},
  {id:"E048",prenom:"Fatiha", nom:"Bousahla",  universite:"USTO", filiere:"Telecoms",     annee:2,ville:"Oran"},
  {id:"E049",prenom:"Lyamine",nom:"Debbache",  universite:"UMC",  filiere:"Informatique", annee:3,ville:"Constantine"},
  {id:"E050",prenom:"Wafa",   nom:"Belhadj",   universite:"UBMA", filiere:"GL",           annee:1,ville:"Annaba"}
] AS data
MERGE (e:Etudiant {id: data.id})
SET e += data;

// ─── 1.8 : Relations CONNAIT (graphe connexe garanti) ─────────────────────
// Contextes : cours, club, hasard, projet
UNWIND [
  {a:"E001",b:"E002",depuis:2022,contexte:"cours"},
  {a:"E001",b:"E006",depuis:2023,contexte:"club"},
  {a:"E001",b:"E009",depuis:2023,contexte:"cours"},
  {a:"E001",b:"E011",depuis:2021,contexte:"cours"},
  {a:"E001",b:"E003",depuis:2022,contexte:"projet"},
  {a:"E001",b:"E004",depuis:2023,contexte:"conference"},
  {a:"E002",b:"E012",depuis:2023,contexte:"cours"},
  {a:"E002",b:"E021",depuis:2022,contexte:"club"},
  {a:"E002",b:"E036",depuis:2023,contexte:"cours"},
  {a:"E003",b:"E017",depuis:2022,contexte:"cours"},
  {a:"E003",b:"E027",depuis:2021,contexte:"cours"},
  {a:"E003",b:"E008",depuis:2023,contexte:"projet"},
  {a:"E004",b:"E010",depuis:2022,contexte:"cours"},
  {a:"E004",b:"E013",depuis:2023,contexte:"club"},
  {a:"E004",b:"E023",depuis:2022,contexte:"cours"},
  {a:"E004",b:"E043",depuis:2021,contexte:"cours"},
  {a:"E005",b:"E019",depuis:2023,contexte:"club"},
  {a:"E005",b:"E024",depuis:2022,contexte:"cours"},
  {a:"E005",b:"E029",depuis:2023,contexte:"cours"},
  {a:"E005",b:"E010",depuis:2022,contexte:"conference"},
  {a:"E006",b:"E016",depuis:2023,contexte:"cours"},
  {a:"E006",b:"E041",depuis:2022,contexte:"club"},
  {a:"E006",b:"E003",depuis:2023,contexte:"projet"},
  {a:"E007",b:"E015",depuis:2022,contexte:"cours"},
  {a:"E007",b:"E025",depuis:2023,contexte:"club"},
  {a:"E007",b:"E035",depuis:2021,contexte:"cours"},
  {a:"E007",b:"E026",depuis:2023,contexte:"conference"},
  {a:"E008",b:"E022",depuis:2022,contexte:"cours"},
  {a:"E008",b:"E042",depuis:2023,contexte:"cours"},
  {a:"E009",b:"E016",depuis:2023,contexte:"cours"},
  {a:"E009",b:"E031",depuis:2022,contexte:"club"},
  {a:"E010",b:"E033",depuis:2023,contexte:"cours"},
  {a:"E010",b:"E038",depuis:2022,contexte:"cours"},
  {a:"E011",b:"E021",depuis:2021,contexte:"cours"},
  {a:"E011",b:"E031",depuis:2022,contexte:"club"},
  {a:"E011",b:"E041",depuis:2023,contexte:"cours"},
  {a:"E012",b:"E032",depuis:2022,contexte:"cours"},
  {a:"E012",b:"E037",depuis:2023,contexte:"projet"},
  {a:"E013",b:"E023",depuis:2022,contexte:"cours"},
  {a:"E013",b:"E043",depuis:2021,contexte:"cours"},
  {a:"E014",b:"E019",depuis:2023,contexte:"cours"},
  {a:"E014",b:"E034",depuis:2022,contexte:"club"},
  {a:"E014",b:"E005",depuis:2023,contexte:"conference"},
  {a:"E015",b:"E040",depuis:2022,contexte:"cours"},
  {a:"E016",b:"E046",depuis:2023,contexte:"cours"},
  {a:"E017",b:"E027",depuis:2021,contexte:"cours"},
  {a:"E017",b:"E032",depuis:2022,contexte:"cours"},
  {a:"E018",b:"E048",depuis:2023,contexte:"cours"},
  {a:"E019",b:"E039",depuis:2022,contexte:"club"},
  {a:"E019",b:"E049",depuis:2023,contexte:"cours"},
  {a:"E020",b:"E030",depuis:2022,contexte:"cours"},
  {a:"E020",b:"E050",depuis:2023,contexte:"cours"},
  {a:"E021",b:"E046",depuis:2022,contexte:"cours"},
  {a:"E022",b:"E042",depuis:2023,contexte:"cours"},
  {a:"E023",b:"E048",depuis:2022,contexte:"cours"},
  {a:"E024",b:"E039",depuis:2023,contexte:"club"},
  {a:"E024",b:"E044",depuis:2022,contexte:"cours"},
  {a:"E025",b:"E040",depuis:2023,contexte:"cours"},
  {a:"E026",b:"E006",depuis:2022,contexte:"club"},
  {a:"E027",b:"E047",depuis:2021,contexte:"cours"},
  {a:"E028",b:"E038",depuis:2022,contexte:"cours"},
  {a:"E029",b:"E044",depuis:2023,contexte:"cours"},
  {a:"E030",b:"E035",depuis:2022,contexte:"club"},
  {a:"E031",b:"E036",depuis:2023,contexte:"cours"},
  {a:"E032",b:"E037",depuis:2022,contexte:"cours"},
  {a:"E033",b:"E043",depuis:2023,contexte:"cours"},
  {a:"E034",b:"E049",depuis:2022,contexte:"cours"},
  {a:"E036",b:"E041",depuis:2021,contexte:"club"},
  {a:"E037",b:"E047",depuis:2022,contexte:"cours"},
  {a:"E038",b:"E048",depuis:2023,contexte:"cours"},
  {a:"E039",b:"E049",depuis:2022,contexte:"club"},
  {a:"E040",b:"E050",depuis:2023,contexte:"cours"},
  {a:"E044",b:"E049",depuis:2022,contexte:"cours"},
  {a:"E045",b:"E035",depuis:2023,contexte:"cours"},
  {a:"E045",b:"E025",depuis:2022,contexte:"club"}
] AS rel
MATCH (a:Etudiant {id: rel.a}), (b:Etudiant {id: rel.b})
MERGE (a)-[r:CONNAIT]->(b)
SET r.depuis = rel.depuis, r.contexte = rel.contexte;

// ─── 1.9 : Relations SUIT (étudiant → cours) ──────────────────────────────
UNWIND [
  {eid:"E001",code:"INFO401",semestre:"S5",note:16.5},
  {eid:"E001",code:"INFO402",semestre:"S5",note:14.0},
  {eid:"E002",code:"INFO401",semestre:"S5",note:17.0},
  {eid:"E002",code:"INFO403",semestre:"S5",note:15.5},
  {eid:"E003",code:"INFO401",semestre:"S3",note:13.0},
  {eid:"E003",code:"INFO406",semestre:"S3",note:12.5},
  {eid:"E004",code:"INFO402",semestre:"S7",note:18.0},
  {eid:"E004",code:"INFO404",semestre:"S7",note:16.0},
  {eid:"E005",code:"INFO403",semestre:"S5",note:14.5},
  {eid:"E006",code:"INFO401",semestre:"S3",note:11.0},
  {eid:"E007",code:"RESEAU201",semestre:"S5",note:15.0},
  {eid:"E008",code:"MATH301",semestre:"S7",note:17.5},
  {eid:"E009",code:"INFO406",semestre:"S1",note:10.5},
  {eid:"E010",code:"INFO403",semestre:"S5",note:13.5},
  {eid:"E011",code:"INFO402",semestre:"S7",note:15.0},
  {eid:"E011",code:"INFO404",semestre:"S7",note:14.5},
  {eid:"E013",code:"INFO401",semestre:"S5",note:12.0},
  {eid:"E017",code:"INFO401",semestre:"S7",note:16.0},
  {eid:"E017",code:"INFO404",semestre:"S7",note:15.0},
  {eid:"E019",code:"INFO402",semestre:"S5",note:13.5},
  {eid:"E021",code:"INFO406",semestre:"S3",note:14.0},
  {eid:"E024",code:"INFO403",semestre:"S7",note:16.5},
  {eid:"E031",code:"INFO402",semestre:"S7",note:17.0},
  {eid:"E031",code:"INFO404",semestre:"S7",note:16.0},
  {eid:"E039",code:"INFO402",semestre:"S7",note:15.5},
  {eid:"E041",code:"INFO401",semestre:"S5",note:14.0},
  {eid:"E043",code:"INFO404",semestre:"S7",note:15.5},
  {eid:"E047",code:"INFO401",semestre:"S7",note:16.5},
  {eid:"E049",code:"INFO402",semestre:"S5",note:13.0}
] AS rel
MATCH (e:Etudiant {id: rel.eid}), (c:Cours {code: rel.code})
MERGE (e)-[r:SUIT]->(c)
SET r.semestre = rel.semestre, r.note = rel.note;

// ─── 1.10 : Relations MAITRISE (étudiant → compétence) ───────────────────
UNWIND [
  {eid:"E001",comp:"Python",       niveau:"Avancé"},
  {eid:"E001",comp:"SQL",          niveau:"Intermédiaire"},
  {eid:"E001",comp:"Machine Learning",niveau:"Débutant"},
  {eid:"E002",comp:"Python",       niveau:"Intermédiaire"},
  {eid:"E002",comp:"React",        niveau:"Avancé"},
  {eid:"E002",comp:"SQL",          niveau:"Avancé"},
  {eid:"E003",comp:"Java",         niveau:"Intermédiaire"},
  {eid:"E003",comp:"Algorithmes",  niveau:"Avancé"},
  {eid:"E004",comp:"Python",       niveau:"Avancé"},
  {eid:"E004",comp:"Machine Learning",niveau:"Avancé"},
  {eid:"E004",comp:"Deep Learning",niveau:"Intermédiaire"},
  {eid:"E005",comp:"React",        niveau:"Intermédiaire"},
  {eid:"E006",comp:"Linux",        niveau:"Avancé"},
  {eid:"E006",comp:"Réseaux",      niveau:"Intermédiaire"},
  {eid:"E007",comp:"Réseaux",      niveau:"Avancé"},
  {eid:"E008",comp:"Python",       niveau:"Avancé"},
  {eid:"E008",comp:"Machine Learning",niveau:"Intermédiaire"},
  {eid:"E011",comp:"Python",       niveau:"Avancé"},
  {eid:"E011",comp:"Docker",       niveau:"Avancé"},
  {eid:"E011",comp:"Linux",        niveau:"Avancé"},
  {eid:"E017",comp:"Java",         niveau:"Avancé"},
  {eid:"E017",comp:"Docker",       niveau:"Intermédiaire"},
  {eid:"E021",comp:"Algorithmes",  niveau:"Avancé"},
  {eid:"E031",comp:"Python",       niveau:"Avancé"},
  {eid:"E031",comp:"Machine Learning",niveau:"Avancé"},
  {eid:"E039",comp:"Python",       niveau:"Intermédiaire"},
  {eid:"E039",comp:"React",        niveau:"Avancé"},
  {eid:"E041",comp:"SQL",          niveau:"Avancé"},
  {eid:"E041",comp:"NoSQL",        niveau:"Intermédiaire"},
  {eid:"E047",comp:"Java",         niveau:"Avancé"},
  {eid:"E047",comp:"SQL",          niveau:"Avancé"}
] AS rel
MATCH (e:Etudiant {id: rel.eid}), (k:Competence {nom: rel.comp})
MERGE (e)-[r:MAITRISE]->(k)
SET r.niveau = rel.niveau;

// ─── 1.11 : Relations MEMBRE_DE (étudiant → club) ─────────────────────────
UNWIND [
  {eid:"E001",club:"Club IA USTHB",    role:"Membre"},
  {eid:"E002",club:"Club IA USTHB",    role:"Trésorier"},
  {eid:"E006",club:"Club IA USTHB",    role:"Membre"},
  {eid:"E011",club:"Club IA USTHB",    role:"Président"},
  {eid:"E021",club:"Club IA USTHB",    role:"Membre"},
  {eid:"E003",club:"Club Dev UMBB",    role:"Vice-Président"},
  {eid:"E017",club:"Club Dev UMBB",    role:"Membre"},
  {eid:"E027",club:"Club Dev UMBB",    role:"Membre"},
  {eid:"E004",club:"Club Cyber USTO",  role:"Membre"},
  {eid:"E013",club:"Club Cyber USTO",  role:"Président"},
  {eid:"E005",club:"Club Data UMC",    role:"Membre"},
  {eid:"E019",club:"Club Data UMC",    role:"Vice-Président"},
  {eid:"E024",club:"Club Data UMC",    role:"Membre"},
  {eid:"E007",club:"Club Réseau UBMA", role:"Président"},
  {eid:"E025",club:"Club Réseau UBMA", role:"Membre"},
  {eid:"E035",club:"Club Réseau UBMA", role:"Secrétaire"}
] AS rel
MATCH (e:Etudiant {id: rel.eid}), (c:Club {nom: rel.club})
MERGE (e)-[r:MEMBRE_DE]->(c)
SET r.role = rel.role;

// ─── 1.12 : Relations A_STAGE_CHEZ ────────────────────────────────────────
UNWIND [
  {eid:"E004",ent:"Sonatrach",  annee:2023,duree:2},
  {eid:"E011",ent:"Ericsson DZ",annee:2022,duree:3},
  {eid:"E017",ent:"Djezzy",     annee:2023,duree:2},
  {eid:"E031",ent:"Ooredoo",    annee:2022,duree:3},
  {eid:"E039",ent:"NCA Rouiba", annee:2023,duree:2},
  {eid:"E043",ent:"Sonatrach",  annee:2023,duree:4},
  {eid:"E047",ent:"Ericsson DZ",annee:2022,duree:3}
] AS rel
MATCH (e:Etudiant {id: rel.eid}), (ent:Entreprise {nom: rel.ent})
MERGE (e)-[r:A_STAGE_CHEZ]->(ent)
SET r.annee = rel.annee, r.duree_mois = rel.duree;

// ─── Vérification finale ───────────────────────────────────────────────────
MATCH (n) RETURN labels(n)[0] AS type, count(n) AS total ORDER BY total DESC;
MATCH ()-[r]->() RETURN type(r) AS relation, count(r) AS total ORDER BY total DESC;
