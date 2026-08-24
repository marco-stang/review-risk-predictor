import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi } from "vitest";
import OrderList from "./OrderList";
import * as apiClient from "../api/client";

const SAMPLE_ORDERS: apiClient.OrderSummary[] = [
  { order_id: "o1", category_english: "toys", risk_score: 0.8, risk_level: "hoch" },
  { order_id: "o2", category_english: "books", risk_score: 0.2, risk_level: "niedrig" },
];

describe("OrderList", () => {
  it("zeigt die geladenen Bestellungen in einer Tabelle an", async () => {
    vi.spyOn(apiClient, "fetchOrders").mockResolvedValue(SAMPLE_ORDERS);

    render(
      <MemoryRouter>
        <OrderList />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText("o1")).toBeInTheDocument());
    // Auf die Zeile eingrenzen, nicht die ganze Seite durchsuchen: die
    // Filter-Dropdown hat selbst eine Option "hoch", die sonst als zweiter
    // Treffer mitgezählt würde (getByText schlägt bei mehreren Treffern fehl).
    const row = screen.getByRole("row", { name: /o1/ });
    expect(within(row).getByText("hoch")).toBeInTheDocument();
  });

  it("zeigt die Anzahl der Treffer an", async () => {
    vi.spyOn(apiClient, "fetchOrders").mockResolvedValue(SAMPLE_ORDERS);

    render(
      <MemoryRouter>
        <OrderList />
      </MemoryRouter>
    );

    expect(await screen.findByText("2 von 2 Bestellungen")).toBeInTheDocument();
  });

  it("filtert nach Bestellungs-ID über das Suchfeld", async () => {
    vi.spyOn(apiClient, "fetchOrders").mockResolvedValue(SAMPLE_ORDERS);

    render(
      <MemoryRouter>
        <OrderList />
      </MemoryRouter>
    );

    await screen.findByText("o1");
    fireEvent.change(screen.getByLabelText("Bestellungs-ID suchen"), { target: { value: "o2" } });

    expect(screen.queryByText("o1")).not.toBeInTheDocument();
    expect(screen.getByText("o2")).toBeInTheDocument();
  });

  it("zeigt einen Leer-Zustand, wenn kein Ergebnis zu den Filtern passt", async () => {
    vi.spyOn(apiClient, "fetchOrders").mockResolvedValue(SAMPLE_ORDERS);

    render(
      <MemoryRouter>
        <OrderList />
      </MemoryRouter>
    );

    await screen.findByText("o1");
    fireEvent.change(screen.getByLabelText("Bestellungs-ID suchen"), {
      target: { value: "nichtvorhanden" },
    });

    expect(screen.getByText("Keine Bestellungen für diese Filter.")).toBeInTheDocument();
  });

  it("zeigt eine Fehlermeldung, wenn das Laden fehlschlägt", async () => {
    vi.spyOn(apiClient, "fetchOrders").mockRejectedValue(new Error("API-Fehler 500"));

    render(
      <MemoryRouter>
        <OrderList />
      </MemoryRouter>
    );

    expect(
      await screen.findByText("Bestellungen konnten nicht geladen werden. Backend erreichbar?")
    ).toBeInTheDocument();
  });
});
