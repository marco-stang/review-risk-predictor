import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { fetchOrderDetail, OrderDetail as OrderDetailType } from "../api/client";
import DriverChart from "../components/DriverChart";
import RiskBadge from "../components/RiskBadge";

export default function OrderDetail() {
  const { orderId } = useParams<{ orderId: string }>();
  const [order, setOrder] = useState<OrderDetailType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!orderId) return;
    setLoading(true);
    setError(null);
    fetchOrderDetail(orderId)
      .then(setOrder)
      .catch(() => setError(`Bestellung ${orderId} konnte nicht geladen werden.`))
      .finally(() => setLoading(false));
  }, [orderId]);

  return (
    <div>
      <Link to="/" className="back-link">
        ← Zurück zur Liste
      </Link>

      {loading && <p role="status">Lädt Bestellung…</p>}
      {error && <p className="error-banner">{error}</p>}

      {!loading && !error && order && (
        <>
          <h1>Bestellung {order.order_id}</h1>
          <div className="detail-meta">
            <span>{order.category_english}</span>
            <span className="risk-score">Risiko-Score: {Math.round(order.risk_score * 100)}%</span>
            <RiskBadge riskLevel={order.risk_level} />
          </div>

          <h2>Warum dieses Risiko?</h2>
          <p className="explanation">{order.explanation}</p>

          <h2>Wichtigste Treiber</h2>
          <p className="chart-hint">
            Balken nach rechts erhöhen das vorhergesagte Risiko, Balken nach links senken es.
          </p>
          <DriverChart drivers={order.drivers} />
        </>
      )}
    </div>
  );
}
