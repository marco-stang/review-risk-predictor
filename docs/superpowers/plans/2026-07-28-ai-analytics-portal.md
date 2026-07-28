# ai-analytics-portal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ein Full-Stack-Portal (React + FastAPI), das für Olist-Bestellungen
das Risiko einer schlechten Review vorhersagt und die Vorhersage über
SHAP + LLM-generierten Klartext erklärt.

**Architecture:** Offline-Pipeline (pandas → GradientBoostingClassifier →
SHAP → LLM-Erklärung) schreibt einen SQLite-Snapshot + Modell-Artefakt ins
Repo. FastAPI liest ausschließlich aus diesem Snapshot (kein Live-Postgres,
kein Live-LLM-Call zur Laufzeit). React-Frontend konsumiert die FastAPI
über eine typisierte Client-Schicht.

**Tech Stack:** Python 3.10+, FastAPI, scikit-learn, SHAP, LangChain
(`init_chat_model`, wie `sql-agent`), SQLite, pytest · React 18, Vite,
TypeScript, react-router-dom, Recharts, Vitest + React Testing Library.

## Global Constraints

- **Lehrstil (wie `sql-agent`/`goz-finetune-vs-rag`):** Deutsch, ausführliche
  Erklärungen/Kommentare zu React- und FastAPI-Konzepten, die für Marco neu
  sind. Marco lernt aktiv mit — bei Gelegenheit einzelne Teile (z.B. einen
  Filter, eine Komponentenanpassung) selbst schreiben lassen statt alles
  vorzugeben, analog zu den SQL-Übungsaufgaben in `sql-agent`.
- **Execution-Empfehlung:** Wegen des Lehrstils passt reines
  Subagent-Driven-Development (isolierte Fresh-Context-Subagents ohne
  Erklärungen an Marco) nicht gut zu diesem Projekt — bei der
  Execution-Handoff-Frage am Ende dieses Plans wird **Inline Execution**
  empfohlen, nicht Subagent-Driven.
- Branch `master` (Konvention). GitHub-Repo wird **nicht** vorab, sondern
  erst in Task 15 gemäß `PORTFOLIO_AGENT_GUIDE.md` Schritt 4 angelegt.
- Kein Live-Postgres, keine Live-Verbindung zu `sql-agent`s Datenbank.
- Kein Live-LLM-Call zur Laufzeit der Web-App — nur beim einmaligen
  Pipeline-Lauf (Task 14). Die App selbst braucht im Deployment keinen
  LLM-API-Key.
- **Neue Implementierungsentscheidung ggü. der Spec (bitte kurz von Marco
  bestätigen):** Die Snapshot-Demo enthält eine **Stichprobe von ~500
  Bestellungen** (über Risiko-Terzile stratifiziert), nicht alle ~100.000
  Olist-Bestellungen — ein LLM-Call pro Bestellung für die komplette Tabelle
  wäre weder zeitlich noch finanziell sinnvoll. Die aggregierte
  Feature-Wichtigkeits-Übersicht (`/insights/feature-importance`) basiert
  trotzdem auf **allen** Bestellungen (SHAP-Berechnung ist billig, nur die
  LLM-Erklärung pro Bestellung ist der teure Teil).
- Zeitlicher (nicht zufälliger) Train/Test-Split; `seller_avg_review_prior`
  nutzt nur Bestellungen desselben Sellers **vor** der aktuellen Bestellung
  (kein Data Leakage).
- Nur öffentliche Kaggle-Olist-Daten (dieselben CSVs wie `sql-agent`), keine
  echten Kundendaten.

---

## Task 1: Projekt-Grundgerüst

**Files:**
- Create: `pyproject.toml`
- Create: `.gitignore`
- Create: `.env.example`
- Create: `pipeline/__init__.py` (leer)
- Create: `src/__init__.py`, `src/api/__init__.py`, `src/api/routes/__init__.py` (leer)
- Create: `tests/__init__.py` (leer)
- Create: `tests/test_setup.py`
- Create: `README.md` (Minimal-Platzhalter, wird in Task 15 vollständig)

**Interfaces:**
- Produces: importierbare Pakete `pipeline` und `src.api`, installierbares
  Projekt via `pip install -e ".[dev]"`

- [ ] **Step 1: `pyproject.toml` anlegen**

```toml
[project]
name = "ai-analytics-portal"
version = "0.1.0"
description = "Explainable-ML-Portal: Review-Risiko-Vorhersage für Olist-Bestellungen (React + FastAPI)"
requires-python = ">=3.10"
dependencies = [
    "fastapi>=0.115",
    "uvicorn[standard]>=0.30",
    "pandas>=2.0",
    "scikit-learn>=1.5",
    "shap>=0.46",
    "joblib>=1.4",
    "langchain>=0.3",
    "langchain-anthropic>=0.3",
    "langchain-openai>=0.2",
    "python-dotenv>=1.0",
]

[project.optional-dependencies]
dev = [
    "pytest>=8.0",
    "httpx>=0.27",
]

[build-system]
requires = ["setuptools>=68"]
build-backend = "setuptools.build_meta"

[tool.setuptools.packages.find]
include = ["src*", "pipeline*"]
```

- [ ] **Step 2: `.gitignore` anlegen**

```
.venv/
__pycache__/
*.pyc
.pytest_cache/
*.egg-info/
.env
data/raw/
node_modules/
frontend/dist/
frontend/node_modules/
```

Hinweis: `data/raw/` (die ~9 großen Olist-CSVs) wird bewusst *nicht*
committed — genau wie bei `sql-agent`. Der spätere `data/olist_snapshot.sqlite`
(kuratierte ~500-Zeilen-Stichprobe) liegt unter einem anderen Pfad und ist
**nicht** von dieser Regel betroffen, wird also normal getrackt.

- [ ] **Step 3: `.env.example` anlegen**

```
# Nur für den einmaligen Pipeline-Lauf (Task 14) nötig — die laufende
# Web-App selbst braucht keinen LLM-Key, da Erklärungen vorab im
# SQLite-Snapshot gecacht werden.

LLM_PROVIDER=anthropic
# LLM_PROVIDER=openai

LLM_MODEL=claude-sonnet-4-5-20250929
# LLM_MODEL=gpt-4o-mini

ANTHROPIC_API_KEY=
OPENAI_API_KEY=
```

- [ ] **Step 4: Paket-Skelette anlegen**

```bash
mkdir -p pipeline src/api/routes tests
touch pipeline/__init__.py src/__init__.py src/api/__init__.py src/api/routes/__init__.py tests/__init__.py
```

- [ ] **Step 5: Minimal-README anlegen**

```markdown
# ai-analytics-portal

Explainable-ML-Portal für Review-Risiko-Vorhersage auf Olist-Bestellungen.
Wird in Task 15 (Portfolio-Präsentation) vollständig ausgebaut.
```

- [ ] **Step 6: Setup-Test schreiben**

```python
# tests/test_setup.py
def test_packages_are_importable():
    import pipeline  # noqa: F401
    import src.api  # noqa: F401
```

