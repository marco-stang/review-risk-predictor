# LEARNING-PATH — ai-analytics-portal

Ziel dieses Dokuments: Dich in die Lage versetzen, dieses Projekt in einem
Bewerbungsgespräch selbstbewusst zu erklären — nicht "ich hab das gebaut",
sondern *warum* es so gebaut ist und was du bei kritischen Nachfragen
antwortest. Alles unten ist gegen den echten Code in diesem Repo geprüft
(Stand: `HANDOVER.md`, 2026-07-29). Wo etwas im Code *nicht* vorhanden ist,
obwohl die Portfolio-Kurzbeschreibung es nahelegt, steht das explizit dabei
(siehe Abschnitt 4).

---

## 1. Elevator-Pitch (auswendig lernen)

> "Für jede Bestellung im Olist-Online-Marktplatz sagt mein Portal voraus,
> wie wahrscheinlich der Kunde eine schlechte Bewertung (1-2 Sterne)
> abgibt — und erklärt in ein bis zwei verständlichen Sätzen, *warum*,
> statt nur eine Zahl auszugeben. Die Vorhersage selbst kommt von einem
> klassischen, transparenten `GradientBoostingClassifier`, nicht von einem
> LLM; SHAP bestimmt die konkreten Haupttreiber pro Bestellung, und erst
> ein LLM übersetzt diese Zahlen in Klartext. Die Kerninnovation ist also
> nicht 'noch ein ML-Modell', sondern die Kombination aus erklärbarem
> Modell + SHAP + LLM-Formulierung zu einer nachvollziehbaren Aussage, die
> auch Nicht-Techniker verstehen."

---

## 2. Architektur-Überblick

```
Olist-CSVs (data/raw/)
   → pipeline/build_features.py   Feature-Engineering
   → pipeline/train_model.py      zeitlicher Split + GradientBoostingClassifier
   → pipeline/explain.py          SHAP TreeExplainer, Top-3-Treiber
   → pipeline/llm.py + narrate.py LLM formuliert Klartext aus SHAP-Werten
   → pipeline/snapshot.py         schreibt SQLite-Snapshot (offline, einmalig)
   → src/api/                     FastAPI liest NUR aus dem Snapshot
   → frontend/src/                React/TypeScript-UI
```

Reale Dateien, die du im Gespräch nennen können solltest:

- **Datenpipeline / Feature Engineering:** `pipeline/build_features.py`
  (Funktionen `load_raw_tables`, `build_feature_table`)
- **Modelltraining:** `pipeline/train_model.py` (`encode_features`,
  `split_temporal`, `train_model`, `evaluate_model`)
- **SHAP-Erklärungsschicht:** `pipeline/explain.py`
  (`compute_shap_values`, `top_features`)
- **LLM-Übersetzungsschritt:** `pipeline/llm.py` (`get_llm`) und
  `pipeline/narrate.py` (`PROMPT_TEMPLATE`, `format_drivers`,
  `generate_explanation`)
- **Snapshot/Orchestrierung:** `pipeline/snapshot.py` (`risk_level`,
  `write_snapshot`), `pipeline/run_pipeline.py` (`run()` — verkettet alle
  obigen Schritte)
- **FastAPI-Backend:** `src/api/main.py` (App + CORS), `src/api/db.py`
  (`get_connection`, `get_db`-Dependency), `src/api/schemas.py`
  (Pydantic-Modelle `OrderSummary`, `DriverItem`, `OrderDetail`,
  `FeatureImportanceItem`), `src/api/routes/orders.py` (`GET /orders`,
  `GET /orders/{order_id}`), `src/api/routes/insights.py`
  (`GET /insights/feature-importance`)
- **React/TypeScript-Frontend:** `frontend/src/api/client.ts`
  (typisierter Fetch-Client, Interfaces 1:1 zu `schemas.py`),
  `frontend/src/pages/OrderList.tsx`, `OrderDetail.tsx`,
  `FeatureImportance.tsx`, `frontend/src/components/RiskBadge.tsx`,
  `DriverChart.tsx`, `ImportanceChart.tsx`, Routing in `frontend/src/App.tsx`

