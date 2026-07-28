import json

from fastapi import APIRouter, Depends, HTTPException, Query

from src.api.db import get_db
from src.api.schemas import DriverItem, OrderDetail, OrderSummary

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


@router.get("/orders/{order_id}", response_model=OrderDetail)
def get_order(order_id: str, conn=Depends(get_db)):
    row = conn.execute("SELECT * FROM orders WHERE order_id = ?", (order_id,)).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Bestellung nicht gefunden")

    data = dict(row)
    drivers = [DriverItem(**d) for d in json.loads(data["shap_drivers_json"])]
    return OrderDetail(
        order_id=data["order_id"],
        category_english=data["category_english"],
        risk_score=data["risk_score"],
        risk_level=data["risk_level"],
        drivers=drivers,
        explanation=data["explanation"],
    )
