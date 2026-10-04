"""
ML anomaly detection status, retrieval, and control API.

GET  /ml/status    — model load state, version, feature definition
                      (any authenticated user)
GET  /ml/anomalies — paginated, filterable ML anomaly results
POST /ml/evaluate  — manually trigger anomaly evaluation for a given
                      entity (ADMIN/ANALYST) — useful before Batch 10's
                      automatic pipeline wiring lands, and afterward for
                      ad-hoc investigation
POST /ml/retrain   — retrain the Isolation Forest model (ADMIN only)
"""
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import CurrentUser, require_role
from app.ml.anomaly_service import evaluate_entity_anomaly
from app.ml.feature_extraction import FEATURE_NAMES
from app.ml.model_registry import registry
from app.ml.train import train_and_save_model
from app.models.anomaly import AnomalyResult
from app.models.user import UserRole
from app.schemas.anomaly import AnomalyResultRead
from app.schemas.common import PaginatedResponse

router = APIRouter(prefix="/ml", tags=["ml"])

_VALID_ENTITY_TYPES = {"SOURCE_IP", "USERNAME", "HOSTNAME"}


@router.get("/status")
async def ml_status(current_user: CurrentUser) -> dict:
    model = registry.get_model()
    return {
        "model_loaded": model is not None and model.is_fitted,
        "model_version": registry.model_version,
        "feature_names": FEATURE_NAMES,
        "note": (
            "ML anomaly scores are statistical signals, not confirmed threats. "
            "They are always labeled distinctly (detection_type=ML_ANOMALY) from "
            "rule-based detections."
        ),
    }


@router.get("/anomalies", response_model=PaginatedResponse[AnomalyResultRead])
async def list_anomalies(
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
    entity_type: Optional[str] = None,
    entity_value: Optional[str] = None,
    is_anomalous: Optional[bool] = None,
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
) -> PaginatedResponse[AnomalyResultRead]:
    filters = []
    if entity_type:
        filters.append(AnomalyResult.entity_type == entity_type.upper())
    if entity_value:
        filters.append(AnomalyResult.entity_value == entity_value)
    if is_anomalous is not None:
        filters.append(AnomalyResult.is_anomalous == is_anomalous)

    count_query = select(func.count()).select_from(AnomalyResult)
    for condition in filters:
        count_query = count_query.where(condition)
    total = (await db.execute(count_query)).scalar_one()

    query = select(AnomalyResult).order_by(AnomalyResult.computed_at.desc()).limit(limit).offset(offset)
    for condition in filters:
        query = query.where(condition)
    anomalies = (await db.execute(query)).scalars().all()

    return PaginatedResponse(items=list(anomalies), total=total, limit=limit, offset=offset)


@router.post("/evaluate", response_model=list[AnomalyResultRead], status_code=status.HTTP_201_CREATED)
async def evaluate_anomaly(
    entity_type: str,
    entity_value: str,
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_role(UserRole.ADMIN, UserRole.ANALYST)),
) -> list[AnomalyResult]:
    normalized_type = entity_type.upper()
    if normalized_type not in _VALID_ENTITY_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"entity_type must be one of {sorted(_VALID_ENTITY_TYPES)}.",
        )

    return await evaluate_entity_anomaly(
        db, normalized_type, entity_value, window_end=datetime.now(timezone.utc)
    )


@router.post("/retrain")
async def retrain_model(_: object = Depends(require_role(UserRole.ADMIN))) -> dict:
    version = await train_and_save_model()
    return {"message": "Model retrained successfully.", "model_version": version}