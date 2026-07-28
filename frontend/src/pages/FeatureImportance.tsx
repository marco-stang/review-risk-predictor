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
