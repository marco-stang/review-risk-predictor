/**
 * Kopf- und Fussbereich nach dem Demo-Styleguide des Portfolios.
 *
 * React-Gegenstueck zu portfolio_ui.py in den Streamlit-Demos: gleicher Aufbau,
 * gleiche Texte, gleicher Ruecklink. Die lokale Projekt-ID (nicht der
 * GitHub-Repo-Name) ist noetig, weil nur sie der Deep-Link-Router in
 * marco-os/assets/js/router.js aufloest.
 */

const PORTFOLIO_URL = "https://maggostang-droid.github.io/marco-os/";
const PROJECT_ID = "ai-analytics-portal";
const REPO = "review-risk-predictor";

export function PortfolioHeader() {
  return (
    <header className="portfolio-header">
      <h1>Review Risk Predictor</h1>
      <p>
        Sagt für jede Bestellung das Risiko einer schlechten Bewertung voraus und erklärt in
        einem Satz warum: ein erklärbarer ML-Klassifikator entscheidet, das LLM übersetzt nur
        die SHAP-Treiber in Klartext.
      </p>
      <a
        className="back"
        href={`${PORTFOLIO_URL}#${PROJECT_ID}`}
        target="_blank"
        rel="noopener noreferrer"
      >
        ▸ Teil von MARCO.OS <span>· Portfolio von Marco Stang</span>
      </a>
    </header>
  );
}

export function PortfolioFooter() {
  return (
    <footer className="portfolio-footer">
      <div>
        <strong>Was diese Demo nicht ist:</strong> keine produktionsreife Vorhersagegüte
        (Recall 0,138) · Snapshot mit rund 500 statt 100.000 Bestellungen · Erklärungen sind
        vorberechnet, kein LLM-Aufruf zur Laufzeit · kein Auth · das Backend läuft auf einem
        Free Tier und schläft nach Inaktivität ein
      </div>
      <div>
        <a href={`https://github.com/maggostang-droid/${REPO}`} target="_blank" rel="noopener noreferrer">
          Quellcode auf GitHub
        </a>{" "}
        ·{" "}
        <a href={`${PORTFOLIO_URL}#${PROJECT_ID}`} target="_blank" rel="noopener noreferrer">
          Dieses Projekt in MARCO.OS
        </a>
      </div>
      <div>
        Marco Stang · Dr.-Ing. ·{" "}
        <a href="https://www.linkedin.com/in/marco-stang" target="_blank" rel="noopener noreferrer">
          LinkedIn
        </a>{" "}
        · stang.marco@t-online.de
      </div>
    </footer>
  );
}
