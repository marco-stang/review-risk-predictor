import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { fetchOrders, OrderSummary } from "../api/client";
import RiskBadge from "../components/RiskBadge";

type SortKey = "order_id" | "category_english" | "risk_score";
type SortDir = "asc" | "desc";

const DEFAULT_SORT_KEY: SortKey = "risk_score";
const DEFAULT_SORT_DIR: SortDir = "desc";

function formatPercent(score: number): string {
  return `${Math.round(score * 100)}%`;
}

export default function OrderList() {
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter/Sortier-Zustand lebt in der URL (statt useState): Ansicht bleibt
  // beim Zurück-Navigieren erhalten und lässt sich als Link teilen.
  const [searchParams, setSearchParams] = useSearchParams();
  const search = searchParams.get("q") ?? "";
  const category = searchParams.get("category") ?? "";
  const riskLevel = searchParams.get("risk_level") ?? "";
  const sortKey = (searchParams.get("sort") as SortKey | null) ?? DEFAULT_SORT_KEY;
  const sortDir = (searchParams.get("dir") as SortDir | null) ?? DEFAULT_SORT_DIR;

  function updateParams(patch: Record<string, string>) {
    const next = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(patch)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    setSearchParams(next, { replace: true });
  }

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchOrders()
      .then(setOrders)
      .catch(() => setError("Bestellungen konnten nicht geladen werden. Backend erreichbar?"))
      .finally(() => setLoading(false));
  }, []);

  const categories = useMemo(
    () => Array.from(new Set(orders.map((o) => o.category_english))).sort(),
    [orders]
  );

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      updateParams({ dir: sortDir === "asc" ? "desc" : "asc" });
    } else {
      updateParams({ sort: key, dir: "desc" });
    }
  }

  function sortIndicator(key: SortKey): string {
    if (key !== sortKey) return "";
    return sortDir === "asc" ? " ▲" : " ▼";
  }

  const visibleOrders = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const filtered = orders.filter((order) => {
      if (needle && !order.order_id.toLowerCase().includes(needle)) return false;
      if (category && order.category_english !== category) return false;
      if (riskLevel && order.risk_level !== riskLevel) return false;
      return true;
    });
    const sorted = [...filtered].sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      if (sortKey === "risk_score") return (a.risk_score - b.risk_score) * dir;
      return a[sortKey].localeCompare(b[sortKey]) * dir;
    });
    return sorted;
  }, [orders, search, category, riskLevel, sortKey, sortDir]);

  return (
    <div>
      <h1>Bestellungen</h1>

      <div className="toolbar">
        <input
          type="search"
          placeholder="Bestellungs-ID suchen…"
          value={search}
          onChange={(e) => updateParams({ q: e.target.value })}
          aria-label="Bestellungs-ID suchen"
        />
        <select
          value={category}
          onChange={(e) => updateParams({ category: e.target.value })}
          aria-label="Nach Kategorie filtern"
        >
          <option value="">Alle Kategorien</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          value={riskLevel}
          onChange={(e) => updateParams({ risk_level: e.target.value })}
          aria-label="Nach Risiko-Level filtern"
        >
          <option value="">Alle Risiko-Level</option>
          <option value="niedrig">niedrig</option>
          <option value="mittel">mittel</option>
          <option value="hoch">hoch</option>
        </select>
      </div>

      {loading && <p role="status">Lädt Bestellungen…</p>}
      {error && <p className="error-banner">{error}</p>}

      {!loading && !error && (
        <>
          <p className="result-count">
            {visibleOrders.length} von {orders.length} Bestellungen
          </p>
          {visibleOrders.length === 0 ? (
            <p className="empty-state">Keine Bestellungen für diese Filter.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>
                    <button className="sort-button" onClick={() => toggleSort("order_id")}>
                      Bestellung{sortIndicator("order_id")}
                    </button>
                  </th>
                  <th>
                    <button className="sort-button" onClick={() => toggleSort("category_english")}>
                      Kategorie{sortIndicator("category_english")}
                    </button>
                  </th>
                  <th>
                    <button className="sort-button" onClick={() => toggleSort("risk_score")}>
                      Risiko-Score{sortIndicator("risk_score")}
                    </button>
                  </th>
                  <th>Risiko-Level</th>
                </tr>
              </thead>
              <tbody>
                {visibleOrders.map((order) => (
                  <tr key={order.order_id}>
                    <td>
                      <Link to={`/orders/${order.order_id}`}>{order.order_id}</Link>
                    </td>
                    <td>{order.category_english}</td>
                    <td>{formatPercent(order.risk_score)}</td>
                    <td>
                      <RiskBadge riskLevel={order.risk_level} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  );
}
