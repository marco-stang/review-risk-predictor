def test_feature_importance_sorted_desc(client):
    response = client.get("/insights/feature-importance")
    assert response.status_code == 200
    data = response.json()
    assert data[0]["feature"] == "delivery_delta_days"
    assert data[0]["mean_abs_shap"] == 0.28
