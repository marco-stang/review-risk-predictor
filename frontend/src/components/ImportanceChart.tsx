import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { FeatureImportanceItem } from "../api/client";

interface ImportanceChartProps {
  items: FeatureImportanceItem[];
}

export default function ImportanceChart({ items }: ImportanceChartProps) {
  const data = [...items]
    .sort((a, b) => b.mean_abs_shap - a.mean_abs_shap)
    .map((i) => ({ name: i.feature, wert: i.mean_abs_shap }));
  return (
    <ResponsiveContainer width="100%" height={400}>
      <BarChart data={data} layout="vertical">
        <XAxis type="number" />
        <YAxis type="category" dataKey="name" width={200} />
        <Tooltip formatter={(value: number) => [value.toFixed(3), "Ø |SHAP|"]} labelFormatter={(name) => name} />
        <Bar dataKey="wert" fill="#a78bfa" />
      </BarChart>
    </ResponsiveContainer>
  );
}
