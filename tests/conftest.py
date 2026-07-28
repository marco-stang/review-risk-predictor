import json
import sqlite3

import pytest
from fastapi.testclient import TestClient

from src.api.db import get_db
from src.api.main import app


@pytest.fixture
def test_conn():
    # check_same_thread=False: FastAPIs TestClient führt Endpunkte in einem
    # Worker-Thread aus, der nicht der Thread ist, in dem diese Fixture die
    # Connection erstellt - ohne das Flag verweigert sqlite3 den Zugriff
    # ("SQLite objects created in a thread can only be used in that same
    # thread"). Unkritisch hier, da die Tests sequentiell laufen, kein
    # echter paralleler Zugriff stattfindet.
    conn = sqlite3.connect(":memory:", check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute(
        """CREATE TABLE orders (
            order_id TEXT, category_english TEXT, price REAL, freight_value REAL,
            item_count INTEGER, delivery_delta_days REAL, seller_avg_review_prior REAL,
            risk_score REAL, risk_level TEXT, shap_drivers_json TEXT, explanation TEXT
        )"""
    )
    conn.execute(
        "INSERT INTO orders VALUES (?,?,?,?,?,?,?,?,?,?,?)",
        (
            "order-1", "furniture_decor", 120.5, 15.0, 1, 5.0, 3.2, 0.75, "hoch",
            json.dumps([{"feature": "delivery_delta_days", "shap_value": 0.3, "feature_value": 5.0}]),
            "Hohes Risiko wegen später Lieferung.",
        ),
    )
    conn.execute("CREATE TABLE feature_importance (feature TEXT, mean_abs_shap REAL)")
    conn.execute("INSERT INTO feature_importance VALUES (?,?)", ("delivery_delta_days", 0.28))
    conn.commit()
    yield conn
    conn.close()


@pytest.fixture
def client(test_conn):
    def override_get_db():
        yield test_conn

    app.dependency_overrides[get_db] = override_get_db
    yield TestClient(app)
    app.dependency_overrides.clear()
