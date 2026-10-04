"""
Aggregates every ORM model so that:

1. `Base.metadata` is fully populated (required by Alembic's env.py and by
   `Base.metadata.create_all()` in the test suite's in-memory SQLite fixture).
2. String-based relationship() references (e.g. "Incident", "User") used
   throughout the model modules resolve correctly, since SQLAlchemy's
   mapper configuration step requires all referenced classes to have been
   imported at least once before any query is executed.

Always import model classes from this package (`app.models`) rather than
their individual submodules, to guarantee this registration has happened.
"""
from app.models.base import Base
from app.models.user import User, UserRole
from app.models.asset import Asset, AssetCriticality
from app.models.event import Event
from app.models.rule import Rule
from app.models.detection import CorrelationGroup, Detection, DetectionType
from app.models.anomaly import AnomalyResult
from app.models.incident import Incident, IncidentStatus, incident_detections, incident_events
from app.models.indicator import Indicator, IndicatorType
from app.models.response_action import ResponseAction, ResponseActionStatus, ResponseActionType
from app.models.audit_log import AuditLog

__all__ = [
    "Base",
    "User",
    "UserRole",
    "Asset",
    "AssetCriticality",
    "Event",
    "Rule",
    "CorrelationGroup",
    "Detection",
    "DetectionType",
    "AnomalyResult",
    "Incident",
    "IncidentStatus",
    "incident_events",
    "incident_detections",
    "Indicator",
    "IndicatorType",
    "ResponseAction",
    "ResponseActionType",
    "ResponseActionStatus",
    "AuditLog",
]