- [ ] **Step 7: Installieren und Test laufen lassen**

```bash
pip install -e ".[dev]"
pytest tests/test_setup.py -v
```

Erwartet: `1 passed`.

- [ ] **Step 8: Commit**

```bash
git add pyproject.toml .gitignore .env.example README.md pipeline src tests
git commit -m "Projekt-Grundgerüst: pyproject, Paketstruktur, Setup-Test"
```

---

## Task 2: Feature-Engineering-Pipeline

**Files:**
- Create: `pipeline/build_features.py`
- Test: `tests/test_build_features.py`

**Interfaces:**
- Consumes: nichts (reines pandas)
- Produces: `load_raw_tables(raw_dir: Path) -> dict[str, pd.DataFrame]`,
  `build_feature_table(tables: dict[str, pd.DataFrame]) -> pd.DataFrame` mit
  Spalten `order_id, purchase_timestamp, category_english, price,
  freight_value, item_count, delivery_delta_days, seller_avg_review_prior,
  review_score, bad_review`

Lehr-Hinweis für diese Session: kurz erklären, warum `seller_avg_review_prior`
zeitlich sortiert + geshiftet berechnet wird (sonst Data Leakage — das Modell
"kennt" sonst indirekt die eigene Ziel-Review über den Seller-Durchschnitt).

- [ ] **Step 1: Test für `build_feature_table` schreiben (kleine Fixture, kein echtes CSV)**

```python
# tests/test_build_features.py
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
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

```bash
pytest tests/test_build_features.py -v
```

Erwartet: FAIL, `ModuleNotFoundError` oder `ImportError` (Funktion existiert
noch nicht).

- [ ] **Step 3: `pipeline/build_features.py` implementieren**

```python
# pipeline/build_features.py
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
```

- [ ] **Step 4: Test laufen lassen, Erfolg bestätigen**

```bash
pytest tests/test_build_features.py -v
```

Erwartet: `2 passed`.

- [ ] **Step 5: Commit**

```bash
git add pipeline/build_features.py tests/test_build_features.py
git commit -m "Feature-Engineering-Pipeline für Olist-Bestellungen"
```

---

## Task 3: Zeitlicher Split + Modelltraining

**Files:**
- Create: `pipeline/train_model.py`
- Test: `tests/test_train_model.py`

**Interfaces:**
- Consumes: `build_feature_table()`-Output-Schema (Task 2)
- Produces: `encode_features(df) -> tuple[pd.DataFrame, list[str]]`,
  `split_temporal(df, test_frac=0.2) -> tuple[pd.DataFrame, pd.DataFrame]`,
  `train_model(train_df, feature_columns) -> GradientBoostingClassifier`,
  `evaluate_model(model, test_df, feature_columns) -> dict`

- [ ] **Step 1: Test schreiben**

```python
# tests/test_train_model.py
import pandas as pd

from pipeline.train_model import encode_features, split_temporal, train_model, evaluate_model


