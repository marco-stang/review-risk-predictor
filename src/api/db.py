import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).parent.parent.parent / "data" / "olist_snapshot.sqlite"


def get_connection(db_path: Path = DB_PATH) -> sqlite3.Connection:
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    return conn


def get_db():
    """FastAPI-Dependency - in Tests per app.dependency_overrides ersetzbar,
    damit Tests eine In-Memory-SQLite-Fixture statt der echten Snapshot-Datei
    verwenden (siehe tests/conftest.py)."""
    conn = get_connection()
    try:
        yield conn
    finally:
        conn.close()
