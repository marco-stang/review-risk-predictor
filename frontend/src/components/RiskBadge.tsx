interface RiskBadgeProps {
  riskLevel: "niedrig" | "mittel" | "hoch";
}

const COLORS: Record<RiskBadgeProps["riskLevel"], string> = {
  niedrig: "#2e7d32",
  mittel: "#f9a825",
  hoch: "#c62828",
};

export default function RiskBadge({ riskLevel }: RiskBadgeProps) {
  return (
    <span
      style={{
        backgroundColor: COLORS[riskLevel],
        color: "white",
        padding: "2px 8px",
        borderRadius: "4px",
        fontSize: "0.85rem",
      }}
    >
      {riskLevel}
    </span>
  );
}