def _fake_feature_df(n: int = 40) -> pd.DataFrame:
    import numpy as np
    rng = np.random.default_rng(42)
    categories = ["furniture_decor", "toys", "electronics"] * (n // 3 + 1)
    return pd.DataFrame({
        "order_id": [f"o{i}" for i in range(n)],
        "purchase_timestamp": pd.date_range("2024-01-01", periods=n, freq="D"),
        "category_english": categories[:n],
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
    # numerische Basis-Features müssen enthalten sein
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
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

```bash
pytest tests/test_train_model.py -v
```

Erwartet: FAIL (Modul existiert noch nicht).

- [ ] **Step 3: `pipeline/train_model.py` implementieren**

```python
# pipeline/train_model.py
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
```

- [ ] **Step 4: Test laufen lassen, Erfolg bestätigen**

```bash
pytest tests/test_train_model.py -v
```

Erwartet: `3 passed`.

- [ ] **Step 5: Commit**

```bash
git add pipeline/train_model.py tests/test_train_model.py
git commit -m "Zeitlicher Train/Test-Split + Gradient-Boosting-Modelltraining"
```

---

## Task 4: SHAP-Treiber (deterministisch, ohne LLM)

**Files:**
- Create: `pipeline/explain.py`
- Test: `tests/test_explain.py`

**Interfaces:**
- Consumes: `model`/`feature_columns` aus Task 3
- Produces: `compute_shap_values(model, X: pd.DataFrame) -> np.ndarray`,
  `top_features(shap_row, feature_row, feature_columns, n=3) -> list[dict]`
  (jedes dict: `{"feature": str, "shap_value": float, "feature_value": float}`)

- [ ] **Step 1: Test schreiben**

```python
# tests/test_explain.py
import numpy as np
import pandas as pd

from pipeline.explain import top_features


def test_top_features_sorts_by_absolute_shap_value():
    shap_row = np.array([0.1, -0.5, 0.05, 0.3])
    feature_row = pd.Series({"a": 10, "b": 20, "c": 30, "d": 40})
    feature_columns = ["a", "b", "c", "d"]

    result = top_features(shap_row, feature_row, feature_columns, n=2)

    assert [r["feature"] for r in result] == ["b", "d"]
    assert result[0]["shap_value"] == -0.5
    assert result[0]["feature_value"] == 20
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

```bash
pytest tests/test_explain.py -v
```

Erwartet: FAIL (Modul existiert noch nicht).

- [ ] **Step 3: `pipeline/explain.py` implementieren**

```python
# pipeline/explain.py
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
```

- [ ] **Step 4: Test laufen lassen, Erfolg bestätigen**

```bash
pytest tests/test_explain.py -v
```

Erwartet: `1 passed`.

- [ ] **Step 5: Commit**

```bash
git add pipeline/explain.py tests/test_explain.py
git commit -m "SHAP-basierte Top-3-Treiber-Extraktion"
```

---

## Task 5: LLM-Erklärungstext

**Files:**
- Create: `pipeline/llm.py`
- Create: `pipeline/narrate.py`
- Test: `tests/test_narrate.py`

**Interfaces:**
- Consumes: `top_features()`-Output (Task 4), `risk_score: float`
- Produces: `get_llm() -> BaseChatModel`,
  `generate_explanation(top3: list[dict], risk_score: float, llm) -> str`

Lehr-Hinweis: `pipeline/llm.py` ist eine direkte Kopie/Anpassung von
`sql-agent/src/agent/llm.py` — kurz erklären, warum `init_chat_model()`
providerunabhängig funktioniert (dasselbe Prinzip, das Marco aus sql-agent
schon kennt).

- [ ] **Step 1: `pipeline/llm.py` anlegen (keine eigene Test-Notwendigkeit — reine Konfiguration, identisch zum bewährten sql-agent-Muster)**

```python
# pipeline/llm.py
import os

from dotenv import load_dotenv
from langchain.chat_models import init_chat_model
from langchain_core.language_models.chat_models import BaseChatModel

load_dotenv()


def get_llm() -> BaseChatModel:
    """Baut das Chat-Model aus LLM_PROVIDER/LLM_MODEL in der .env - identisches
    Muster wie sql-agent/src/agent/llm.py, hier für den Pipeline-Kontext."""
    provider = os.environ.get("LLM_PROVIDER")
    model = os.environ.get("LLM_MODEL")

    if not provider or not model:
        raise RuntimeError(
            "LLM_PROVIDER und LLM_MODEL müssen in der .env gesetzt sein "
            "(siehe .env.example). Aktuell: "
            f"LLM_PROVIDER={provider!r}, LLM_MODEL={model!r}"
        )

    return init_chat_model(model, model_provider=provider)
```

- [ ] **Step 2: Test für `narrate.py` schreiben (mit Fake-LLM, kein echter API-Call)**

```python
# tests/test_narrate.py
from pipeline.narrate import format_drivers, generate_explanation


class _FakeMessage:
    def __init__(self, content: str) -> None:
        self.content = content


class _FakeLLM:
    def __init__(self, response_text: str) -> None:
        self.response_text = response_text
        self.last_prompt: str | None = None

    def invoke(self, prompt: str) -> _FakeMessage:
        self.last_prompt = prompt
        return _FakeMessage(self.response_text)


def test_format_drivers_includes_feature_and_value():
    top3 = [{"feature": "delivery_delta_days", "shap_value": 0.3, "feature_value": 5.0}]
    text = format_drivers(top3)
    assert "delivery_delta_days" in text
    assert "5.0" in text


def test_generate_explanation_calls_llm_and_returns_stripped_content():
    llm = _FakeLLM("  Hohes Risiko wegen später Lieferung.  ")
    top3 = [{"feature": "delivery_delta_days", "shap_value": 0.3, "feature_value": 5.0}]

    result = generate_explanation(top3, risk_score=0.72, llm=llm)

    assert result == "Hohes Risiko wegen später Lieferung."
    assert "72%" in llm.last_prompt
    assert "delivery_delta_days" in llm.last_prompt
```

- [ ] **Step 3: Test laufen lassen, Fehlschlag bestätigen**

```bash
pytest tests/test_narrate.py -v
```

Erwartet: FAIL (Modul existiert noch nicht).

- [ ] **Step 4: `pipeline/narrate.py` implementieren**

```python
# pipeline/narrate.py
PROMPT_TEMPLATE = (
    "Ein Machine-Learning-Modell schätzt das Risiko, dass eine "
    "Online-Bestellung eine schlechte Kundenbewertung (1-2 Sterne) bekommt, "
    "auf {risk_score:.0%}. Die wichtigsten Einflussfaktoren laut "
    "SHAP-Analyse:\n{drivers_text}\n\n"
    "Formuliere in 1-2 kurzen Sätzen auf Deutsch, verständlich für "
    "Nicht-Techniker, warum diese Bestellung dieses Risiko hat. Nenne "
    "konkrete Zahlen aus den Faktoren."
)


def format_drivers(top3: list[dict]) -> str:
    return "\n".join(
        f"- {d['feature']} = {d['feature_value']:.1f} (SHAP-Beitrag: {d['shap_value']:+.3f})"
        for d in top3
    )


def generate_explanation(top3: list[dict], risk_score: float, llm) -> str:
    prompt = PROMPT_TEMPLATE.format(risk_score=risk_score, drivers_text=format_drivers(top3))
    response = llm.invoke(prompt)
    return response.content.strip()
```

- [ ] **Step 5: Test laufen lassen, Erfolg bestätigen**

```bash
pytest tests/test_narrate.py -v
```

Erwartet: `2 passed`.

- [ ] **Step 6: Commit**

```bash
git add pipeline/llm.py pipeline/narrate.py tests/test_narrate.py
git commit -m "LLM-Erklärungstext aus SHAP-Treibern (mit Fake-LLM getestet)"
```

---

## Task 6: SQLite-Snapshot + Pipeline-Orchestrierung

**Files:**
- Create: `pipeline/snapshot.py`
- Create: `pipeline/run_pipeline.py`
- Test: `tests/test_snapshot.py`

**Interfaces:**
- Consumes: alle Funktionen aus Task 2-5
- Produces: `risk_level(score: float) -> str`,
  `write_snapshot(enriched_df, feature_importance_df, db_path: Path) -> None`,
  ausführbares Skript `pipeline/run_pipeline.py` (Entry-Point `run()`)

- [ ] **Step 1: Test für `snapshot.py` schreiben**

```python
# tests/test_snapshot.py
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
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

```bash
pytest tests/test_snapshot.py -v
```

Erwartet: FAIL (Modul existiert noch nicht).

- [ ] **Step 3: `pipeline/snapshot.py` implementieren**

```python
# pipeline/snapshot.py
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
```

- [ ] **Step 4: Test laufen lassen, Erfolg bestätigen**

```bash
pytest tests/test_snapshot.py -v
```

Erwartet: `2 passed`.

- [ ] **Step 5: `pipeline/run_pipeline.py` implementieren (Orchestrierung, wird in Task 14 real ausgeführt, nicht per pytest)**

```python
# pipeline/run_pipeline.py
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
```

- [ ] **Step 6: Import-Smoke-Test (kein echter Lauf - braucht echte Daten/API-Key, das folgt in Task 14)**

```bash
python -c "import pipeline.run_pipeline"
```

Erwartet: keine Fehlermeldung (nur ein Syntax-/Import-Check).

- [ ] **Step 7: Commit**

```bash
git add pipeline/snapshot.py pipeline/run_pipeline.py tests/test_snapshot.py
git commit -m "SQLite-Snapshot-Schreiben + End-to-End-Pipeline-Orchestrierung"
```

---

## Task 7: FastAPI-Grundgerüst + `/orders`-Liste

**Files:**
- Create: `src/api/main.py`
- Create: `src/api/db.py`
- Create: `src/api/schemas.py`
- Create: `src/api/routes/orders.py`
- Create: `tests/conftest.py`
- Test: `tests/test_orders.py`

**Interfaces:**
- Consumes: SQLite-Schema aus Task 6 (Tabelle `orders` mit den Spalten aus
  `write_snapshot`)
- Produces: importierbare FastAPI-App `src.api.main:app`, `GET /orders`

- [ ] **Step 1: `src/api/schemas.py` implementieren**

```python
# src/api/schemas.py
from pydantic import BaseModel


class OrderSummary(BaseModel):
    order_id: str
    category_english: str
    risk_score: float
    risk_level: str


class DriverItem(BaseModel):
    feature: str
    shap_value: float
    feature_value: float


class OrderDetail(OrderSummary):
    drivers: list[DriverItem]
    explanation: str


class FeatureImportanceItem(BaseModel):
    feature: str
    mean_abs_shap: float
```

- [ ] **Step 2: `src/api/db.py` implementieren**

```python
# src/api/db.py
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
```

- [ ] **Step 3: Test-Fixtures in `tests/conftest.py` anlegen**

```python
# tests/conftest.py
import json
import sqlite3

import pytest
from fastapi.testclient import TestClient

from src.api.db import get_db
from src.api.main import app


@pytest.fixture
def test_conn():
    conn = sqlite3.connect(":memory:")
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
```

- [ ] **Step 4: Test für `/orders` schreiben**

```python
# tests/test_orders.py
def test_list_orders_returns_seeded_row(client):
    response = client.get("/orders")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["order_id"] == "order-1"
    assert data[0]["risk_level"] == "hoch"


def test_list_orders_filters_by_risk_level(client):
    response = client.get("/orders", params={"risk_level": "niedrig"})
    assert response.status_code == 200
    assert response.json() == []
```

- [ ] **Step 5: Test laufen lassen, Fehlschlag bestätigen**

```bash
pytest tests/test_orders.py -v
```

Erwartet: FAIL (Module existieren noch nicht).

- [ ] **Step 6: `src/api/routes/orders.py` (Listen-Endpunkt) implementieren**

```python
# src/api/routes/orders.py
from fastapi import APIRouter, Depends, Query

from src.api.db import get_db
from src.api.schemas import OrderSummary

router = APIRouter()


@router.get("/orders", response_model=list[OrderSummary])
def list_orders(
    category: str | None = Query(default=None),
    risk_level: str | None = Query(default=None),
    conn=Depends(get_db),
):
    query = "SELECT order_id, category_english, risk_score, risk_level FROM orders WHERE 1=1"
    params: list = []
    if category:
        query += " AND category_english = ?"
        params.append(category)
    if risk_level:
        query += " AND risk_level = ?"
        params.append(risk_level)
    rows = conn.execute(query, params).fetchall()
    return [OrderSummary(**dict(row)) for row in rows]
```

- [ ] **Step 7: `src/api/main.py` implementieren**

```python
# src/api/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.api.routes import orders

app = FastAPI(title="ai-analytics-portal API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(orders.router)
```

- [ ] **Step 8: Test laufen lassen, Erfolg bestätigen**

```bash
pytest tests/test_orders.py -v
```

Erwartet: `2 passed`.

- [ ] **Step 9: Commit**

```bash
git add src/api/main.py src/api/db.py src/api/schemas.py src/api/routes/orders.py tests/conftest.py tests/test_orders.py
git commit -m "FastAPI-Grundgerüst + GET /orders mit Filtern"
```

---

## Task 8: `/orders/{order_id}`-Detail-Endpunkt

**Files:**
- Modify: `src/api/routes/orders.py`
- Modify: `tests/test_orders.py`

**Interfaces:**
- Consumes: `get_db`, `OrderDetail`/`DriverItem` aus Task 7
- Produces: `GET /orders/{order_id}` (404 bei unbekannter ID)

- [ ] **Step 1: Tests ergänzen**

```python
# tests/test_orders.py (ergänzen)
def test_get_order_detail_returns_drivers_and_explanation(client):
    response = client.get("/orders/order-1")
    assert response.status_code == 200
    data = response.json()
    assert data["explanation"] == "Hohes Risiko wegen später Lieferung."
    assert data["drivers"][0]["feature"] == "delivery_delta_days"


def test_get_order_detail_404_for_unknown_id(client):
    response = client.get("/orders/does-not-exist")
    assert response.status_code == 404
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

```bash
pytest tests/test_orders.py -v -k detail
```

Erwartet: FAIL (Endpunkt existiert noch nicht → 404 durch fehlende Route,
nicht durch die gewollte Fehlerbehandlung).

- [ ] **Step 3: Detail-Endpunkt implementieren**

```python
# src/api/routes/orders.py (ergänzen)
import json

from fastapi import HTTPException

from src.api.schemas import DriverItem, OrderDetail


@router.get("/orders/{order_id}", response_model=OrderDetail)
def get_order(order_id: str, conn=Depends(get_db)):
    row = conn.execute("SELECT * FROM orders WHERE order_id = ?", (order_id,)).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Bestellung nicht gefunden")

    data = dict(row)
    drivers = [DriverItem(**d) for d in json.loads(data["shap_drivers_json"])]
    return OrderDetail(
        order_id=data["order_id"],
        category_english=data["category_english"],
        risk_score=data["risk_score"],
        risk_level=data["risk_level"],
        drivers=drivers,
        explanation=data["explanation"],
    )
```

- [ ] **Step 4: Test laufen lassen, Erfolg bestätigen**

```bash
pytest tests/test_orders.py -v
```

Erwartet: `4 passed`.

- [ ] **Step 5: Commit**

```bash
git add src/api/routes/orders.py tests/test_orders.py
git commit -m "GET /orders/{id}: Detail-Endpunkt mit SHAP-Treibern + Erklärung"
```

---

## Task 9: `/insights/feature-importance`-Endpunkt

**Files:**
- Create: `src/api/routes/insights.py`
- Modify: `src/api/main.py`
- Test: `tests/test_insights.py`

**Interfaces:**
- Consumes: Tabelle `feature_importance` aus Task 6, `get_db` aus Task 7
- Produces: `GET /insights/feature-importance`

- [ ] **Step 1: Test schreiben**

```python
# tests/test_insights.py
def test_feature_importance_sorted_desc(client):
    response = client.get("/insights/feature-importance")
    assert response.status_code == 200
    data = response.json()
    assert data[0]["feature"] == "delivery_delta_days"
    assert data[0]["mean_abs_shap"] == 0.28
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

```bash
pytest tests/test_insights.py -v
```

Erwartet: FAIL (404, Route existiert noch nicht).

- [ ] **Step 3: `src/api/routes/insights.py` implementieren**

```python
# src/api/routes/insights.py
from fastapi import APIRouter, Depends

from src.api.db import get_db
from src.api.schemas import FeatureImportanceItem

router = APIRouter()


@router.get("/insights/feature-importance", response_model=list[FeatureImportanceItem])
def feature_importance(conn=Depends(get_db)):
    rows = conn.execute(
        "SELECT feature, mean_abs_shap FROM feature_importance ORDER BY mean_abs_shap DESC"
    ).fetchall()
    return [FeatureImportanceItem(**dict(row)) for row in rows]
```

- [ ] **Step 4: In `main.py` registrieren**

```python
# src/api/main.py (ergänzen)
from src.api.routes import insights, orders
# ...
app.include_router(insights.router)
```

- [ ] **Step 5: Test laufen lassen, Erfolg bestätigen**

```bash
pytest tests/test_insights.py -v
```

Erwartet: `1 passed`.

- [ ] **Step 6: Commit**

```bash
git add src/api/routes/insights.py src/api/main.py tests/test_insights.py
git commit -m "GET /insights/feature-importance: aggregierte SHAP-Übersicht"
```

---

## Task 10: React/Vite-Grundgerüst + typisierter API-Client

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/vite.config.ts`
- Create: `frontend/tsconfig.json`
- Create: `frontend/index.html`
- Create: `frontend/src/main.tsx`
- Create: `frontend/src/App.tsx` (Platzhalter, wird in Task 13 ausgebaut)
- Create: `frontend/src/test-setup.ts`
- Create: `frontend/src/api/client.ts`
- Test: `frontend/src/api/client.test.ts`

**Interfaces:**
- Produces: `OrderSummary`, `DriverItem`, `OrderDetail`,
  `FeatureImportanceItem` (TypeScript-Interfaces, Feldnamen 1:1 wie in
  `src/api/schemas.py`), `fetchOrders()`, `fetchOrderDetail()`,
  `fetchFeatureImportance()`

Lehr-Hinweis: hier lohnt es sich, kurz zu erklären, warum `fetch` +
Response-Status-Check als eigene `fetchJson<T>`-Hilfsfunktion
zusammengefasst wird (DRY-Prinzip, das Marco schon aus Python kennt,
hier auf TypeScript übertragen).

- [ ] **Step 1: `frontend/package.json` anlegen**

```json
{
  "name": "ai-analytics-portal-frontend",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "test": "vitest run"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.26.0",
    "recharts": "^2.12.7"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.4.8",
    "@testing-library/react": "^16.0.0",
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.1",
    "jsdom": "^24.1.1",
    "typescript": "^5.5.4",
    "vite": "^5.4.0",
    "vitest": "^2.0.5"
  }
}
```

- [ ] **Step 2: `frontend/vite.config.ts` anlegen**

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: "./src/test-setup.ts",
  },
});
```

- [ ] **Step 3: `frontend/tsconfig.json` anlegen**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true
  },
  "include": ["src"]
}
```

- [ ] **Step 4: `frontend/index.html` + `frontend/src/main.tsx` + `frontend/src/test-setup.ts` anlegen**

```html
<!-- frontend/index.html -->
<!doctype html>
<html lang="de">
  <head>
    <meta charset="UTF-8" />
    <title>ai-analytics-portal</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

