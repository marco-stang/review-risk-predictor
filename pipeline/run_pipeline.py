import json
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

from pipeline.build_features import load_raw_tables, build_feature_table
from pipeline.train_model import encode_features, split_temporal, train_model, evaluate_model
from pipeline.explain import compute_shap_values, top_features
from pipeline.llm import get_llm
from pipeline.narrate import generate_explanation
from pipeline.snapshot import write_snapshot

# ~500 Bestellungen für die Demo-Stichprobe - ein LLM-Call pro Bestellung
# für alle ~100.000 Olist-Bestellungen wäre weder zeitlich noch finanziell
# sinnvoll (siehe Global Constraints im Plan).
SAMPLE_SIZE = 500
MODEL_PATH = Path(__file__).parent.parent / "models" / "risk_classifier.joblib"
DB_PATH = Path(__file__).parent.parent / "data" / "olist_snapshot.sqlite"


def run() -> None:
    tables = load_raw_tables()
    feature_df = build_feature_table(tables)
    encoded_df, feature_columns = encode_features(feature_df)

    train_df, test_df = split_temporal(encoded_df)
    model = train_model(train_df, feature_columns)
    metrics = evaluate_model(model, test_df, feature_columns)
    print(f"Modell-Metriken (Testset): {metrics}")

    MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump({"model": model, "feature_columns": feature_columns}, MODEL_PATH)

    # SHAP + Risiko-Score für ALLE Bestellungen (Basis für die globale
    # Feature-Wichtigkeits-Übersicht und für die Stichproben-Ziehung).
    shap_values = compute_shap_values(model, encoded_df[feature_columns])
    encoded_df = encoded_df.reset_index(drop=True)
    encoded_df["risk_score"] = model.predict_proba(encoded_df[feature_columns])[:, 1]

    feature_importance_df = pd.DataFrame({
        "feature": feature_columns,
        "mean_abs_shap": np.abs(shap_values).mean(axis=0),
    }).sort_values("mean_abs_shap", ascending=False).reset_index(drop=True)

    # Stratifizierte Stichprobe über Risiko-Terzile, damit die Demo eine
    # realistische Mischung aus niedrigem/mittlerem/hohem Risiko zeigt
    # (bei reinem Zufall wären es fast nur "niedrig", da schlechte Reviews
    # in den Rohdaten die Minderheit sind).
    # pd.qcut braucht genügend unterschiedliche Werte für 3 gleich große Bins -
    # bei einem stetigen Wahrscheinlichkeits-Score (GradientBoostingClassifier)
    # ist das in der Praxis so gut wie immer der Fall.
    encoded_df["risk_tercile"] = pd.qcut(encoded_df["risk_score"], 3, labels=["niedrig", "mittel", "hoch"])
    sample_df = (
        encoded_df.groupby("risk_tercile", group_keys=False)
        .apply(lambda g: g.sample(min(len(g), SAMPLE_SIZE // 3), random_state=42))
    )

    llm = get_llm()
    rows = []
    for idx, row in sample_df.iterrows():
        shap_row = shap_values[idx]
        drivers = top_features(shap_row, row, feature_columns)
        explanation = generate_explanation(drivers, row["risk_score"], llm)
        rows.append({
            "order_id": row["order_id"],
            "category_english": row["category_display"],
            "price": row["price"],
            "freight_value": row["freight_value"],
            "item_count": row["item_count"],
            "delivery_delta_days": row["delivery_delta_days"],
            "seller_avg_review_prior": row["seller_avg_review_prior"],
            "risk_score": row["risk_score"],
            "shap_drivers_json": json.dumps(drivers),
            "explanation": explanation,
        })

    enriched_df = pd.DataFrame(rows)
    write_snapshot(enriched_df, feature_importance_df, DB_PATH)
    print(f"Snapshot geschrieben: {DB_PATH} ({len(enriched_df)} Bestellungen)")


if __name__ == "__main__":
    run()
