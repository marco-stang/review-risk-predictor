# HANDOVER — ai-analytics-portal

Stand: 2026-07-29. Gedacht für eine neue Agenten-Session ohne Kenntnis des
bisherigen Chatverlaufs — hier steht, was fertig ist, was *nachweislich*
funktioniert, was bewusst offen ist, und der nächste konkrete Schritt.

## Was fertig ist

Alle 15 Tasks aus [`docs/superpowers/plans/2026-07-28-ai-analytics-portal.md`](docs/superpowers/plans/2026-07-28-ai-analytics-portal.md)
sind umgesetzt und committed:

- **Pipeline** (`pipeline/`): Feature-Engineering, zeitlicher Train/Test-Split,
  `GradientBoostingClassifier`, SHAP-Treiber, LLM-Erklärungstext,
  SQLite-Snapshot-Schreiben, End-to-End-Orchestrierung (`run_pipeline.py`).
- **Backend** (`src/api/`): FastAPI mit 3 Endpunkten (`GET /orders`,
  `GET /orders/{id}`, `GET /insights/feature-importance`).
- **Frontend** (`frontend/`): React + Vite + TypeScript, 3 Seiten
  (Bestell-Liste, Bestell-Detail, Feature-Wichtigkeit), 3 Komponenten
  (RiskBadge, DriverChart, ImportanceChart).