```tsx
// frontend/src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
```

```tsx
// frontend/src/App.tsx (Platzhalter - Routing folgt in Task 13)
export default function App() {
  return <h1>ai-analytics-portal</h1>;
}
```

```typescript
// frontend/src/test-setup.ts
import "@testing-library/jest-dom";
```

- [ ] **Step 5: Test für `client.ts` schreiben**

```typescript
// frontend/src/api/client.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchOrders } from "./client";

describe("fetchOrders", () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  it("baut Query-Parameter korrekt und gibt die JSON-Antwort zurück", async () => {
    const mockOrders = [
      { order_id: "o1", category_english: "toys", risk_score: 0.8, risk_level: "hoch" },
    ];
    (global.fetch as any).mockResolvedValue({ ok: true, json: async () => mockOrders });

    const result = await fetchOrders({ riskLevel: "hoch" });

    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining("/orders?risk_level=hoch"));
    expect(result).toEqual(mockOrders);
  });

  it("wirft einen Fehler bei einer nicht-ok Antwort", async () => {
    (global.fetch as any).mockResolvedValue({ ok: false, status: 500 });
    await expect(fetchOrders()).rejects.toThrow("API-Fehler 500");
  });
});
```

- [ ] **Step 6: Dependencies installieren, Test laufen lassen, Fehlschlag bestätigen**

