// ═══════════════════════════════════════════════════════════════════════════
// TP4 - Exercice 3 : Algorithmes de Graphe (SOLUTION COMPLÈTE)
// Prérequis : Plugin Graph Data Science (GDS) installé
// ═══════════════════════════════════════════════════════════════════════════


// ─── 3.1 : Plus court chemin entre Ahmed et Yasmina ───────────────────────
// "Comment Ahmed peut-il rencontrer Yasmina ?"
MATCH p = shortestPath(
  (a:Etudiant {prenom: "Ahmed"})-[:CONNAIT*..10]-(b:Etudiant {prenom: "Yasmina"})
)
RETURN [n IN nodes(p) | n.prenom + " (" + n.universite + ")"] AS chemin,
       length(p) AS nb_intermediaires;

// Version enrichie : afficher aussi les universités et contextes des liens
MATCH p = shortestPath(
  (a:Etudiant {prenom: "Ahmed"})-[:CONNAIT*..10]-(b:Etudiant {prenom: "Yasmina"})
)
WITH nodes(p) AS etapes, relationships(p) AS liens
RETURN [n IN etapes  | n.prenom + " @ " + n.universite]    AS chemin_detail,
       [r IN liens   | r.contexte]                          AS contextes,
       size(etapes) - 1                                     AS distance;


// ─── 3.2 : Centralité de degré (Top 10 étudiants les plus connectés) ──────

// Créer la projection du graphe en mémoire (supprimer si elle existe déjà)
CALL gds.graph.exists('reseau_social') YIELD exists
WITH exists WHERE exists
CALL gds.graph.drop('reseau_social') YIELD graphName
RETURN graphName;

// Projection du graphe social (non-orienté)
CALL gds.graph.project(
  'reseau_social',
  'Etudiant',
  {CONNAIT: {orientation: 'UNDIRECTED'}}
);

// Calcul de la centralité de degré
CALL gds.degree.stream('reseau_social')
YIELD nodeId, score
WITH gds.util.asNode(nodeId) AS etudiant, score
RETURN etudiant.prenom     AS prenom,
       etudiant.nom        AS nom,
       etudiant.universite AS universite,
       etudiant.filiere    AS filiere,
       toInteger(score)    AS nb_connexions
ORDER BY nb_connexions DESC
LIMIT 10;

// Écrire le score de centralité sur chaque nœud (pour visualisation)
CALL gds.degree.write('reseau_social', {writeProperty: 'degreeCentrality'})
YIELD nodePropertiesWritten, centralityDistribution
RETURN nodePropertiesWritten,
       round(centralityDistribution.mean,   2) AS moyenne,
       round(centralityDistribution.max,    2) AS maximum,
       round(centralityDistribution.p75,    2) AS p75;


// ─── 3.3 : Détection de communautés — algorithme de Louvain ──────────────

// Stream : afficher les communautés sans écrire dans la base
CALL gds.louvain.stream('reseau_social')
YIELD nodeId, communityId
WITH communityId,
     collect(gds.util.asNode(nodeId).prenom)      AS membres,
     collect(gds.util.asNode(nodeId).universite)  AS universites
RETURN communityId,
       size(membres)                               AS taille,
       membres[0..6]                               AS exemple_membres,
       // Université dominante dans la communauté
       [u IN universites WHERE u IS NOT NULL]      AS toutes_universites
ORDER BY taille DESC;

// Write : persister communityId sur chaque nœud Etudiant
CALL gds.louvain.write('reseau_social', {writeProperty: 'communityId'})
YIELD communityCount, modularity, modularities
RETURN communityCount                              AS nb_communautes,
       round(modularity, 4)                        AS score_modularite;

// Résumé lisible des communautés détectées
MATCH (e:Etudiant)
WITH e.communityId AS communaute, collect(e.prenom) AS membres,
     collect(DISTINCT e.universite) AS universites
RETURN communaute,
       size(membres)                AS nb_membres,
       membres[0..5]                AS exemples,
       universites                  AS universites_representees
ORDER BY nb_membres DESC;