Persistenz: **kein Live-Postgres**. `data/olist_snapshot.sqlite` +
`models/risk_classifier.joblib` sind einmalig offline erzeugte, ins Repo
committete Artefakte. Die laufende Web-App macht **keinen** LLM-Call zur
Laufzeit — Erklärungen sind im Snapshot vorab gecacht.

---

## 3. Stationen

### Station 1 — Zeitlicher Train/Test-Split (Data Leakage vermeiden)

**Datei:** `pipeline/train_model.py`, Funktion `split_temporal`

```python
def split_temporal(df, test_frac=0.2):
    df_sorted = df.sort_values("purchase_timestamp").reset_index(drop=True)
    split_idx = int(len(df_sorted) * (1 - test_frac))
    return df_sorted.iloc[:split_idx], df_sorted.iloc[split_idx:]
```

Die neuesten `test_frac` (im echten Lauf ~20 %) der Bestellungen bilden
das Testset — kein `train_test_split(..., shuffle=True)`. Grund: Die
Daten haben eine Zeitachse mit saisonalen Effekten (z.B. Lieferzeiten um
Weihnachten, generelle Verbesserung der Logistik über die Zeit). Ein
zufälliger Split würde Trainings- und Testdaten aus derselben Zeitperiode
mischen und dadurch **optimistisch verzerrte** Metriken liefern, weil das
Modell im Test quasi "die Zukunft schon gesehen hat". Das ist derselbe
Grundgedanke wie bei jedem Zeitreihen-Problem: Immer so splitten, wie das
Modell später auch tatsächlich eingesetzt würde (Vorhersage für
*zukünftige*, nicht für zufällig verstreute Bestellungen).

Verwandtes Leakage-Detail im selben Themenfeld:
`pipeline/build_features.py`, Feature `seller_avg_review_prior` — der
Verkäufer-Durchschnitt wird zeitlich sortiert und per
`.shift().expanding().mean()` berechnet, sodass eine Bestellung **nie**
den eigenen oder einen späteren Review-Wert desselben Sellers in ihr
eigenes Feature einfließen lässt.

**Selbstkontrollfrage:** Was würde passieren, wenn du hier stattdessen
einen zufälligen 80/20-Split verwendet hättest — würde der ROC-AUC eher
steigen oder fallen, und warum wäre das Ergebnis trotzdem schlechter für
die Praxis?

### Station 2 — Feature Engineering & One-Hot-Encoding

**Datei:** `pipeline/build_features.py` (`build_feature_table`) und
`pipeline/train_model.py` (`encode_features`)

Features pro Bestellung: `delivery_delta_days` (tatsächliches minus
geschätztes Lieferdatum), `price` + `freight_value` (über alle Artikel
der Bestellung summiert, nicht aus der `payments`-Tabelle), `item_count`,
`category_english` (übersetzt via `category_translation`-CSV, die ein
UTF-8-BOM hat — deshalb explizit `encoding="utf-8-sig"`, sonst würde der
Join auf der Kategorie-Spalte still scheitern), und
`seller_avg_review_prior`. Kategorie wird auf die Top-15 häufigsten Werte
plus ein Sammel-Bucket `"other"` reduziert (`TOP_N_CATEGORIES = 15`) und
dann One-Hot-kodiert (`pd.get_dummies`). Die resultierende
`feature_columns`-Liste wird als *exakte, geordnete* Spaltenliste
durchgereicht — an Training, Vorhersage **und** SHAP — weil SHAP sonst
die falschen Werte den falschen Spalten zuordnen würde.

**Selbstkontrollfrage:** Warum reicht es nicht, `feature_columns` bei
jedem Aufruf neu aus dem DataFrame abzuleiten (z.B. `df.columns`), statt
sie einmal fest zu speichern und weiterzureichen?