```bash
cd frontend && npm install
npm run test
```

Erwartet: FAIL (`client.ts` existiert noch nicht).

- [ ] **Step 7: `frontend/src/api/client.ts` implementieren**

```typescript
// frontend/src/api/client.ts
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

export interface OrderSummary {
  order_id: string;
  category_english: string;
  risk_score: number;
  risk_level: "niedrig" | "mittel" | "hoch";
}

export interface DriverItem {
  feature: string;
  shap_value: number;
  feature_value: number;
}

export interface OrderDetail extends OrderSummary {
  drivers: DriverItem[];
  explanation: string;
}

export interface FeatureImportanceItem {
  feature: string;
  mean_abs_shap: number;
}

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`);
  if (!response.ok) {
    throw new Error(`API-Fehler ${response.status} bei ${path}`);
  }
  return response.json() as Promise<T>;
}

export function fetchOrders(filters?: { category?: string; riskLevel?: string }): Promise<OrderSummary[]> {
  const params = new URLSearchParams();
  if (filters?.category) params.set("category", filters.category);
  if (filters?.riskLevel) params.set("risk_level", filters.riskLevel);
  const query = params.toString() ? `?${params.toString()}` : "";
  return fetchJson<OrderSummary[]>(`/orders${query}`);
}

export function fetchOrderDetail(orderId: string): Promise<OrderDetail> {
  return fetchJson<OrderDetail>(`/orders/${orderId}`);
}

export function fetchFeatureImportance(): Promise<FeatureImportanceItem[]> {
  return fetchJson<FeatureImportanceItem[]>("/insights/feature-importance");
}
```

- [ ] **Step 8: Test laufen lassen, Erfolg bestätigen**

```bash
npm run test
```

Erwartet: `2 passed`.

- [ ] **Step 9: Commit**

```bash
cd .. && git add frontend/package.json frontend/vite.config.ts frontend/tsconfig.json frontend/index.html frontend/src/main.tsx frontend/src/App.tsx frontend/src/test-setup.ts frontend/src/api
git commit -m "React/Vite-Grundgerüst + typisierter API-Client"
```

---

## Task 11: `RiskBadge` + `OrderList`-Seite

**Files:**
- Create: `frontend/src/components/RiskBadge.tsx`
- Create: `frontend/src/components/RiskBadge.test.tsx`
- Create: `frontend/src/pages/OrderList.tsx`
- Create: `frontend/src/pages/OrderList.test.tsx`

**Interfaces:**
- Consumes: `fetchOrders`, `OrderSummary` aus Task 10
- Produces: `<RiskBadge riskLevel="hoch" />`, `<OrderList />`

Lehr-Hinweis: gute Gelegenheit, Marco selbst die Farbwerte/Labels von
`RiskBadge` anpassen zu lassen, nachdem das Grundgerüst steht — analog zu
den SQL-Übungsaufgaben in `sql-agent`.

- [ ] **Step 1: Test für `RiskBadge` schreiben**

```tsx
// frontend/src/components/RiskBadge.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import RiskBadge from "./RiskBadge";

