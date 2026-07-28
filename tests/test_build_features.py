import pandas as pd

from pipeline.build_features import build_feature_table


def _tiny_tables() -> dict[str, pd.DataFrame]:
    orders = pd.DataFrame({
        "order_id": ["o1", "o2", "o3"],
        "customer_id": ["c1", "c2", "c3"],
        "order_status": ["delivered", "delivered", "delivered"],
        "order_purchase_timestamp": pd.to_datetime(["2024-01-01", "2024-01-05", "2024-01-10"]),
        "order_delivered_customer_date": pd.to_datetime(["2024-01-10", "2024-01-12", "2024-01-25"]),
        "order_estimated_delivery_date": pd.to_datetime(["2024-01-08", "2024-01-15", "2024-01-20"]),
    })
    order_items = pd.DataFrame({
        "order_id": ["o1", "o2", "o3"],
        "order_item_id": [1, 1, 1],
        "product_id": ["p1", "p2", "p1"],
        "seller_id": ["s1", "s1", "s2"],
        "price": [100.0, 50.0, 200.0],
        "freight_value": [10.0, 5.0, 20.0],
    })
    products = pd.DataFrame({
        "product_id": ["p1", "p2"],
        "product_category_name": ["moveis_decoracao", "brinquedos"],
    })
    category_translation = pd.DataFrame({
        "product_category_name": ["moveis_decoracao", "brinquedos"],
        "product_category_name_english": ["furniture_decor", "toys"],
    })
    reviews = pd.DataFrame({
        "order_id": ["o1", "o2", "o3"],
        "review_score": [2, 5, 4],
    })
    return {
        "orders": orders,
        "order_items": order_items,
        "products": products,
        "category_translation": category_translation,
        "reviews": reviews,
    }


def test_build_feature_table_computes_delivery_delta_and_target():
    df = build_feature_table(_tiny_tables())
    row_o1 = df[df["order_id"] == "o1"].iloc[0]

    # o1: geliefert 2024-01-10, geschätzt 2024-01-08 -> 2 Tage zu spät
    assert row_o1["delivery_delta_days"] == 2
    # o1 hatte review_score=2 -> bad_review=1 (Ziel: schlechte Review <= 2)
    assert row_o1["bad_review"] == 1
    assert row_o1["category_english"] == "furniture_decor"


def test_build_feature_table_seller_avg_has_no_leakage():
    df = build_feature_table(_tiny_tables()).sort_values("purchase_timestamp")
    # o1 und o2 sind beide von Seller s1, o1 kommt zeitlich zuerst.
    # Für die ERSTE Bestellung eines Sellers darf noch keine eigene
    # Review in den Durchschnitt einfließen (sonst Leakage) - hier muss
    # der globale Durchschnitt verwendet werden.
    row_o1 = df[df["order_id"] == "o1"].iloc[0]
    global_mean = df["review_score"].mean()
    assert row_o1["seller_avg_review_prior"] == global_mean

    # o2 ist die ZWEITE Bestellung von Seller s1 -> seller_avg_review_prior
    # muss genau o1s review_score (=2) sein, nicht der eigene (=5).
    row_o2 = df[df["order_id"] == "o2"].iloc[0]
    assert row_o2["seller_avg_review_prior"] == 2
