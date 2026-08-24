import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { DriverItem } from "../api/client";

interface DriverChartProps {
  drivers: DriverItem[];
}

const INCREASES_RISK = "#f87171";
const DECREASES_RISK = "#4ade80";

function formatTooltipValue(value: number): string {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(3)}`;
}

export default function DriverChart({ drivers }: DriverChartProps) {
  const data = drivers.map((d) => ({
    name: d.feature,
    shap: d.shap_value,
    featureValue: d.feature_value,
  }));
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} layout="vertical">
        <XAxis type="number" />
        <YAxis type="category" dataKey="name" width={180} />
        <Tooltip
          formatter={(value: number) => [formatTooltipValue(value), "SHAP-Beitrag"]}
          labelFormatter={(name) => name}
        />
        <Bar dataKey="shap">
          {data.map((entry) => (
            <Cell key={entry.name} fill={entry.shap >= 0 ? INCREASES_RISK : DECREASES_RISK} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
