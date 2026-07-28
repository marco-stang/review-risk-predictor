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
