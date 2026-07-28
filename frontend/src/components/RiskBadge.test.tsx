import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import RiskBadge from "./RiskBadge";

describe("RiskBadge", () => {
  it("zeigt den Risiko-Level als Text", () => {
    render(<RiskBadge riskLevel="hoch" />);
    expect(screen.getByText("hoch")).toBeInTheDocument();
  });
});
