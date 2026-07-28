import numpy as np
import pandas as pd
import shap


def compute_shap_values(model, X: pd.DataFrame) -> np.ndarray:
    """TreeExplainer funktioniert direkt mit sklearn-Baummodellen
    (GradientBoostingClassifier) ohne weiteres Sampling/Approximation."""
    explainer = shap.TreeExplainer(model)
    return explainer.shap_values(X)


def top_features(
    shap_row: np.ndarray,
    feature_row: pd.Series,
    feature_columns: list[str],
    n: int = 3,
) -> list[dict]:
    """Sortiert nach absolutem SHAP-Wert (größter Einfluss zuerst,
    unabhängig davon ob der Beitrag das Risiko erhöht oder senkt)."""
    order = np.argsort(-np.abs(shap_row))[:n]
    return [
        {
            "feature": feature_columns[i],
            "shap_value": float(shap_row[i]),
            "feature_value": float(feature_row[feature_columns[i]]),
        }
        for i in order
    ]
