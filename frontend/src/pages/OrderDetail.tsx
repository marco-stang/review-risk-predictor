import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { fetchOrderDetail, OrderDetail as OrderDetailType } from "../api/client";
import DriverChart from "../components/DriverChart";
import RiskBadge from "../components/RiskBadge";

export default function OrderDetail() {
  const { orderId } = useParams<{ orderId: string }>();
  const [order, setOrder] = useState<OrderDetailType | null>(null);

  useEffect(() => {
    if (orderId) fetchOrderDetail(orderId).then(setOrder);
  }, [orderId]);

  if (!order) return <p>Lädt…</p>;

  return (
    <div>
      <h1>Bestellung {order.order_id}</h1>
      <RiskBadge riskLevel={order.risk_level} />
      <p>{order.explanation}</p>
      <DriverChart drivers={order.drivers} />
    </div>
  );
}
