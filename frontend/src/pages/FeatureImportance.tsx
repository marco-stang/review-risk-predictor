import { useEffect, useState } from "react";
import { fetchFeatureImportance, FeatureImportanceItem } from "../api/client";
import ImportanceChart from "../components/ImportanceChart";

export default function FeatureImportance() {
  const [items, setItems] = useState<FeatureImportanceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchFeatureImportance()
      .then(setItems)
      .catch(() => setError("Feature-Wichtigkeit konnte nicht geladen werden."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <h1>Globale Feature-Wichtigkeit</h1>
      <p className="chart-hint">
        Durchschnittlicher absoluter SHAP-Beitrag jedes Merkmals über alle Bestellungen im
        Snapshot — je weiter oben, desto stärker beeinflusst dieses Merkmal die Risiko-Vorhersage
        im Schnitt. Das sagt nichts über die Richtung aus (erhöht oder senkt Risiko), nur über den
        Einfluss insgesamt.
      </p>

      {loading && <p role="status">Lädt Feature-Wichtigkeit…</p>}
      {error && <p className="error-banner">{error}</p>}
      {!loading && !error && <ImportanceChart items={items} />}
    </div>
  );
}
