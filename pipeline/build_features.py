from pathlib import Path

import pandas as pd

RAW_DIR = Path(__file__).parent.parent / "data" / "raw"

# Zuordnung Dateiname -> interner Tabellenname, exakt wie in
# sql-agent/src/load_olist.py (dieselben Rohdaten werden wiederverwendet).
FILES = {
    "olist_orders_dataset.csv": "orders",
    "olist_order_items_dataset.csv": "order_items",
    "olist_products_dataset.csv": "products",
    "olist_order_reviews_dataset.csv": "reviews",
    # Diese Datei hat ein UTF-8-BOM am Dateianfang - ohne encoding="utf-8-sig"
    # würde die erste Spalte "﻿product_category_name" statt
    # "product_category_name" heißen und der spätere Join stillschweigend
    # keine Treffer liefern.
    "product_category_name_translation.csv": "category_translation",
}


def load_raw_tables(raw_dir: Path = RAW_DIR) -> dict[str, pd.DataFrame]:
    tables = {}
    for filename, table_name in FILES.items():
        encoding = "utf-8-sig" if table_name == "category_translation" else "utf-8"
        tables[table_name] = pd.read_csv(raw_dir / filename, encoding=encoding)
    return tables


def build_feature_table(tables: dict[str, pd.DataFrame]) -> pd.DataFrame:
    orders = tables["orders"].copy()
    for col in ["order_purchase_timestamp", "order_delivered_customer_date", "order_estimated_delivery_date"]:
        orders[col] = pd.to_datetime(orders[col])

    # Nur tatsächlich zugestellte Bestellungen mit bekanntem Lieferdatum
    # ergeben ein sinnvolles delivery_delta_days.
    orders = orders[
        (orders["order_status"] == "delivered")
        & orders["order_delivered_customer_date"].notna()
    ]

    # Eine Bestellung kann mehrere Artikel-Zeilen haben - Umsatz-Regel wie
    # in sql-agent/docs/schema.md: price/freight_value werden über die
    # Artikel SUMMIERT, nicht aus payments übernommen.
    items = tables["order_items"]
    items_agg = items.groupby("order_id").agg(
        price=("price", "sum"),
        freight_value=("freight_value", "sum"),
        item_count=("order_item_id", "count"),
        seller_id=("seller_id", "first"),  # bewusst vereinfacht: erster Seller der Bestellung
        product_id=("product_id", "first"),
    ).reset_index()

    products = tables["products"][["product_id", "product_category_name"]]
    category_translation = tables["category_translation"]

    items_agg = items_agg.merge(products, on="product_id", how="left")
    items_agg = items_agg.merge(category_translation, on="product_category_name", how="left")
    items_agg["category_english"] = items_agg["product_category_name_english"].fillna("unknown")

    reviews = tables["reviews"][["order_id", "review_score"]].drop_duplicates(
        subset="order_id", keep="first"
    )

    df = (
        orders[["order_id", "order_purchase_timestamp", "order_delivered_customer_date", "order_estimated_delivery_date"]]
        .merge(items_agg, on="order_id", how="inner")
        .merge(reviews, on="order_id", how="inner")
    )

    df["delivery_delta_days"] = (
        df["order_delivered_customer_date"] - df["order_estimated_delivery_date"]
    ).dt.days

    # seller_avg_review_prior: zeitlich sortiert je Seller, dann der
    # gleitende Durchschnitt ALLER VORHERIGEN Reviews (shift(1) vor
    # expanding-mean) - die aktuelle Bestellung selbst darf nicht in ihren
    # eigenen Feature-Wert einfließen, sonst Data Leakage.
    df = df.sort_values(["seller_id", "order_purchase_timestamp"]).reset_index(drop=True)
    df["seller_avg_review_prior"] = (
        df.groupby("seller_id")["review_score"]
        .apply(lambda s: s.shift().expanding().mean())
        .reset_index(level=0, drop=True)
    )
    global_mean = df["review_score"].mean()
    df["seller_avg_review_prior"] = df["seller_avg_review_prior"].fillna(global_mean)

    df["bad_review"] = (df["review_score"] <= 2).astype(int)
    df = df.rename(columns={"order_purchase_timestamp": "purchase_timestamp"})

    return df[
        [
            "order_id",
            "purchase_timestamp",
            "category_english",
            "price",
            "freight_value",
            "item_count",
            "delivery_delta_days",
            "seller_avg_review_prior",
            "review_score",
            "bad_review",
        ]
    ]
