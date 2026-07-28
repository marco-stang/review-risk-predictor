import sqlite3
from pathlib import Path

import pandas as pd


def risk_level(score: float) -> str:
    if score < 0.33:
        return "niedrig"
    if score < 0.66:
        return "mittel"
    return "hoch"


def write_snapshot(enriched_df: pd.DataFrame, feature_importance_df: pd.DataFrame, db_path: Path) -> None:
    """Schreibt zwei Tabellen in eine SQLite-Datei:
    - orders: eine Zeile pro Bestellung der Demo-Stichprobe
    - feature_importance: aggregierte SHAP-Werte über ALLE Bestellungen
    """
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(db_path)

    out = enriched_df.copy()
    out["risk_level"] = out["risk_score"].apply(risk_level)
    out.to_sql("orders", conn, if_exists="replace", index=False)
    feature_importance_df.to_sql("feature_importance", conn, if_exists="replace", index=False)

    conn.close()
