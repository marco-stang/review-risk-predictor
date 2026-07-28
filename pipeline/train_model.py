import pandas as pd
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.metrics import precision_score, recall_score, roc_auc_score

CATEGORY_COLUMN = "category_english"
TOP_N_CATEGORIES = 15
NUMERIC_COLUMNS = [
    "price",
    "freight_value",
    "item_count",
    "delivery_delta_days",
    "seller_avg_review_prior",
]


def encode_features(df: pd.DataFrame) -> tuple[pd.DataFrame, list[str]]:
    """One-Hot-kodiert die Kategorie-Spalte (Top-15-Kategorien + 'other').

    Rückgabe: (encoded_df, feature_columns). feature_columns ist die exakte,
    geordnete Spaltenliste, die später für Training, Vorhersage UND SHAP
    konsistent verwendet werden muss - sonst passen Spaltenreihenfolge/-anzahl
    nicht mehr zusammen. `category_display` bleibt zusätzlich als lesbarer
    Klartext-Wert erhalten (wird nicht als Feature genutzt, nur für die
    spätere Anzeige im Frontend gebraucht).
    """
    df = df.copy()
    top_categories = df[CATEGORY_COLUMN].value_counts().nlargest(TOP_N_CATEGORIES).index
    df["category_display"] = df[CATEGORY_COLUMN].where(df[CATEGORY_COLUMN].isin(top_categories), "other")

    dummies = pd.get_dummies(df["category_display"], prefix="category")
    feature_columns = NUMERIC_COLUMNS + list(dummies.columns)

    id_columns = [c for c in ["order_id", "purchase_timestamp", "bad_review", "category_display"] if c in df.columns]
    encoded_df = pd.concat([df[id_columns], df[NUMERIC_COLUMNS], dummies], axis=1)
    return encoded_df, feature_columns


def split_temporal(df: pd.DataFrame, test_frac: float = 0.2) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Zeitlicher statt zufälliger Split: die neuesten test_frac Bestellungen
    bilden das Testset. Zufälliger Split würde optimistisch verzerrte
    Metriken liefern, weil zeitliche Trends (z.B. saisonale Lieferzeiten)
    zwischen Train und Test durchmischt würden."""
    df_sorted = df.sort_values("purchase_timestamp").reset_index(drop=True)
    split_idx = int(len(df_sorted) * (1 - test_frac))
    return df_sorted.iloc[:split_idx], df_sorted.iloc[split_idx:]


def train_model(train_df: pd.DataFrame, feature_columns: list[str]) -> GradientBoostingClassifier:
    model = GradientBoostingClassifier(random_state=42)
    model.fit(train_df[feature_columns], train_df["bad_review"])
    return model


def evaluate_model(model: GradientBoostingClassifier, test_df: pd.DataFrame, feature_columns: list[str]) -> dict:
    proba = model.predict_proba(test_df[feature_columns])[:, 1]
    preds = (proba >= 0.5).astype(int)
    return {
        "roc_auc": float(roc_auc_score(test_df["bad_review"], proba)),
        "precision": float(precision_score(test_df["bad_review"], preds, zero_division=0)),
        "recall": float(recall_score(test_df["bad_review"], preds, zero_division=0)),
    }