### Station 3 — GradientBoostingClassifier: Training & Trade-off

**Datei:** `pipeline/train_model.py` (`train_model`, `evaluate_model`)

```python
model = GradientBoostingClassifier(random_state=42)
model.fit(train_df[feature_columns], train_df["bad_review"])
...
proba = model.predict_proba(test_df[feature_columns])[:, 1]
preds = (proba >= 0.5).astype(int)
```

Zielgröße: `bad_review = (review_score <= 2)`. Es wird
`scikit-learn`s Standard-`GradientBoostingClassifier` mit
Default-Hyperparametern (bis auf `random_state=42`) verwendet — **kein**
Hyperparameter-Tuning (GridSearch/Optuna) im Code. Der Schwellenwert für
"hoch/niedrig" bei der Klassifikation ist der scikit-learn-Standard
`0.5`. Wichtig, damit du hier ehrlich bleibst: Im Code gibt es **keinen
expliziten Kalibrierungsschritt** (kein `CalibratedClassifierCV`, keine
Platt/Isotonic-Skalierung) — die im Portfolio-Text verwendete Formulierung
"konservativ kalibriert" beschreibt das **beobachtete Verhalten** des
Modells bei Schwelle 0,5 (hohe Precision, niedriger Recall), nicht eine
technische Kalibrierungs-Prozedur. Das solltest du in einem Gespräch
genauso präzise sagen, statt "kalibriert" im technischen Sinn zu
behaupten.

**Selbstkontrollfrage:** Wenn dich jemand fragt "Habt ihr die
Klassengewichte oder den Schwellenwert angepasst, um den Recall zu
erhöhen?" — was ist die ehrliche Antwort, und was wäre der nächste
konkrete Schritt, den du nennen könntest (z.B. `class_weight`,
Schwellenwert-Verschiebung, `CalibratedClassifierCV`)?

### Station 4 — SHAP: Wie die Treiber bestimmt werden

**Datei:** `pipeline/explain.py`

```python
def compute_shap_values(model, X):
    explainer = shap.TreeExplainer(model)
    return explainer.shap_values(X)

def top_features(shap_row, feature_row, feature_columns, n=3):
    order = np.argsort(-np.abs(shap_row))[:n]
    ...
```

`shap.TreeExplainer` funktioniert direkt und exakt (kein Sampling/
Approximation nötig) mit Baummodellen wie `GradientBoostingClassifier`.
`top_features` sortiert nach dem **absoluten** SHAP-Wert — der größte
Einfluss zuerst, unabhängig davon, ob er das Risiko erhöht oder senkt —
und liefert die Top-3 als Liste von Dicts mit `feature`, `shap_value`,
`feature_value`. Diese Struktur wird 1:1 als JSON in der SQLite-Spalte
`shap_drivers_json` gespeichert (`run_pipeline.py`), von
`src/api/routes/orders.py` beim `GET /orders/{order_id}` per
`json.loads` wieder ausgepackt und über das Pydantic-Modell `DriverItem`
(`src/api/schemas.py`) an das Frontend gereicht, wo
`frontend/src/components/DriverChart.tsx` sie als horizontales Recharts-
Balkendiagramm zeichnet.

Für die aggregierte Feature-Wichtigkeits-Seite
(`GET /insights/feature-importance`) wird SHAP dagegen auf **alle**
Bestellungen angewendet (nicht nur die ~500er-Stichprobe) und der
mittlere absolute SHAP-Wert je Feature gebildet
(`np.abs(shap_values).mean(axis=0)` in `run_pipeline.py`) — SHAP-
Berechnung ist rechnerisch billig, nur der LLM-Call pro Bestellung ist
der teure Teil, der die Stichprobe nötig macht.

