import { render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi } from "vitest";
import OrderList from "./OrderList";
import * as apiClient from "../api/client";

describe("OrderList", () => {
  it("zeigt die geladenen Bestellungen an", async () => {
    vi.spyOn(apiClient, "fetchOrders").mockResolvedValue([
      { order_id: "o1", category_english: "toys", risk_score: 0.8, risk_level: "hoch" },
    ]);

    render(
      <MemoryRouter>
        <OrderList />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText("o1")).toBeInTheDocument());
    // Auf das Listenelement eingrenzen, nicht die ganze Seite durchsuchen:
    // die Filter-Dropdown hat selbst eine Option "hoch", die sonst als
    // zweiter Treffer mitgezählt würde (getByText schlägt bei mehreren
    // Treffern fehl).
    const listItem = screen.getByRole("listitem");
    expect(within(listItem).getByText("hoch")).toBeInTheDocument();
  });
});