- **Portfolio-Präsentation:** README, `docs/index.html`
  (GitHub-Pages-Projektseite, noch nicht aktiviert — siehe "Nächster
  Schritt"), dieses Dokument.

## Was *nachweislich* funktioniert (nicht nur behauptet)

- `pytest tests/ -v` → **16 Tests grün**, ohne Netzwerk-/LLM-Zugriff
  (Fake-LLM-Klasse für `narrate.py`, In-Memory-SQLite-Fixture für die API).
- `npm run test` (Vitest, im `frontend/`-Verzeichnis) → **8 Tests grün**,
  API-Calls gemockt.
- **Echter Pipeline-Lauf** (`python -m pipeline.run_pipeline`) gegen die
  echten Olist-CSVs + echten Anthropic-API-Key durchgeführt:
  - Modell-Metriken (Testset): ROC-AUC 0,706, Precision 0,632, Recall 0,138
  - Snapshot: 498 Bestellungen (24 hoch / 14 mittel / 460 niedrig),
    `data/olist_snapshot.sqlite` + `models/risk_classifier.joblib` committed
- **Alle 3 API-Endpunkte per `curl` gegen den echten Snapshot getestet**
  (nicht nur gegen die Test-Fixture) — plausible Ergebnisse, echte
  LLM-generierte Erklärungstexte korrekt UTF-8-kodiert (Umlaute/€ verifiziert
  über Datei-Schreib-/Lese-Test, da die Windows-Konsole sie beim direkten
  `print()` falsch anzeigt — das war ein reines Anzeige-Artefakt, keine
  Daten-Corruption).
- **Echter Browser-Durchlauf per Playwright (headless Chromium)** —
  nicht nur ein Backend-Smoke-Test:
  1. Bestell-Liste lädt und zeigt Risiko-Ampeln (Screenshot bestätigt)
  2. Risiko-Filter auf "hoch" → Liste filtert auf 24 Einträge (per DOM
     ausgezählt, entspricht der DB-Verteilung)
  3. Klick auf Bestellung → Detail-Seite zeigt Treiber-Chart (SVG
     verifiziert) + korrekten Erklärungstext
  4. Navigation zu "Feature-Wichtigkeit" → aggregierte Balken-Chart
     (Screenshot bestätigt)
  5. `console --errors` über den gesamten Durchlauf: **leer**

## Während der Umsetzung gefundene und gefixte Bugs

1. **SQLite-Thread-Locking im Test-Client** (`tests/conftest.py`):
   FastAPIs `TestClient` führt Endpunkte in einem anderen Thread aus als
   dem, der die `:memory:`-Connection erstellt hat. Fix:
   `check_same_thread=False`.
2. **`@testing-library/jest-dom` brauchte globales `expect`**
   (`frontend/vite.config.ts`): Fix über `test.globals: true`.
3. **Recharts' `ResponsiveContainer` rendert kein SVG in jsdom** ohne
   echte Größenmeldung (`frontend/src/test-setup.ts`): Fix über ein
   `ResizeObserver`-Mock, das sofort eine simulierte Größe zurückmeldet
   (ein reines No-op-Mock reicht nicht).
4. **CORS-Fehler beim echten Browser-Test:** Ursache war *kein* Bug im
   eigenen Code, sondern ein fremder, bereits laufender
   `python -m http.server 8000`-Prozess (nicht von dieser Session
   gestartet), der zufällig denselben Port 8000 belegte — Windows lässt
   das zu, Anfragen landeten nicht-deterministisch bei dem einen oder
   anderen Prozess. Für die Verifikation wurde lokal auf Port 8001
   ausgewichen (nur zu Testzwecken — README/Doku nennen weiterhin Port
   8000 als Standard, da ein Nutzer diesen Konflikt i.d.R. nicht hat).

## Bewusst offen / nächster konkreter Schritt

**Live-Deploy steht noch aus** (braucht Marcos Login/Billing, siehe
`PORTFOLIO_AGENT_GUIDE.md` Schritt 6 — eine Agenten-Session kann das nicht
selbst):

1. **Frontend auf Vercel:**
   - Neues Projekt aus dem GitHub-Repo `maggostang-droid/ai-analytics-portal`
   - Root Directory: `frontend/`
   - Build Command: `npm run build`, Output: `dist/`
   - Env Var: `VITE_API_BASE_URL` = die spätere Railway/Fly.io-Backend-URL

2. **Backend auf Railway oder Fly.io:**
   - Aus demselben Repo, Root Directory: Projekt-Root
   - Start Command: `uvicorn src.api.main:app --host 0.0.0.0 --port $PORT`
   - `data/olist_snapshot.sqlite` und `models/risk_classifier.joblib` sind
     bereits im Repo committed — kein Secret/API-Key im Deployment nötig
     (die App macht zur Laufzeit keinen LLM-Call).

3. Sobald beide URLs bekannt sind: in `README.md` (Live-Demo-Abschnitt),
   `docs/index.html` (CTA-Button "Live-Demo folgt" aktivieren) und
   `CLAUDE.md` ("Aktueller Stand") gleichzeitig eintragen.

4. **Danach erst** (nicht vorher): `PORTFOLIO_AGENT_GUIDE.md` Schritt 4
   (GitHub-Repo tatsächlich anlegen — bisher nur lokales Git-Repo!),
   Schritt 6 komplett abarbeiten (GitHub Pages aktivieren,
   `PORTFOLIO_BACKLOG.md` auf `fertig` setzen, `stangfolio`-Karte
   ergänzen, Rücksprache mit Marco).

**Wichtig:** Dieses Repo existiert bisher nur lokal (`git init` +
Commits) — es wurde noch **kein** GitHub-Repo dafür angelegt/gepusht.
Das ist der allererste Schritt, bevor GitHub Pages aktiviert werden kann.

## Bekannte Limitierungen (bewusst, kein Fix nötig)

- Recall 0,138 — Modell übersieht einen relevanten Teil schlechter Reviews.
  Für die Explainability-Methodik-Demo ausreichend, kein Anspruch auf
  Produktionsreife.
- ~500er-Stichprobe im Snapshot, nicht alle ~100k Bestellungen (Kosten/Zeit
  für LLM-Calls).
- `data/raw/` (Olist-Rohdaten) ist gitignored und muss aus
  `sql-agent/data/raw/` kopiert werden, um die Pipeline erneut laufen zu
  lassen.
