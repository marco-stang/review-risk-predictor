import numpy as np
import pandas as pd

from pipeline.explain import top_features


def test_top_features_sorts_by_absolute_shap_value():
    shap_row = np.array([0.1, -0.5, 0.05, 0.3])
    feature_row = pd.Series({"a": 10, "b": 20, "c": 30, "d": 40})
    feature_columns = ["a", "b", "c", "d"]

    result = top_features(shap_row, feature_row, feature_columns, n=2)

    assert [r["feature"] for r in result] == ["b", "d"]
    assert result[0]["shap_value"] == -0.5
    assert result[0]["feature_value"] == 20