**Selbstkontrollfrage:** Warum wird nach dem *absoluten* SHAP-Wert
sortiert und nicht nach dem positiven/negativen Wert direkt? Was würde
bei reiner Sortierung nach dem Rohwert (ohne `abs()`) im Ergebnis fehlen?

### Station 5 — LLM übersetzt SHAP-Werte in Klartext (Prompt-Design)

**Dateien:** `pipeline/llm.py`, `pipeline/narrate.py`

```python
PROMPT_TEMPLATE = (
    "Ein Machine-Learning-Modell schätzt das Risiko, dass eine "
    "Online-Bestellung eine schlechte Kundenbewertung (1-2 Sterne) bekommt, "
    "auf {risk_score:.0%}. Die wichtigsten Einflussfaktoren laut "
    "SHAP-Analyse:\n{drivers_text}\n\n"
    "Formuliere in 1-2 kurzen Sätzen auf Deutsch, verständlich für "
    "Nicht-Techniker, warum diese Bestellung dieses Risiko hat. Nenne "
    "konkrete Zahlen aus den Faktoren."
)
```

Der Prompt bekommt zwei Dinge: den Risiko-Score als Prozentzahl und die
Top-3-SHAP-Treiber, formatiert von `format_drivers` als
`"- feature = wert (SHAP-Beitrag: +/-x.xxx)"`. Die Anweisung an das LLM
ist bewusst eng gefasst: 1-2 Sätze, Deutsch, für Nicht-Techniker,
*konkrete Zahlen nennen* (damit die Erklärung nicht schwammig wird,
sondern nachprüfbar bleibt, z.B. "8 Tage zu spät"). `get_llm()`
(`pipeline/llm.py`) baut das Modell providerunabhängig über LangChains
`init_chat_model(model, model_provider=provider)` aus `LLM_PROVIDER`/
`LLM_MODEL` in der `.env` — exakt dasselbe Muster wie in `sql-agent`. Im
echten Pipeline-Lauf wurde laut `.env.example`/`HANDOVER.md` Anthropic
mit `claude-sonnet-4-5-20250929` verwendet. Diese LLM-Calls laufen **nur
einmal** während `run_pipeline.py`, nicht bei jedem Seitenaufruf — das
Ergebnis landet in der SQLite-Spalte `explanation`.

**Selbstkontrollfrage:** Warum ist es wichtig, dass der Prompt die
SHAP-Werte explizit vorgibt, statt dem LLM nur die Rohdaten der
Bestellung zu geben und es "raten" zu lassen, was der Haupttreiber ist?

### Station 6 — FastAPI-Backend: Endpunkte & Datenfluss

**Dateien:** `src/api/main.py`, `src/api/db.py`,
`src/api/routes/orders.py`, `src/api/routes/insights.py`

Drei Endpunkte, alle lesen ausschließlich aus dem SQLite-Snapshot (keine
Schreibzugriffe, kein Auth):

- `GET /orders?category=&risk_level=` → Liste (`OrderSummary`), Filter
  werden dynamisch als SQL-`WHERE`-Bedingungen angehängt
  (`orders.py::list_orders`)
- `GET /orders/{order_id}` → Detail (`OrderDetail`, inkl. `drivers` +
  `explanation`), 404 über `HTTPException` wenn die Order-ID nicht
  existiert (`orders.py::get_order`)
- `GET /insights/feature-importance` → aggregierte Liste
  (`FeatureImportanceItem`), sortiert nach `mean_abs_shap DESC`

`get_db()` in `src/api/db.py` ist eine FastAPI-`Depends`-Dependency, die
in Tests per `app.dependency_overrides` durch eine In-Memory-SQLite-
Fixture ersetzt wird (`tests/conftest.py`) — dadurch laufen alle 16
Backend-Tests ohne Zugriff auf die echte Snapshot-Datei oder das Netz.
CORS ist bewusst offen (`allow_origins=["*"]`) — für eine reine
Portfolio-Demo ohne Auth vertretbar, für ein echtes Produkt wäre das ein
Punkt, den man einschränken müsste.