// ─── 3.4 : Recommandation de contacts pour Ahmed ─────────────────────────
// Score = amis_communs×3 + cours_communs×2 + même_filière×1

MATCH (moi:Etudiant {prenom: "Ahmed"})

// Candidats = étudiants non encore connus à distance 2
MATCH (moi)-[:CONNAIT]-(ami:Etudiant)-[:CONNAIT]-(candidat:Etudiant)
WHERE candidat <> moi
  AND NOT (moi)-[:CONNAIT]-(candidat)

// Compter les amis en commun
WITH moi, candidat,
     count(DISTINCT ami) AS amis_communs

// Compter les cours en commun
OPTIONAL MATCH (moi)-[:SUIT]->(cours:Cours)<-[:SUIT]-(candidat)
WITH moi, candidat, amis_communs,
     count(DISTINCT cours) AS cours_communs

// Bonus même filière
WITH moi, candidat, amis_communs, cours_communs,
     CASE WHEN moi.filiere = candidat.filiere THEN 1 ELSE 0 END AS meme_filiere

// Score pondéré
WITH candidat,
     amis_communs * 3 + cours_communs * 2 + meme_filiere AS score,
     amis_communs, cours_communs, meme_filiere

RETURN candidat.prenom     AS suggestion,
       candidat.universite AS universite,
       candidat.filiere    AS filiere,
       score               AS score_recommandation,
       amis_communs        AS amis_en_commun,
       cours_communs       AS cours_en_commun,
       meme_filiere        AS meme_filiere
ORDER BY score DESC
LIMIT 5;


// ─── 3.5 : Chemin de compétences vers "Machine Learning" ──────────────────
// "Quels cours dois-je suivre pour maîtriser Machine Learning ?"

// Cours qui REQUIERT directement Machine Learning
MATCH (c:Cours)-[:REQUIERT]->(but:Competence {nom: "Machine Learning"})
RETURN c.intitule AS cours, c.credits AS credits,
       "Accès direct à Machine Learning" AS chemin;

// Chemin complet : cours → compétences prérequises → Machine Learning
MATCH path = (debut:Cours)-[:REQUIERT*1..3]->(but:Competence {nom: "Machine Learning"})
WITH path,
     [n IN nodes(path) |
       CASE WHEN n:Cours      THEN "📘 " + n.intitule
            WHEN n:Competence THEN "🎯 " + n.nom
       END
     ] AS parcours
RETURN DISTINCT parcours,
                length(path) AS nb_etapes
ORDER BY nb_etapes;

// Quels étudiants maîtrisent déjà des compétences liées au ML ?
MATCH (e:Etudiant)-[m:MAITRISE]->(k:Competence)
WHERE k.nom IN ["Machine Learning","Deep Learning","Python","Algorithmes"]
WITH e, collect(k.nom + " (" + m.niveau + ")") AS competences_ml
WHERE size(competences_ml) >= 2
RETURN e.prenom AS etudiant, e.universite AS universite,
       competences_ml AS competences_liees_ML
ORDER BY size(competences_ml) DESC;


// ─── BONUS : PageRank sur les cours populaires ────────────────────────────
// Projection incluant étudiants ET cours
CALL gds.graph.exists('cours_graph') YIELD exists
WITH exists WHERE exists
CALL gds.graph.drop('cours_graph') YIELD graphName RETURN graphName;

CALL gds.graph.project(
  'cours_graph',
  ['Etudiant','Cours'],
  {SUIT: {orientation: 'NATURAL'}}
);

CALL gds.pageRank.stream('cours_graph')
YIELD nodeId, score
WITH gds.util.asNode(nodeId) AS noeud, score
WHERE noeud:Cours
RETURN noeud.intitule AS cours,
       noeud.credits  AS credits,
       round(score, 4) AS pagerank_score
ORDER BY pagerank_score DESC;

// Nettoyage des projections
CALL gds.graph.drop('reseau_social') YIELD graphName;
CALL gds.graph.drop('cours_graph')   YIELD graphName;
