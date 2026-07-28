import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import ImportanceChart from "./ImportanceChart";

describe("ImportanceChart", () => {
  it("rendert ohne Fehler mit Feature-Wichtigkeits-Daten", () => {
    const { container } = render(
      <ImportanceChart items={[{ feature: "delivery_delta_days", mean_abs_shap: 0.28 }]} />
    );
    expect(container.querySelector("svg")).toBeInTheDocument();
  });
});
