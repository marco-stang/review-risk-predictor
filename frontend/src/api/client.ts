const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

export interface OrderSummary {
  order_id: string;
  category_english: string;
  risk_score: number;
  risk_level: "niedrig" | "mittel" | "hoch";
}

export interface DriverItem {
  feature: string;
  shap_value: number;
  feature_value: number;
}

export interface OrderDetail extends OrderSummary {
  drivers: DriverItem[];
  explanation: string;
}

export interface FeatureImportanceItem {
  feature: string;
  mean_abs_shap: number;
}

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`);
  if (!response.ok) {
    throw new Error(`API-Fehler ${response.status} bei ${path}`);
  }
  return response.json() as Promise<T>;
}

export function fetchOrders(filters?: { category?: string; riskLevel?: string }): Promise<OrderSummary[]> {
  const params = new URLSearchParams();
  if (filters?.category) params.set("category", filters.category);
  if (filters?.riskLevel) params.set("risk_level", filters.riskLevel);
  const query = params.toString() ? `?${params.toString()}` : "";
  return fetchJson<OrderSummary[]>(`/orders${query}`);
}

export function fetchOrderDetail(orderId: string): Promise<OrderDetail> {
  return fetchJson<OrderDetail>(`/orders/${orderId}`);
}

export function fetchFeatureImportance(): Promise<FeatureImportanceItem[]> {
  return fetchJson<FeatureImportanceItem[]>("/insights/feature-importance");
}
