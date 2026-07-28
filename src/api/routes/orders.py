from fastapi import APIRouter, Depends, Query

from src.api.db import get_db
from src.api.schemas import OrderSummary

router = APIRouter()


@router.get("/orders", response_model=list[OrderSummary])
def list_orders(
    category: str | None = Query(default=None),
    risk_level: str | None = Query(default=None),
    conn=Depends(get_db),
):
    query = "SELECT order_id, category_english, risk_score, risk_level FROM orders WHERE 1=1"
    params: list = []
    if category:
        query += " AND category_english = ?"
        params.append(category)
    if risk_level:
        query += " AND risk_level = ?"
        params.append(risk_level)
    rows = conn.execute(query, params).fetchall()
    return [OrderSummary(**dict(row)) for row in rows]