describe("RiskBadge", () => {
  it("zeigt den Risiko-Level als Text", () => {
    render(<RiskBadge riskLevel="hoch" />);
    expect(screen.getByText("hoch")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

```bash
cd frontend && npm run test
```

Erwartet: FAIL (Komponente existiert noch nicht).

- [ ] **Step 3: `RiskBadge.tsx` implementieren**

```tsx
// frontend/src/components/RiskBadge.tsx
interface RiskBadgeProps {
  riskLevel: "niedrig" | "mittel" | "hoch";
}

const COLORS: Record<RiskBadgeProps["riskLevel"], string> = {
  niedrig: "#2e7d32",
  mittel: "#f9a825",
  hoch: "#c62828",
};

export default function RiskBadge({ riskLevel }: RiskBadgeProps) {
  return (
    <span
      style={{
        backgroundColor: COLORS[riskLevel],
        color: "white",
        padding: "2px 8px",
        borderRadius: "4px",
        fontSize: "0.85rem",
      }}
    >
      {riskLevel}
    </span>
  );
}
```

- [ ] **Step 4: Test für `OrderList` schreiben**

```tsx
// frontend/src/pages/OrderList.test.tsx
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi } from "vitest";
import OrderList from "./OrderList";
import * as apiClient from "../api/client";

describe("OrderList", () => {
  it("zeigt die geladenen Bestellungen an", async () => {
    vi.spyOn(apiClient, "fetchOrders").mockResolvedValue([
      { order_id: "o1", category_english: "toys", risk_score: 0.8, risk_level: "hoch" },
    ]);

    render(
      <MemoryRouter>
        <OrderList />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText("o1")).toBeInTheDocument());
    expect(screen.getByText("hoch")).toBeInTheDocument();
  });
});
```

- [ ] **Step 5: Test laufen lassen, Fehlschlag bestätigen**

```bash
npm run test
```

Erwartet: FAIL (`OrderList` existiert noch nicht).

- [ ] **Step 6: `OrderList.tsx` implementieren**

```tsx
// frontend/src/pages/OrderList.tsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchOrders, OrderSummary } from "../api/client";
import RiskBadge from "../components/RiskBadge";

export default function OrderList() {
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [riskLevel, setRiskLevel] = useState<string>("");

  useEffect(() => {
    fetchOrders(riskLevel ? { riskLevel } : undefined).then(setOrders);
  }, [riskLevel]);

  return (
    <div>
      <h1>Bestellungen</h1>
      <select value={riskLevel} onChange={(e) => setRiskLevel(e.target.value)}>
        <option value="">Alle Risiko-Level</option>
        <option value="niedrig">niedrig</option>
        <option value="mittel">mittel</option>
        <option value="hoch">hoch</option>
      </select>
      <ul>
        {orders.map((order) => (
          <li key={order.order_id}>
            <Link to={`/orders/${order.order_id}`}>{order.order_id}</Link>{" "}
            ({order.category_english}) <RiskBadge riskLevel={order.risk_level} />
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 7: Test laufen lassen, Erfolg bestätigen**

```bash
npm run test
```

Erwartet: `3 passed` (inkl. RiskBadge-Test aus Step 1).

- [ ] **Step 8: Commit**

```bash
cd .. && git add frontend/src/components/RiskBadge.tsx frontend/src/components/RiskBadge.test.tsx frontend/src/pages/OrderList.tsx frontend/src/pages/OrderList.test.tsx
git commit -m "RiskBadge-Komponente + Bestell-Liste mit Risiko-Filter"
```

---

## Task 12: `DriverChart` + `OrderDetail`-Seite

**Files:**
- Create: `frontend/src/components/DriverChart.tsx`
- Create: `frontend/src/components/DriverChart.test.tsx`
- Create: `frontend/src/pages/OrderDetail.tsx`
- Create: `frontend/src/pages/OrderDetail.test.tsx`

**Interfaces:**
- Consumes: `fetchOrderDetail`, `OrderDetail`, `DriverItem` aus Task 10,
  `RiskBadge` aus Task 11
- Produces: `<DriverChart drivers={...} />`, `<OrderDetail />`

- [ ] **Step 1: Test für `DriverChart` schreiben**

```tsx
// frontend/src/components/DriverChart.test.tsx
import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import DriverChart from "./DriverChart";

describe("DriverChart", () => {
  it("rendert ohne Fehler mit Treiber-Daten", () => {
    const { container } = render(
      <DriverChart drivers={[{ feature: "delivery_delta_days", shap_value: 0.3, feature_value: 5 }]} />
    );
    expect(container.querySelector("svg")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

```bash
cd frontend && npm run test
```

Erwartet: FAIL (Komponente existiert noch nicht).

- [ ] **Step 3: `DriverChart.tsx` implementieren**

```tsx
// frontend/src/components/DriverChart.tsx
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { DriverItem } from "../api/client";

interface DriverChartProps {
  drivers: DriverItem[];
}

export default function DriverChart({ drivers }: DriverChartProps) {
  const data = drivers.map((d) => ({ name: d.feature, wert: d.shap_value }));
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} layout="vertical">
        <XAxis type="number" />
        <YAxis type="category" dataKey="name" width={180} />
        <Tooltip />
        <Bar dataKey="wert" fill="#1565c0" />
      </BarChart>
    </ResponsiveContainer>
  );
}
```

- [ ] **Step 4: Test für `OrderDetail` schreiben**

```tsx
// frontend/src/pages/OrderDetail.test.tsx
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, it, expect, vi } from "vitest";
import OrderDetail from "./OrderDetail";
import * as apiClient from "../api/client";

describe("OrderDetail", () => {
  it("lädt und zeigt Erklärung + Risiko-Badge", async () => {
    vi.spyOn(apiClient, "fetchOrderDetail").mockResolvedValue({
      order_id: "o1",
      category_english: "toys",
      risk_score: 0.8,
      risk_level: "hoch",
      drivers: [{ feature: "delivery_delta_days", shap_value: 0.3, feature_value: 5 }],
      explanation: "Hohes Risiko wegen später Lieferung.",
    });

    render(
      <MemoryRouter initialEntries={["/orders/o1"]}>
        <Routes>
          <Route path="/orders/:orderId" element={<OrderDetail />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText("Hohes Risiko wegen später Lieferung.")).toBeInTheDocument());
    expect(screen.getByText("hoch")).toBeInTheDocument();
  });
});
```

- [ ] **Step 5: Test laufen lassen, Fehlschlag bestätigen**

```bash
npm run test
```

Erwartet: FAIL (`OrderDetail` existiert noch nicht).

- [ ] **Step 6: `OrderDetail.tsx` implementieren**

```tsx
// frontend/src/pages/OrderDetail.tsx
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { fetchOrderDetail, OrderDetail as OrderDetailType } from "../api/client";
import DriverChart from "../components/DriverChart";
import RiskBadge from "../components/RiskBadge";

export default function OrderDetail() {
  const { orderId } = useParams<{ orderId: string }>();
  const [order, setOrder] = useState<OrderDetailType | null>(null);

  useEffect(() => {
    if (orderId) fetchOrderDetail(orderId).then(setOrder);
  }, [orderId]);

  if (!order) return <p>Lädt…</p>;

  return (
    <div>
      <h1>Bestellung {order.order_id}</h1>
      <RiskBadge riskLevel={order.risk_level} />
      <p>{order.explanation}</p>
      <DriverChart drivers={order.drivers} />
    </div>
  );
}
```

- [ ] **Step 7: Test laufen lassen, Erfolg bestätigen**

```bash
npm run test
```

Erwartet: `4 passed` (inkl. DriverChart-Test).

- [ ] **Step 8: Commit**

```bash
cd .. && git add frontend/src/components/DriverChart.tsx frontend/src/components/DriverChart.test.tsx frontend/src/pages/OrderDetail.tsx frontend/src/pages/OrderDetail.test.tsx
git commit -m "DriverChart-Komponente + Bestell-Detail-Seite"
```

---

## Task 13: `ImportanceChart` + `FeatureImportance`-Seite + Routing

**Files:**
- Create: `frontend/src/components/ImportanceChart.tsx`
- Create: `frontend/src/components/ImportanceChart.test.tsx`
- Create: `frontend/src/pages/FeatureImportance.tsx`
- Modify: `frontend/src/App.tsx`
- Create: `frontend/src/App.test.tsx`

**Interfaces:**
- Consumes: `fetchFeatureImportance`, `FeatureImportanceItem` aus Task 10,
  `OrderList`/`OrderDetail` aus Task 11/12
- Produces: vollständiges Routing (`/`, `/orders/:orderId`, `/insights`)

- [ ] **Step 1: Test für `ImportanceChart` schreiben**

```tsx
// frontend/src/components/ImportanceChart.test.tsx
import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import ImportanceChart from "./ImportanceChart";

describe("ImportanceChart", () => {
  it("rendert ohne Fehler mit Feature-Wichtigkeits-Daten", () => {
    const { container } = render(
      <ImportanceChart items={[{ feature: "delivery_delta_days", mean_abs_shap: 0.28 }]} />
    );
    expect(container.querySelector("svg")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

```bash
cd frontend && npm run test
```

Erwartet: FAIL (Komponente existiert noch nicht).

- [ ] **Step 3: `ImportanceChart.tsx` implementieren**

```tsx
// frontend/src/components/ImportanceChart.tsx
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { FeatureImportanceItem } from "../api/client";

interface ImportanceChartProps {
  items: FeatureImportanceItem[];
}

export default function ImportanceChart({ items }: ImportanceChartProps) {
  const data = items.map((i) => ({ name: i.feature, wert: i.mean_abs_shap }));
  return (
    <ResponsiveContainer width="100%" height={400}>
      <BarChart data={data} layout="vertical">
        <XAxis type="number" />
        <YAxis type="category" dataKey="name" width={200} />
        <Tooltip />
        <Bar dataKey="wert" fill="#6a1b9a" />
      </BarChart>
    </ResponsiveContainer>
  );
}
```

- [ ] **Step 4: `FeatureImportance.tsx` implementieren**

```tsx
// frontend/src/pages/FeatureImportance.tsx
import { useEffect, useState } from "react";
import { fetchFeatureImportance, FeatureImportanceItem } from "../api/client";
import ImportanceChart from "../components/ImportanceChart";

export default function FeatureImportance() {
  const [items, setItems] = useState<FeatureImportanceItem[]>([]);

  useEffect(() => {
    fetchFeatureImportance().then(setItems);
  }, []);

  return (
    <div>
      <h1>Globale Feature-Wichtigkeit</h1>
      <ImportanceChart items={items} />
    </div>
  );
}
```

- [ ] **Step 5: Test für `App`-Routing schreiben**

```tsx
// frontend/src/App.test.tsx
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi } from "vitest";
import App from "./App";
import * as apiClient from "./api/client";

describe("App-Routing", () => {
  it("zeigt die Insights-Seite bei /insights", async () => {
    vi.spyOn(apiClient, "fetchFeatureImportance").mockResolvedValue([]);

    render(
      <MemoryRouter initialEntries={["/insights"]}>
        <App />
      </MemoryRouter>
    );

    expect(await screen.findByText("Globale Feature-Wichtigkeit")).toBeInTheDocument();
  });
});
```

- [ ] **Step 6: Test laufen lassen, Fehlschlag bestätigen**

```bash
npm run test
```

Erwartet: FAIL (`App.tsx` ist noch der Platzhalter aus Task 10).

- [ ] **Step 7: `App.tsx` mit vollständigem Routing implementieren**

```tsx
// frontend/src/App.tsx
import { Link, Route, Routes } from "react-router-dom";
import FeatureImportance from "./pages/FeatureImportance";
import OrderDetail from "./pages/OrderDetail";
import OrderList from "./pages/OrderList";

export default function App() {
  return (
    <div>
      <nav>
        <Link to="/">Bestellungen</Link> | <Link to="/insights">Feature-Wichtigkeit</Link>
      </nav>
      <Routes>
        <Route path="/" element={<OrderList />} />
        <Route path="/orders/:orderId" element={<OrderDetail />} />
        <Route path="/insights" element={<FeatureImportance />} />
      </Routes>
    </div>
  );
}
```

- [ ] **Step 8: Test laufen lassen, Erfolg bestätigen**

```bash
npm run test
```

Erwartet: alle Frontend-Tests grün (`6 passed` insgesamt seit Task 10).

- [ ] **Step 9: Commit**

```bash
cd .. && git add frontend/src/components/ImportanceChart.tsx frontend/src/components/ImportanceChart.test.tsx frontend/src/pages/FeatureImportance.tsx frontend/src/App.tsx frontend/src/App.test.tsx
git commit -m "ImportanceChart + Feature-Wichtigkeits-Seite + vollständiges Routing"
```

---

## Task 14: Pipeline real ausführen + manueller End-to-End-Check

**Files:** keine neuen Dateien — dies ist ein Ausführungs-/Verifikations-Task,
kein TDD-Task (die Pipeline-Bausteine sind bereits per Fixture getestet).

**Interfaces:**
- Consumes: `pipeline/run_pipeline.py` (Task 6), FastAPI-App (Task 7-9),
  React-Frontend (Task 10-13)
- Produces: reale `data/olist_snapshot.sqlite` + `models/risk_classifier.joblib`,
  verifizierter End-to-End-Lauf

- [ ] **Step 1: Olist-Rohdaten lokal bereitstellen (nicht committen, siehe `.gitignore`)**

```bash
mkdir -p data/raw
cp "../sql-agent/data/raw/"*.csv data/raw/
```

- [ ] **Step 2: `.env` anlegen (Marcos eigener API-Key, wie bei `sql-agent`)**

```bash
cp .env.example .env
# LLM_PROVIDER/LLM_MODEL/den passenden API-Key eintragen
```

- [ ] **Step 3: Pipeline ausführen**

```bash
python -m pipeline.run_pipeline
```

Erwartet: Konsolen-Ausgabe mit Modell-Metriken (ROC-AUC/Precision/Recall)
und `Snapshot geschrieben: .../data/olist_snapshot.sqlite (X Bestellungen)`.
Die Metriken hier notieren — sie kommen in Task 15 ins README.

- [ ] **Step 4: Snapshot stichprobenartig prüfen**

```bash
python -c "
import sqlite3
conn = sqlite3.connect('data/olist_snapshot.sqlite')
print(conn.execute('SELECT COUNT(*) FROM orders').fetchone())
print(conn.execute('SELECT * FROM orders LIMIT 1').fetchone())
print(conn.execute('SELECT COUNT(*) FROM feature_importance').fetchone())
"
```

Erwartet: `orders`-Anzahl nahe 500, eine plausible Beispielzeile mit
nicht-leerer `explanation`.

- [ ] **Step 5: Backend lokal starten**

```bash
uvicorn src.api.main:app --reload --port 8000
```

- [ ] **Step 6: Frontend lokal starten (neues Terminal)**

```bash
cd frontend
echo "VITE_API_BASE_URL=http://localhost:8000" > .env
npm run dev
```

- [ ] **Step 7: Manueller Browser-Check**

Im Browser (Vite-Dev-URL, i.d.R. `http://localhost:5173`):
- Bestell-Liste lädt und zeigt Risiko-Ampeln
- Risiko-Filter (Dropdown) filtert sichtbar die Liste
- Klick auf eine Bestellung öffnet die Detail-Seite mit Treiber-Chart + Klartext-Erklärung
- "Feature-Wichtigkeit"-Link zeigt die aggregierte Balken-Chart

- [ ] **Step 8: Ergebnis in `CLAUDE.md`/`HANDOVER.md` festhalten (Dateien werden in Task 15 angelegt — hier nur die Rohnotiz, was verifiziert wurde vs. nur behauptet)**

Kurz notieren: welche Metriken die Pipeline geliefert hat, dass der
Browser-Check durchgeführt wurde (nicht nur "sollte funktionieren"), und
etwaige während des echten Laufs gefundene Bugs (nach dem Muster von
`cloud-native-pipeline`s `HANDOVER.md`).

- [ ] **Step 9: Generierte Artefakte committen**

```bash
git add data/olist_snapshot.sqlite models/risk_classifier.joblib
git commit -m "Echten Pipeline-Lauf: SQLite-Snapshot + Modell-Artefakt committen"
```

---

## Task 15: Portfolio-Präsentation

**Files:**
- Modify: `README.md` (vollständig, siehe Guide Schritt 5a)
- Create: `docs/index.html` (self-contained GitHub-Pages-Seite)
- Create: `CLAUDE.md`
- Create: `HANDOVER.md`

**Interfaces:**
- Consumes: reale Metriken aus Task 14, alle Architektur-Entscheidungen
  aus der Spec

Dies ist ein Dokumentations-Task, kein TDD-Task.

- [ ] **Step 1: `README.md` nach `PORTFOLIO_AGENT_GUIDE.md` Schritt 5a schreiben**

Struktur (siehe Guide für die vollständige 13-Punkte-Liste, hier die
projektspezifischen Kernpunkte):
- Titel + Link zur `docs/index.html`-Projektseite ganz oben
- "In 30 Sekunden": *"Für jede Bestellung sagt das Portal voraus, wie
  wahrscheinlich eine schlechte Kundenbewertung wird — und erklärt in
  einem Satz, warum."*
- Live-Demo-Link (sobald aus Deploy-Schritt bekannt) inkl. Cold-Start-Hinweis
- "Was das Tool macht" (nummeriert: Bestell-Liste → Detail mit Erklärung → globale Übersicht)
- Vergleichstabelle: 3 Beispiel-Bestellungen (niedrig/mittel/hoch) mit ihren Top-Treibern
- "Wie es funktioniert": warum SHAP+LLM-Kombination statt reiner Templates,
  warum SQLite-Snapshot statt Live-Postgres, warum ~500er-Stichprobe
- Mermaid-Architekturdiagramm (siehe Spec-Diagramm als Vorlage)
- **Tech-Stack-Tabelle** (Bereich | Technologie | Zweck)
- Quickstart (lokale Ausführung, Backend + Frontend getrennt)
- Tests-Abschnitt (Backend: pytest ohne Netzwerk/LLM; Frontend: Vitest+RTL)
- Link zur Spec (`docs/superpowers/specs/2026-07-28-ai-analytics-portal-design.md`) und zu `HANDOVER.md`
- Limitierungen (aus "Bewusst weggelassen" der Spec übernehmen)

- [ ] **Step 2: `docs/index.html` bauen (self-contained, hell/dunkel via `prefers-color-scheme`)**

Inhalt orientiert sich 1:1 an der README-Struktur (Hero mit CTA-Buttons zu
GitHub-Repo + Live-Demo, "Was das Tool macht" als Karten, Vergleichstabelle,
Architektur-Erklärung, Tech-Stack-Tabelle, Limitierungen) — kein externes
CDN/JS/CSS, siehe `ai-act-validation-toolkit/docs/index.html` als Referenz.

- [ ] **Step 3: `CLAUDE.md` nach Standard-Schema schreiben**

Abschnitte: `## Was das hier ist`, `## Commands` (Pipeline/Backend/Frontend
getrennt), `## Architektur` (Datei-für-Datei wie in dieser Plan-Datei),
`## Aktueller Stand` (laufend aktuell halten).

- [ ] **Step 4: `HANDOVER.md` schreiben**

Was ist fertig, was ist *nachweislich* getestet (pytest/Vitest-Suiten +
der manuelle Browser-Check aus Task 14) vs. nur behauptet, was ist bewusst
offen (Live-Deploy, s.u.), nächster konkreter Schritt.

- [ ] **Step 5: Commit**

```bash
git add README.md docs/index.html CLAUDE.md HANDOVER.md
git commit -m "Portfolio-Präsentation: README, GitHub-Pages-Seite, CLAUDE.md, HANDOVER.md"
```

- [ ] **Step 6: Hinweis — ab hier `PORTFOLIO_AGENT_GUIDE.md` Schritt 4 + 6 abarbeiten (nicht Teil dieses Plans)**

Nicht in diesem Plan enthalten, aber bevor das Backlog-Item als `fertig`
gilt zwingend nötig:
- Neues GitHub-Repo anlegen (`gh repo create maggostang-droid/ai-analytics-portal --public`), pushen
- GitHub Pages aktivieren (`gh api ... /pages`), Projektseite verifizieren
- Live-Deploy-Anleitung an Marco (Vercel für `frontend/`, Railway/Fly.io für
  Backend+SQLite) — Deploy-Schritt selbst macht Marco (Login/Billing)
- Sobald Live-URL bekannt: README, `docs/index.html`, `CLAUDE.md` gleichzeitig aktualisieren
- `PORTFOLIO_BACKLOG.md` Status auf `fertig` + Links im Item-Abschnitt
- `stangfolio/data/projects.js`: neue Karte ergänzen
- Kurze Rücksprache mit Marco vor dem nächsten Backlog-Item

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-07-28-ai-analytics-portal.md`.**

Wegen des Lehrstils (Marco lernt React/FastAPI aktiv mit) empfehle ich hier
**Inline Execution** statt Subagent-Driven: isolierte Fresh-Context-Subagents
würden implementieren, aber nicht erklären — das widerspricht dem Zweck
dieses Projekts. Bei rein zügiger Umsetzung wäre Subagent-Driven die
schnellere Wahl.

**Welche Ausführung soll ich nehmen?**
1. **Inline Execution** (empfohlen hier) — ich arbeite die Tasks in dieser
   Session ab, erkläre React/FastAPI-Konzepte unterwegs, du schreibst bei
   Gelegenheit Teile selbst mit.
2. **Subagent-Driven** — frischer Subagent pro Task, schnellere, aber
   unerklärte Umsetzung.
