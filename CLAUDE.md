# ai-analytics-portal — Projektkontext

Vollständige Spec: [docs/superpowers/specs/2026-07-28-ai-analytics-portal-design.md](docs/superpowers/specs/2026-07-28-ai-analytics-portal-design.md)
· Plan: [docs/superpowers/plans/2026-07-28-ai-analytics-portal.md](docs/superpowers/plans/2026-07-28-ai-analytics-portal.md)
(immer zuerst dort nachschauen bei Fragen zu Architektur/Scope-Entscheidungen).

## Was das hier ist

Portfolio-Projekt von Marco Stang für Bewerbungen auf AI/KI-Rollen (ggf.
auch KI-Transformations-Rollen). Ziel: React/FastAPI-Full-Stack-Lücke im
Lebenslauf schließen (bisher nur intern bei ILI.DIGITAL/`maika.digital`
belegt).

**Endziel:** Explainable-ML-Portal — sagt pro Olist-Bestellung das Risiko
einer schlechten Review voraus (`GradientBoostingClassifier`), erklärt die
Vorhersage über SHAP-Treiber + LLM-generierten Klartext, zeigt es in einem
React-Frontend gegen ein FastAPI-Backend.

**Lehrstil:** Deutsch, ausführliche Erklärungen zu React/FastAPI-Konzepten
(neu für Marco), analog zu `sql-agent`/`goz-finetune-vs-rag`.

## Commands

```bash
# Backend
python -m venv .venv
.venv/Scripts/python.exe -m pip install -e ".[dev]"
cp .env.example .env                        # nur für Pipeline-Lauf: LLM_PROVIDER/LLM_MODEL/API-Key
.venv/Scripts/python.exe -m pytest tests/ -v # 16 Tests, kein Netzwerk/LLM nötig

# Pipeline (einmalig, braucht echte Olist-CSVs in data/raw/ + .env mit API-Key)
mkdir -p data/raw && cp "../sql-agent/data/raw/"*.csv data/raw/
.venv/Scripts/python.exe -m pipeline.run_pipeline   # erzeugt data/olist_snapshot.sqlite + models/risk_classifier.joblib

.venv/Scripts/python.exe -m uvicorn src.api.main:app --reload --port 8000

# Frontend (neues Terminal)
cd frontend && npm install
echo "VITE_API_BASE_URL=http://localhost:8000" > .env
npm run dev
npm run test    # Vitest, 8 Tests, API gemockt
```

Kein Linter konfiguriert.

## Architektur

- `pipeline/build_features.py` — lädt Olist-CSVs (`orders`, `order_items`,
  `products`, `reviews`, `category_translation`), baut Feature-Tabelle:
  Lieferzeit-Delta, Preis/Fracht (summiert über Artikel), Artikelanzahl,
  Kategorie (übersetzt), `seller_avg_review_prior` (zeitlich geshiftet,
  kein Leakage)
- `pipeline/train_model.py` — One-Hot-Encoding (Top-15-Kategorien +
  "other"), zeitlicher Train/Test-Split, `GradientBoostingClassifier`
- `pipeline/explain.py` — `shap.TreeExplainer`, Top-3-Treiber pro Zeile
- `pipeline/llm.py` — `init_chat_model()`-Wrapper, 1:1-Muster von
  `sql-agent/src/agent/llm.py`
- `pipeline/narrate.py` — Prompt-Template + LLM-Aufruf für die
  Klartext-Erklärung
- `pipeline/snapshot.py` — `risk_level()`-Schwellenwerte, schreibt Tabellen
  `orders` + `feature_importance` nach SQLite
- `pipeline/run_pipeline.py` — Orchestrierung: Features → Training → SHAP →
  Stichprobe (Risiko-Terzile, ~500 Bestellungen) → LLM-Erklärungen → Snapshot
- `src/api/main.py` — FastAPI-App, CORS (`allow_origins=["*"]`)
- `src/api/db.py` — SQLite-Connection als FastAPI-Dependency (`get_db`,
  in Tests per `dependency_overrides` ersetzbar)
