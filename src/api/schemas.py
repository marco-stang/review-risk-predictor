from pydantic import BaseModel


class OrderSummary(BaseModel):
    order_id: str
    category_english: str
    risk_score: float
    risk_level: str


class DriverItem(BaseModel):
    feature: str
    shap_value: float
    feature_value: float


class OrderDetail(OrderSummary):
    drivers: list[DriverItem]
    explanation: str


class FeatureImportanceItem(BaseModel):
    feature: str
    mean_abs_shap: float
