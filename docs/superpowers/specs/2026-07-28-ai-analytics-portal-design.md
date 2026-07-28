# Design: ai-analytics-portal

Erstellt: 2026-07-28
Backlog-Herkunft: [`../../../../PORTFOLIO_BACKLOG.md`](../../../../PORTFOLIO_BACKLOG.md), Item #2.

## Portfolio-Einordnung

Schließt die React/FastAPI-Full-Stack-Lücke im Lebenslauf (bisher nur intern
bei ILI.DIGITAL/`maika.digital` belegt, kein öffentliches Repo zeigt diese
Kombination). Zielgruppe: AI/KI-Rollen, ggf. KI-Transformations-Rollen.

Lernstil: Lehrstil wie bei `sql-agent`/`goz-finetune-vs-rag` — Marco lernt
React/FastAPI aktiv mit. Deutsch, ausführliche Erklärungen, Marco schreibt
Teile selbst mit (nicht vorlösen, außer ausdrücklich gewünscht).

## Use-Case

**Kunden-Risiko/Review-Vorhersage:** Für jede Bestellung in den
Olist-Daten (aus `sql-agent`, siehe `sql-agent/docs/schema.md`) wird
vorhergesagt, wie wahrscheinlich sie eine schlechte Review (≤2 Sterne)
bekommt — mit einer nachvollziehbaren Erklärung der Haupttreiber statt
einer reinen Black-Box-Zahl. Explainability ist der Kern des Use Cases,
nicht nur ein Zusatzfeature.

Bewusst **nicht** gewählt (im Brainstorming verworfen):
- Verkäufer-Performance-Cockpit — ähnlicher Explainability-Fokus, aber
  weniger scharf auf ein einzelnes, greifbares Vorhersage-Objekt (eine
  Bestellung) zugeschnitten.
- Umsatz/Trend-Assistent (Chat+Charts) — zu nah an `sql-agent`, hätte den
  Agentic-AI-Charakter dupliziert statt eine neue Lücke (klassisches
  erklärbares ML) zu schließen.

## Architektur

```
React (Vite + TypeScript)  ──fetch──>  FastAPI  ──>  SQLite-Snapshot
  Bestell-Liste + Ampel                   │            (Olist-Subset,
  Bestell-Detail + Treiber-Chart          │             im Repo gebündelt)
  Feature-Importance-Übersicht            │
                                          ├─>  Gradient-Boosting-Modell
                                          │    (offline trainiert, Artefakt
                                          │     im Repo, scikit-learn)
                                          │
                                          ├─>  SHAP (Top-3-Feature-Werte
                                          │     pro Vorhersage)
                                          │
                                          └─>  LLM (init_chat_model, wie
                                               sql-agent/src/agent/llm.py)
                                               formuliert Klartext-Satz aus
                                               den SHAP-Werten
```

Kein Live-Postgres, keine Live-Verbindung zu `sql-agent`s Datenbank. Die
Olist-Daten werden einmalig offline zu einem SQLite-Snapshot + Modell-
Artefakt verarbeitet und beides ins Repo übernommen — vermeidet einen
zweiten, dauerhaft laufenden DB-Service nur für dieses Projekt.

## Datenpipeline (offline, einmaliges Skript)

Quelle: dieselben Olist-CSVs wie in `sql-agent/data/` (read-only Kopie,
keine erneute Web-Recherche/neuer Datensatz nötig).

**Features pro Bestellung:**
- Lieferzeit-Delta (tatsächliches Lieferdatum − geschätztes Lieferdatum)
- `order_items.price`, `order_items.freight_value`
- Produktkategorie (`category_translation`, englisch)
- Anzahl Artikel in der Bestellung
- Seller-Historie: Ø-Review-Score der bisherigen Bestellungen dieses Sellers
  (zeitlich korrekt berechnet — nur Bestellungen *vor* der aktuellen, kein
  Data Leakage aus zukünftigen Reviews desselben Sellers)