- `src/api/schemas.py` — Pydantic-Response-Modelle
- `src/api/routes/orders.py` — `GET /orders` (Filter: `category`,
  `risk_level`), `GET /orders/{id}`
- `src/api/routes/insights.py` — `GET /insights/feature-importance`
- `frontend/src/api/client.ts` — typisierter Fetch-Client (Interfaces
  1:1 zu `schemas.py`)
- `frontend/src/pages/` — `OrderList`, `OrderDetail`, `FeatureImportance`
- `frontend/src/components/` — `RiskBadge`, `DriverChart`,
  `ImportanceChart`
- `frontend/src/App.tsx` — Routing (`/`, `/orders/:orderId`, `/insights`)

## Wichtige Design-Entscheidungen (nicht ohne Rücksprache ändern)

- **Kein Live-Postgres.** SQLite-Snapshot wird einmalig offline erzeugt und
  committed.
- **~500er-Stichprobe, nicht alle ~100k Bestellungen** im Snapshot (Kosten/
  Zeit für LLM-Calls) — die globale Feature-Wichtigkeit basiert trotzdem
  auf allen Bestellungen.
- **Kein Live-LLM-Call zur Laufzeit der Web-App** — nur beim einmaligen
  Pipeline-Lauf, Erklärungen sind im Snapshot gecacht.
- **Zeitlicher, nicht zufälliger Train/Test-Split.**

## Aktueller Stand

**Alle 15 Plan-Tasks abgeschlossen (2026-07-29).**

- Backend: 16 pytest-Tests grün, alle 3 Endpunkte gegen den echten
  Snapshot per `curl` verifiziert.
- Frontend: 8 Vitest-Tests grün.
- Echter Pipeline-Lauf durchgeführt: ROC-AUC 0,706 / Precision 0,632 /
  Recall 0,138, Snapshot mit 498 Bestellungen (24 hoch / 14 mittel / 460
  niedrig).
- **End-to-End per echtem Browser (Playwright/Chromium, headless)
  verifiziert** — nicht nur behauptet: Bestell-Liste, Risiko-Filter,
  Detail-Seite mit Treiber-Chart + Erklärung, Feature-Wichtigkeits-Seite
  alle mit Screenshot bestätigt, `console --errors` leer.
- Dabei 4 echte Bugs gefunden und gefixt (siehe `HANDOVER.md` für Details):
  SQLite-Thread-Locking im Test-Client, fehlendes `globals: true` für
  jest-dom, fehlender `ResizeObserver`-Mock für Recharts in jsdom, und ein
  CORS-Fehler zur Laufzeit, der sich als fremder, verwaister
  `python -m http.server 8000`-Prozess auf demselben Port herausstellte
  (nicht unser Code — Backend läuft lokal jetzt testweise auf Port 8001).
- **Live-Deploy abgeschlossen (2026-07-29):**
  - Frontend: https://ai-analytics-portal-gray.vercel.app/ (Vercel Hobby, kostenlos)
  - Backend: https://ai-analytics-portal-api.onrender.com (Render Free Web Service, kostenlos)
  - End-to-End gegen die echten Produktions-URLs per Playwright verifiziert
    (nicht nur lokal) — Bestell-Liste, Filter, Detail-Seite, Insights-Seite,
    keine Konsolenfehler.
  - Dabei ein weiterer echter Bug gefunden+gefixt: `npm run build` (tsc -b)
    schlug fehl, obwohl `npm run test` grün war — Vitest prüft beim Testen
    keine strikten TypeScript-Typen. Fix: `vite/client`-Typen in
    `tsconfig.json` ergänzt (für `import.meta.env`) und `global` durch
    `globalThis` ersetzt (Node-Typ vs. Standard-JS-Global) in
    `client.test.ts`.
  - Backend schläft nach 15 Min Inaktivität ein (Render Free-Tier),
    Cold-Start ~50s beim nächsten Aufruf.
  - Backlog-Status und `stangfolio`-Karte sind aktualisiert (Schritt 6 aus
    `PORTFOLIO_AGENT_GUIDE.md`).
