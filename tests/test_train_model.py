import numpy as np
import pandas as pd

from pipeline.train_model import encode_features, evaluate_model, split_temporal, train_model


def _fake_feature_df(n: int = 40) -> pd.DataFrame:
    rng = np.random.default_rng(42)
    categories = (["furniture_decor", "toys", "electronics"] * (n // 3 + 1))[:n]
    return pd.DataFrame({
        "order_id": [f"o{i}" for i in range(n)],
        "purchase_timestamp": pd.date_range("2024-01-01", periods=n, freq="D"),
        "category_english": categories,
        "price": rng.uniform(20, 300, n),
        "freight_value": rng.uniform(5, 40, n),
        "item_count": rng.integers(1, 4, n),
        "delivery_delta_days": rng.uniform(-5, 15, n),
        "seller_avg_review_prior": rng.uniform(2, 5, n),
        "bad_review": rng.integers(0, 2, n),
    })


def test_encode_features_returns_consistent_columns():
    df = _fake_feature_df()
    encoded_df, feature_columns = encode_features(df)

    assert "order_id" in encoded_df.columns
    assert "category_display" in encoded_df.columns
    for col in feature_columns:
        assert col in encoded_df.columns
    assert "price" in feature_columns
    assert "delivery_delta_days" in feature_columns


def test_split_temporal_keeps_chronological_order():
    df = _fake_feature_df()
    encoded_df, _ = encode_features(df)
    train_df, test_df = split_temporal(encoded_df, test_frac=0.25)

    assert train_df["purchase_timestamp"].max() <= test_df["purchase_timestamp"].min()
    assert len(train_df) + len(test_df) == len(encoded_df)


def test_train_and_evaluate_model_returns_metrics():
    df = _fake_feature_df()
    encoded_df, feature_columns = encode_features(df)
    train_df, test_df = split_temporal(encoded_df, test_frac=0.25)

    model = train_model(train_df, feature_columns)
    metrics = evaluate_model(model, test_df, feature_columns)

    assert set(metrics.keys()) == {"roc_auc", "precision", "recall"}
    assert 0.0 <= metrics["roc_auc"] <= 1.0
