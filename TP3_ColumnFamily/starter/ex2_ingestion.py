"""
TP3 - Exercice 2 : Ingestion de données IoT
Use Case : SmartGrid DZ - 10 000 capteurs, 5 minutes de mesures
"""
from cassandra.cluster import Cluster
from cassandra.query import BatchStatement, BatchType
import uuid
import random
from datetime import datetime, timedelta
import time

# ─── Configuration ─────────────────────────────────────────────────────────────
CASSANDRA_HOST = 'localhost'
KEYSPACE = 'smartgrid'
NB_CAPTEURS = 10_000
MINUTES_HISTORIQUE = 5
BATCH_SIZE = 50          # Bonne pratique : max 50 items par batch Cassandra
TTL_MESURES = 7_776_000  # 90 jours en secondes

WILAYAS = ["Alger", "Oran", "Constantine", "Annaba", "Blida"]
COMMUNES = {
    "Alger":       ["Bab Ezzouar", "Hydra", "El Harrach", "Dar El Beida"],
    "Oran":        ["Bir El Djir", "Es Senia", "Arzew"],
    "Constantine": ["El Khroub", "Ain Smara", "Hamma Bouziane"],
    "Annaba":      ["El Bouni", "El Hadjar", "Seraidi"],
    "Blida":       ["Bougara", "Boufarik", "Larbaa"],
}


# ─── Connexion ─────────────────────────────────────────────────────────────────
def connect():
    """Connexion au cluster Cassandra."""
    cluster = Cluster([CASSANDRA_HOST])
    session = cluster.connect(KEYSPACE)
    print(f"✔ Connecté à Cassandra — keyspace : {KEYSPACE}")
    return session, cluster


# ─── Génération d'une mesure ───────────────────────────────────────────────────
def generate_mesure(capteur_id, wilaya, commune, timestamp):
    """Génère une mesure réaliste pour un capteur électrique algérien."""
    tension = round(220 + random.gauss(0, 5), 2)   # 220V ± 5V
    courant = round(random.uniform(0.5, 15.0), 2)
    alerte  = tension < 200 or tension > 240 or random.random() < 0.05

    return {
        "capteur_id":   capteur_id,
        "date_jour":    timestamp.date(),
        "timestamp":    timestamp,
        "wilaya":       wilaya,
        "commune":      commune,
        "tension_v":    tension,
        "courant_a":    courant,
        "puissance_kw": round(tension * courant / 1000, 3),
        "frequence_hz": round(50 + random.gauss(0, 0.1), 2),
        "temperature":  round(random.uniform(20, 65), 1),
        "alerte":       alerte,
        "code_alerte":  "VOLT_OOB" if alerte else None,
    }


# ─── 2.1 : Prepared statements ─────────────────────────────────────────────────
def prepare_statements(session):
    """Prépare les statements CQL réutilisables (plan de requête compilé une seule fois)."""

    insert_mesure = session.prepare("""
        INSERT INTO mesures_par_capteur
            (capteur_id, date_jour, timestamp, wilaya, commune,
             tension_v, courant_a, puissance_kw, frequence_hz,
             temperature, alerte, code_alerte)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        USING TTL ?
    """)

    insert_alerte = session.prepare("""
        INSERT INTO alertes_par_wilaya
            (wilaya, date_jour, timestamp, capteur_id,
             code_alerte, description, gravite, resolue)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        USING TTL 31536000
    """)

    return insert_mesure, insert_alerte


# ─── 2.2 : Insertion simple (single row) ───────────────────────────────────────
def insert_single(session, prepared_stmt, mesure, ttl=TTL_MESURES):
    """
    Insère une seule mesure via un prepared statement.
    Utile pour les tests unitaires ou les insertions ponctuelles.
    """
    session.execute(prepared_stmt, (
        mesure["capteur_id"],
        mesure["date_jour"],
        mesure["timestamp"],
        mesure["wilaya"],
        mesure["commune"],
        mesure["tension_v"],
        mesure["courant_a"],
        mesure["puissance_kw"],
        mesure["frequence_hz"],
        mesure["temperature"],
        mesure["alerte"],
        mesure["code_alerte"],
        ttl,
    ))


