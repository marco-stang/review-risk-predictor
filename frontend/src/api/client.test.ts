import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchOrders } from "./client";

describe("fetchOrders", () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn();
  });

  it("baut Query-Parameter korrekt und gibt die JSON-Antwort zurück", async () => {
    const mockOrders = [
      { order_id: "o1", category_english: "toys", risk_score: 0.8, risk_level: "hoch" },
    ];
    (globalThis.fetch as any).mockResolvedValue({ ok: true, json: async () => mockOrders });

    const result = await fetchOrders({ riskLevel: "hoch" });

    expect(globalThis.fetch).toHaveBeenCalledWith(expect.stringContaining("/orders?risk_level=hoch"));
    expect(result).toEqual(mockOrders);
  });

  it("wirft einen Fehler bei einer nicht-ok Antwort", async () => {
    (globalThis.fetch as any).mockResolvedValue({ ok: false, status: 500 });
    await expect(fetchOrders()).rejects.toThrow("API-Fehler 500");
  });
});
