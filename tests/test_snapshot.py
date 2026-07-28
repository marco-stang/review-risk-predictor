import sqlite3

import pandas as pd

from pipeline.snapshot import risk_level, write_snapshot


def test_risk_level_thresholds():
    assert risk_level(0.1) == "niedrig"
    assert risk_level(0.5) == "mittel"
    assert risk_level(0.9) == "hoch"


def test_write_snapshot_creates_both_tables(tmp_path):
    enriched_df = pd.DataFrame({
        "order_id": ["o1"],
        "category_english": ["toys"],
        "price": [100.0],
        "freight_value": [10.0],
        "item_count": [1],
        "delivery_delta_days": [2.0],
        "seller_avg_review_prior": [4.0],
        "risk_score": [0.72],
        "shap_drivers_json": ['[{"feature": "delivery_delta_days", "shap_value": 0.3, "feature_value": 2.0}]'],
        "explanation": ["Hohes Risiko wegen später Lieferung."],
    })
    feature_importance_df = pd.DataFrame({
        "feature": ["delivery_delta_days"],
        "mean_abs_shap": [0.28],
    })
    db_path = tmp_path / "snapshot.sqlite"

    write_snapshot(enriched_df, feature_importance_df, db_path)

    conn = sqlite3.connect(db_path)
    orders = pd.read_sql("SELECT * FROM orders", conn)
    importance = pd.read_sql("SELECT * FROM feature_importance", conn)
    conn.close()

    assert orders.loc[0, "risk_level"] == "hoch"
    assert importance.loc[0, "feature"] == "delivery_delta_days"
