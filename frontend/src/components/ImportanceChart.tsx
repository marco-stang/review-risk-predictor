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