**Selbstkontrollfrage:** Was genau macht `dependency_overrides` in den
Tests anders als wenn du einfach eine zweite SQLite-Datei für Tests
anlegen würdest?

### Station 7 — React/TypeScript-Frontend: Seiten & Komponenten

**Dateien:** `frontend/src/App.tsx`, `frontend/src/pages/*.tsx`,
`frontend/src/components/*.tsx`, `frontend/src/api/client.ts`

Drei Routen (`App.tsx`, `react-router-dom`): `/` (`OrderList.tsx`,
Bestell-Liste mit Risiko-Filter-Dropdown, ruft `fetchOrders` bei jeder
Filteränderung neu auf), `/orders/:orderId` (`OrderDetail.tsx`, zeigt
`RiskBadge` + LLM-`explanation`-Text + `DriverChart`), `/insights`
(`FeatureImportance.tsx`, zeigt `ImportanceChart`). `client.ts` definiert
TypeScript-Interfaces, die **1:1** den Pydantic-Modellen aus
`schemas.py` entsprechen (`OrderSummary`, `DriverItem`, `OrderDetail`,
`FeatureImportanceItem`) — das ist die (manuelle, nicht automatisch
generierte) Typsicherheits-Brücke zwischen Backend und Frontend. Charts
kommen von Recharts (`DriverChart.tsx`: horizontales Balkendiagramm der
SHAP-Werte; `ImportanceChart.tsx`: aggregierte Feature-Wichtigkeit).

**Selbstkontrollfrage:** Was ist der Nachteil daran, die TypeScript-
Interfaces manuell 1:1 zu den Pydantic-Modellen zu pflegen, statt sie
z.B. aus der von FastAPI automatisch generierten OpenAPI-Spec zu
generieren? Wann würde sich das rächen?

### Station 8 — Testarchitektur: Wie ohne Netzwerk/LLM getestet wird

**Dateien:** `tests/test_narrate.py`, `tests/conftest.py`,
`frontend/src/test-setup.ts`

Backend: 16 pytest-Tests, u.a. mit einer `_FakeLLM`-Klasse
(`tests/test_narrate.py`), die nur `.invoke(prompt)` implementiert und
den letzten Prompt speichert — so wird geprüft, dass
`generate_explanation` den Prompt korrekt befüllt und die Antwort
trimmt, ganz ohne echten API-Call. Frontend: 8 Vitest-Tests mit
gemockten `fetch`-Aufrufen. Aus `HANDOVER.md` bekannt: Zwei reale,
nicht-triviale Bugs kamen genau aus dieser Testinfrastruktur zutage —
SQLite `check_same_thread=False` nötig, weil FastAPIs `TestClient`
Endpunkte in einem anderen Thread ausführt als dem, der die
`:memory:`-Connection erstellt hat; und ein `ResizeObserver`-Mock war
nötig, weil Recharts' `ResponsiveContainer` ohne echte Größenmeldung
in jsdom kein SVG rendert (ein reines No-op-Mock reichte nicht).

**Selbstkontrollfrage:** Warum reicht ein No-op-`ResizeObserver`-Mock
nicht aus, um Recharts in jsdom zum Rendern zu bringen — was genau
braucht `ResponsiveContainer` dafür?

---

## 4. Ehrliche Grenzen & Negativergebnisse

**Modell-Metriken (echter Pipeline-Lauf, Testset laut `HANDOVER.md`):**
ROC-AUC **0,706**, Precision **0,632**, Recall **0,138** (Snapshot: 498
Bestellungen, 24 hoch / 14 mittel / 460 niedrig).

