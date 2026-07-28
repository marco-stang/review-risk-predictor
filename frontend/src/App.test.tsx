import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi } from "vitest";
import App from "./App";
import * as apiClient from "./api/client";

describe("App-Routing", () => {
  it("zeigt die Insights-Seite bei /insights", async () => {
    vi.spyOn(apiClient, "fetchFeatureImportance").mockResolvedValue([]);

    render(
      <MemoryRouter initialEntries={["/insights"]}>
        <App />
      </MemoryRouter>
    );

    expect(await screen.findByText("Globale Feature-Wichtigkeit")).toBeInTheDocument();
  });
});
