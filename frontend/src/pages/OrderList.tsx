import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchOrders, OrderSummary } from "../api/client";
import RiskBadge from "../components/RiskBadge";

export default function OrderList() {
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [riskLevel, setRiskLevel] = useState<string>("");

  useEffect(() => {
    fetchOrders(riskLevel ? { riskLevel } : undefined).then(setOrders);
  }, [riskLevel]);

  return (
    <div>
      <h1>Bestellungen</h1>
      <select value={riskLevel} onChange={(e) => setRiskLevel(e.target.value)}>
        <option value="">Alle Risiko-Level</option>
        <option value="niedrig">niedrig</option>
        <option value="mittel">mittel</option>
        <option value="hoch">hoch</option>
      </select>
      <ul>
        {orders.map((order) => (
          <li key={order.order_id}>
            <Link to={`/orders/${order.order_id}`}>{order.order_id}</Link>{" "}
            ({order.category_english}) <RiskBadge riskLevel={order.risk_level} />
          </li>
        ))}
      </ul>
    </div>
  );
}