- **ROC-AUC 0,706 einordnen:** 0,5 wäre Zufall, 1,0 wäre perfekte
  Trennung. 0,706 bedeutet: Das Modell trennt "wird schlecht bewertet"
  von "wird nicht schlecht bewertet" **deutlich besser als Raten**, ist
  aber weit von einem in der Praxis "starken" Klassifikator entfernt
  (üblich wird ab ~0,8 von "gut" gesprochen, das ist projekt-/
  domänenabhängig). Für ein Portfolio-Projekt, dessen Fokus die
  Explainability-*Methodik* ist (SHAP → LLM-Text), nicht die
  Vorhersagegüte selbst, ist das ein akzeptables, aber kein
  beeindruckendes Ergebnis — das solltest du genau so benennen, nicht
  schönreden.
- **Precision 0,632 / Recall 0,138 — bewusster Trade-off, nicht nur
  Zufallsprodukt der Schwelle 0,5:** Von den Bestellungen, die das
  Modell als "hoch riskant" markiert, stimmt das in ~63 % der Fälle
  (hohe Precision) — aber das Modell markiert nur **13,8 %** aller
  tatsächlich schlecht bewerteten Bestellungen überhaupt als riskant
  (niedriger Recall). Business-Kontext, in dem das sinnvoll ist: Ein
  Alert-/Frühwarnsystem, bei dem jeder "hoch"-Alarm einen Menschen zum
  Eingreifen bewegt (z.B. proaktiver Kundenservice-Kontakt) — dort ist
  es teurer, viele **falsche** Alarme zu erzeugen (Kunden nerven,
  Ressourcen verschwenden) als einen Teil der echten Risikofälle zu
  übersehen. Wichtig: Im Code selbst gibt es dafür **keine explizite
  Kalibrierungs- oder Schwellenwert-Anpassung** — der Trade-off ergibt
  sich aus dem Standard-Schwellenwert 0,5 auf den vom
  `GradientBoostingClassifier` gelieferten Wahrscheinlichkeiten. Sag das
  im Gespräch so, statt zu behaupten, der Trade-off sei aktiv über z.B.
  `class_weight` oder eine verschobene Entscheidungsschwelle
  einprogrammiert worden.
- **Denkbare Verbesserungen** (aus eigener Einschätzung, nicht im Code
  umgesetzt): Schwellenwert unter 0,5 senken, um Recall zu erhöhen (auf
  Kosten der Precision); `class_weight="balanced"` oder Oversampling,
  da schlechte Reviews die Minderheitsklasse sind; Hyperparameter-Tuning
  (`n_estimators`, `max_depth`, `learning_rate`) statt Defaults;
  zusätzliche Features (z.B. Produktbeschreibungstext, Retouren-Historie
  des Kunden); echte Wahrscheinlichkeits-Kalibrierung per
  `CalibratedClassifierCV`, falls die *Zahl* 84 % tatsächlich als
  kalibrierte Wahrscheinlichkeit interpretiert werden soll und nicht nur
  als Ranking-Score.
- **Weitere bewusste Grenzen aus README/HANDOVER:** ~500er-Stichprobe
  statt aller ~100.000 Bestellungen im Snapshot (Kosten/Zeit für
  LLM-Calls, die globale Feature-Wichtigkeit basiert dagegen auf allen
  Bestellungen); kein Auth, keine Multi-Tenancy, kein generisches
  BI-Tool; kein Live-Postgres; kein Live-LLM-Call zur Laufzeit der Web-
  App; Live-Deploy war zum Stand von `HANDOVER.md` noch offen
  (Render.com für Backend, Vercel für Frontend geplant, aber noch nicht
  durchgeführt — kein GitHub-Repo existierte zu dem Zeitpunkt).

---

## 5. Recruiter-Simulation

**F1: Was macht das Projekt in einem Satz?**
A: Sagt pro Olist-Bestellung das Risiko einer schlechten Bewertung
voraus und erklärt in ein bis zwei Sätzen Klartext warum, statt nur eine
Zahl zu zeigen — kombiniert aus `GradientBoostingClassifier`, SHAP und
einem LLM-Formulierungsschritt.

