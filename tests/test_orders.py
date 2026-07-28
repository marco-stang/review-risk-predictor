def test_list_orders_returns_seeded_row(client):
    response = client.get("/orders")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["order_id"] == "order-1"
    assert data[0]["risk_level"] == "hoch"


def test_list_orders_filters_by_risk_level(client):
    response = client.get("/orders", params={"risk_level": "niedrig"})
    assert response.status_code == 200
    assert response.json() == []


def test_get_order_detail_returns_drivers_and_explanation(client):
    response = client.get("/orders/order-1")
    assert response.status_code == 200
    data = response.json()
    assert data["explanation"] == "Hohes Risiko wegen später Lieferung."
    assert data["drivers"][0]["feature"] == "delivery_delta_days"


def test_get_order_detail_404_for_unknown_id(client):
    response = client.get("/orders/does-not-exist")
    assert response.status_code == 404
