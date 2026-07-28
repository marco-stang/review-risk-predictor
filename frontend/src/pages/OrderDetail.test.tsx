import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, it, expect, vi } from "vitest";
import OrderDetail from "./OrderDetail";
import * as apiClient from "../api/client";

describe("OrderDetail", () => {
  it("lädt und zeigt Erklärung + Risiko-Badge", async () => {
    vi.spyOn(apiClient, "fetchOrderDetail").mockResolvedValue({
      order_id: "o1",
      category_english: "toys",
      risk_score: 0.8,
      risk_level: "hoch",
      drivers: [{ feature: "delivery_delta_days", shap_value: 0.3, feature_value: 5 }],
      explanation: "Hohes Risiko wegen später Lieferung.",
    });

    render(
      <MemoryRouter initialEntries={["/orders/o1"]}>
        <Routes>
          <Route path="/orders/:orderId" element={<OrderDetail />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText("Hohes Risiko wegen später Lieferung.")).toBeInTheDocument());
    expect(screen.getByText("hoch")).toBeInTheDocument();
  });
});