**F2: Warum GradientBoosting und nicht Deep Learning?**
A: Die Daten sind tabellarisch (Preis, Lieferzeit, Kategorie, wenige
Hundert Features nach One-Hot-Encoding) — genau die Domäne, in der
Gradient-Boosting-Modelle regelmäßig mit oder besser als neuronale Netze
performen, bei deutlich geringerem Trainings-/Tuning-Aufwand und ohne
GPU. Zusätzlich ist Baummodell + `TreeExplainer` eine exakte, schnelle
SHAP-Berechnung — bei einem Deep-Learning-Modell bräuchte man
approximative SHAP-Verfahren (z.B. `DeepExplainer`/`KernelExplainer`),
die langsamer und weniger exakt sind. Der Kern des Projekts ist
Explainability, nicht rohe Modell-Power — das spricht zusätzlich für ein
einfaches, gut erklärbares Modell.

**F3: Warum SHAP und nicht LIME?**
A: SHAP hat eine spieltheoretisch fundierte Eindeutigkeit (Shapley-
Werte) und mit `TreeExplainer` für Baummodelle eine exakte, schnelle
Implementierung ohne Sampling-Rauschen. LIME approximiert lokal mit einem
linearen Surrogatmodell, dessen Erklärung je nach Sampling leicht
variieren kann. Da hier ohnehin ein Baummodell verwendet wird, ist
`TreeExplainer` der naheliegende, effiziente Weg, exakte Treiber pro
Vorhersage *und* günstig aggregierte globale Feature-Wichtigkeit über
alle ~100k Bestellungen zu bekommen (siehe `run_pipeline.py`).

**F4: Warum React/FastAPI hier, aber z.B. Streamlit bei anderen
Projekten?**
A: Bewusste Entscheidung, um genau die Full-Stack-Lücke (React +
FastAPI getrennt als Frontend/Backend) im Lebenslauf zu schließen, die
bisher nur intern bei ILI.DIGITAL belegt war, aber öffentlich nicht
sichtbar ist (siehe `CLAUDE.md`/Design-Spec). Streamlit ist super für
schnelle Daten-Prototyping-Demos, verschleift aber Frontend und Backend
in einem Prozess — das zeigt nicht dieselbe Fähigkeit, eine typisierte
REST-API und eine unabhängige SPA sauber zu trennen (inkl. CORS, eigenem
Routing, eigenem State-Management).

**F5: Wie verhindert ihr Data Leakage?**
A: Zwei konkrete Stellen: (1) zeitlicher statt zufälliger Train/Test-
Split (`split_temporal` in `pipeline/train_model.py`), damit das Modell
im Test nicht von zukünftigen, saisonal korrelierten Mustern profitiert;
(2) `seller_avg_review_prior` wird pro Verkäufer zeitlich sortiert und
per `shift().expanding().mean()` berechnet, so dass eine Bestellung nie
ihren eigenen oder zukünftigen Review-Wert in ihr eigenes Feature
einfließen lässt.

**F6: Was bedeutet ROC-AUC 0,706 konkret, und ist das gut?**
A: Deutlich besser als Zufall (0,5), aber kein starkes Modell im
klassischen Sinn (oft gilt >0,8 als "gut"). Für die Kernaussage des
Projekts — Explainability-Methodik zeigen, nicht Produktionsreife
beanspruchen — ist das ausreichend, und das wird auch so im README
kommuniziert, nicht schöngeredet.

**F7: Warum ist der Recall so niedrig (0,138)?**
A: Bei Standard-Schwelle 0,5 auf den Modell-Wahrscheinlichkeiten
markiert das Modell nur einen kleinen Teil der tatsächlich schlechten
Reviews als "hoch riskant" — schlechte Reviews sind eine Minderheitsklasse,
und das Modell ist konservativ. Das ist im Code kein Bug, sondern der
unveränderte Standard-Schwellenwert; für ein Frühwarnsystem mit
begrenzten Interventionskapazitäten (nicht jeden Alarm bearbeiten
können) ist hohe Precision oft wichtiger als hoher Recall, aber ein
Produktivsystem würde hier wahrscheinlich Schwellenwert/Klassengewichte
aktiv abstimmen, statt den Default zu nehmen.