# ─── 2.3 : Insertion par batch ─────────────────────────────────────────────────
def insert_batch(session, prepared_stmt, mesures: list, ttl=TTL_MESURES):
    """
    Insère un lot de mesures en UNLOGGED BATCH.

    Pourquoi UNLOGGED ?
    - Les LOGGED BATCH (défaut) garantissent l'atomicité cross-partition via un
      journal Cassandra, ce qui est coûteux et inutile pour des séries temporelles
      indépendantes.
    - UNLOGGED BATCH regroupe les requêtes vers le même coordinateur sans overhead
      de journalisation → meilleur débit pour l'IoT.

    Bonne pratique : max ~50 lignes par batch (évite les timeouts coordinateur).
    """
    for i in range(0, len(mesures), BATCH_SIZE):
        chunk = mesures[i : i + BATCH_SIZE]
        batch = BatchStatement(batch_type=BatchType.UNLOGGED)
        for m in chunk:
            batch.add(prepared_stmt, (
                m["capteur_id"],
                m["date_jour"],
                m["timestamp"],
                m["wilaya"],
                m["commune"],
                m["tension_v"],
                m["courant_a"],
                m["puissance_kw"],
                m["frequence_hz"],
                m["temperature"],
                m["alerte"],
                m["code_alerte"],
                ttl,
            ))
        session.execute(batch)


# ─── 2.4 : Insertion des alertes ───────────────────────────────────────────────
def insert_alertes(session, prepared_alerte, mesures: list):
    """
    Insère dans alertes_par_wilaya les mesures dont alerte == True.
    Environ 10 % des mesures dépassent le seuil (5 % aléatoires + tension OOB).
    """
    alertes = [m for m in mesures if m["alerte"]]
    if not alertes:
        return 0

    batch = BatchStatement(batch_type=BatchType.UNLOGGED)
    for a in alertes:
        gravite = 3 if (a["tension_v"] < 200 or a["tension_v"] > 240) else 2
        batch.add(prepared_alerte, (
            a["wilaya"],
            a["date_jour"],
            a["timestamp"],
            a["capteur_id"],
            a["code_alerte"] or "ALERTE",
            f"Tension={a['tension_v']}V  Courant={a['courant_a']}A",
            gravite,
            False,          # non résolue à l'insertion
        ))
        if len(batch) >= BATCH_SIZE:
            session.execute(batch)
            batch = BatchStatement(batch_type=BatchType.UNLOGGED)

    if len(batch) > 0:
        session.execute(batch)

    return len(alertes)


# ─── 2.5 : Pipeline d'ingestion principal ─────────────────────────────────────
def run_ingestion(session):
    """
    Génère et insère NB_CAPTEURS × MINUTES_HISTORIQUE mesures.
    Affiche le débit d'ingestion en mesures/seconde.
    """
    print(f"\n Démarrage ingestion : {NB_CAPTEURS:,} capteurs × {MINUTES_HISTORIQUE} min")
    insert_mesure, insert_alerte = prepare_statements(session)

    # Générer les métadonnées des capteurs (une seule fois)
    capteurs = []
    for _ in range(NB_CAPTEURS):
        wilaya  = random.choice(WILAYAS)
        commune = random.choice(COMMUNES[wilaya])
        capteurs.append((uuid.uuid4(), wilaya, commune))

    total_insertions = 0
    total_alertes    = 0
    now              = datetime.utcnow().replace(second=0, microsecond=0)

    start = time.time()

    for minute_offset in range(MINUTES_HISTORIQUE):
        ts      = now - timedelta(minutes=minute_offset)
        mesures = [generate_mesure(cid, w, c, ts) for cid, w, c in capteurs]

        # Insertion en batch dans mesures_par_capteur
        insert_batch(session, insert_mesure, mesures)

        # Insertion des alertes dans alertes_par_wilaya
        nb_alertes = insert_alertes(session, insert_alerte, mesures)

        total_insertions += len(mesures)
        total_alertes    += nb_alertes
        print(f"  Minute -{minute_offset:02d} : {len(mesures):,} mesures | {nb_alertes} alertes insérées")

    elapsed = time.time() - start
    print(f"\n Ingestion terminée")
    print(f"   Mesures totales : {total_insertions:,}")
    print(f"   Alertes totales : {total_alertes:,}  ({total_alertes/total_insertions*100:.1f} %)")
    print(f"   Durée           : {elapsed:.2f} s")
    print(f"   Débit           : {total_insertions/elapsed:,.0f} mesures/seconde")


# ─── Point d'entrée ────────────────────────────────────────────────────────────
if __name__ == "__main__":
    session, cluster = connect()
    try:
        run_ingestion(session)
    finally:
        cluster.shutdown()
        print("\n Connexion fermée.")
