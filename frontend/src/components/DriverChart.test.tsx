import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import DriverChart from "./DriverChart";

describe("DriverChart", () => {
  it("rendert ohne Fehler mit Treiber-Daten", () => {
    const { container } = render(
      <DriverChart drivers={[{ feature: "delivery_delta_days", shap_value: 0.3, feature_value: 5 }]} />
    );
    expect(container.querySelector("svg")).toBeInTheDocument();
  });
});
