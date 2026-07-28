from fastapi import APIRouter, Depends

from src.api.db import get_db
from src.api.schemas import FeatureImportanceItem

router = APIRouter()


@router.get("/insights/feature-importance", response_model=list[FeatureImportanceItem])
def feature_importance(conn=Depends(get_db)):
    rows = conn.execute(
        "SELECT feature, mean_abs_shap FROM feature_importance ORDER BY mean_abs_shap DESC"
    ).fetchall()
    return [FeatureImportanceItem(**dict(row)) for row in rows]