**Ziel:** `review_score <= 2` (binäre Klassifikation)

**Modell:** `GradientBoostingClassifier` (scikit-learn). Train/Test-Split
zeitlich (nicht zufällig) getrennt, um Leakage zu vermeiden. Metriken
(ROC-AUC, Precision/Recall) werden im README dokumentiert — kein Anspruch
auf produktionsreife Vorhersagegüte, Fokus liegt auf der
Explainability-Methodik.

**Output der Pipeline:** `data/olist_snapshot.sqlite` (Bestellungen +
Features + vorab berechneter Risiko-Score + SHAP-Werte) und
`models/risk_classifier.joblib` — beide versioniert im Repo (synthetische/
öffentliche Kaggle-Daten, keine Kundendaten-Problematik).

## Backend (FastAPI)

- `GET /orders` — Liste mit Risiko-Score/Ampel, Filter nach Kategorie und
  Risiko-Level (niedrig/mittel/hoch)
- `GET /orders/{id}` — Details + Top-3-SHAP-Treiber + LLM-generierte
  Klartext-Erklärung
- `GET /insights/feature-importance` — aggregierte SHAP-Werte über alle
  Bestellungen (Datengrundlage für die Übersichts-Chart)

Kein Auth, kein Schreibzugriff, reine Analyse-API. LLM-Erklärungen werden
beim Pipeline-Lauf vorab generiert und im SQLite-Snapshot gecacht (nicht
bei jedem API-Request neu vom LLM geholt) — hält Latenz/Kosten der Live-Demo
niedrig und macht die Endpunkte in Tests ohne LLM-Call testbar.

## Frontend (React + Vite + TypeScript)

- Seite 1: Bestell-Liste mit Ampel-Filter
- Seite 2: Bestell-Detail mit Treiber-Chart + Klartext-Erklärung
- Seite 3: Globale Feature-Importance-Übersicht (Balkenchart)
- Chart-Library: Recharts

## Deployment

- Frontend: Vercel (statischer Vite-Build)
- Backend: Railway oder Fly.io (FastAPI + SQLite-Datei im selben Container)
- Wie bei den anderen Projekten: der eigentliche Live-Deploy braucht Marcos
  Login/eigenen API-Key (für die LLM-Erklärungen zur Pipeline-Laufzeit) —
  eine Agenten-Session liefert eine exakte Schritt-für-Schritt-Anleitung,
  Marco führt den Deploy-Schritt selbst aus (siehe `PORTFOLIO_AGENT_GUIDE.md`
  Schritt 6). Da die LLM-Erklärungen bereits zur Pipeline-Zeit generiert und
  im Snapshot gecacht werden, braucht die *laufende* Web-App selbst keinen
  LLM-API-Key mehr — nur der einmalige Pipeline-Lauf.

## Tests

- Backend: pytest für alle drei Endpunkte (Daten kommen aus dem
  mitgelieferten SQLite-Snapshot, kein Netzwerk/LLM-Call zur Testzeit nötig,
  da Erklärungen vorab gecacht sind)
- Frontend: Vitest + React Testing Library für die drei Kernkomponenten
  (Bestell-Liste, Detail-Ansicht, Feature-Importance-Chart)

## Bewusst weggelassen

- Kein Auth, keine Multi-Tenancy, kein Nachbau eines generischen BI-Tools
- Kein Live-Postgres/keine Live-Verbindung zu `sql-agent`s Datenbank
- Keine Modell-Nachtrainierung zur Laufzeit — das Modell ist ein statisches,
  offline trainiertes Artefakt
- Kein Anspruch auf produktionsreife Vorhersagegüte
- Kein Live-LLM-Call zur Laufzeit der Web-App (nur beim einmaligen
  Pipeline-Lauf) — hält die laufende App einfach, kostengünstig und ohne
  API-Key-Abhängigkeit im Deployment

## Repo

`github.com/maggostang-droid/ai-analytics-portal`, public, Branch `master`
(Konvention der bestehenden 5 Projekte).
