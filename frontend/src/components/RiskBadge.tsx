interface RiskBadgeProps {
  riskLevel: "niedrig" | "mittel" | "hoch";
}

export default function RiskBadge({ riskLevel }: RiskBadgeProps) {
  return <span className={`risk-badge risk-badge--${riskLevel}`}>{riskLevel}</span>;
}