**F8: Wie kommt die LLM-Erklärung ins Frontend, ohne dass die Web-App
selbst live einen LLM-API-Key braucht?**
A: Die Erklärung wird einmalig während `pipeline/run_pipeline.py` pro
Bestellung der Stichprobe generiert (`narrate.generate_explanation`) und
als Textspalte `explanation` direkt in den SQLite-Snapshot geschrieben.
Die laufende FastAPI liest diese Spalte nur noch aus der Datenbank
(`GET /orders/{order_id}`) — kein Live-Call zur Laufzeit, das hält die
Web-App simpel, kostengünstig und deploybar ohne Secret.

**F9: Was würdest du als Nächstes verbessern, wenn du mehr Zeit
hättest?**
A: Erstens die Modellgüte: Hyperparameter-Tuning, Klassengewichte oder
eine verschobene Entscheidungsschwelle, um den Recall zu verbessern,
plus ggf. `CalibratedClassifierCV`, falls die Wahrscheinlichkeit selbst
(nicht nur das Ranking) verlässlich sein soll. Zweitens den Live-Deploy
abschließen (Backend auf Render, Frontend auf Vercel — laut `HANDOVER.md`
zum Stand der letzten Session noch offen).

**F10: Ist das Projekt "fertig"?**
A: Funktional ja — alle 15 geplanten Tasks sind umgesetzt, 16 Backend- +
8 Frontend-Tests grün, ein echter Pipeline-Lauf mit echtem LLM-Key
durchgeführt, End-to-End per Playwright im echten Browser verifiziert
(inkl. vier während dieser Verifikation gefundener und gefixter Bugs,
siehe `HANDOVER.md`). Offen war zum Stand der letzten dokumentierten
Session der eigentliche Live-Deploy (Render/Vercel) und das Anlegen des
GitHub-Repos — rein lokal committed bis dahin.

---

## 6. Checkliste — Bist du bereit?

- [ ] Ich kann den Elevator-Pitch (Abschnitt 1) frei sprechen, ohne
      abzulesen.
- [ ] Ich kann den Datenfluss von CSV bis React-Komponente an der
      Architektur-Skizze in Abschnitt 2 nachzeichnen, inkl. konkreter
      Dateinamen.
- [ ] Ich kann erklären, warum der Train/Test-Split zeitlich und nicht
      zufällig ist — und ein konkretes Beispiel nennen, warum ein
      zufälliger Split hier täuschen würde.
- [ ] Ich kann den Unterschied zwischen "SHAP bestimmt die Treiber" und
      "LLM formuliert den Text" klar trennen — SHAP liefert Zahlen, das
      LLM macht daraus keine neue Erkenntnis, sondern nur verständliche
      Sprache.
- [ ] Ich kann ROC-AUC 0,706 und Precision/Recall (0,632/0,138) korrekt
      einordnen, OHNE sie schönzureden oder als "hochkalibriert" zu
      verkaufen (im Code gibt es keinen expliziten
      Kalibrierungsschritt).
- [ ] Ich kann mindestens zwei "Warum X und nicht Y"-Fragen aus
      Abschnitt 5 in eigenen Worten beantworten, nicht nur ablesen.
- [ ] Ich weiß, was zum Stand der letzten Session noch offen war
      (Live-Deploy, GitHub-Repo) und sage das ehrlich, falls gefragt.
- [ ] Ich kann eine konkrete, realistische nächste Verbesserung nennen
      (nicht nur "mehr Daten"), z.B. Schwellenwert-Anpassung oder
      `CalibratedClassifierCV`.
