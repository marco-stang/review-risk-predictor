import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { DriverItem } from "../api/client";

interface DriverChartProps {
  drivers: DriverItem[];
}

export default function DriverChart({ drivers }: DriverChartProps) {
  const data = drivers.map((d) => ({ name: d.feature, wert: d.shap_value }));
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} layout="vertical">
        <XAxis type="number" />
        <YAxis type="category" dataKey="name" width={180} />
        <Tooltip />
        <Bar dataKey="wert" fill="#a78bfa" />
      </BarChart>
    </ResponsiveContainer>
  );
}
