"""
Shared detection rule interface, result contract, and windowed query
context used by every concrete rule in app/detection/*.

Design notes:
- Rules are stateless classes. All "memory" of prior activity comes from
  querying the `events` table within a time window via DetectionContext,
  rather than in-process state — this keeps detection deterministic,
  restart-safe, and independently testable (see backend/tests/test_detection_rules.py,
  added in Batch 12).
- Every DetectionResult must carry a human-readable `reason` containing
  the actual numbers involved (per the project's explainability
  requirement), plus `evidence` — a JSON-serializable dict of contributing
  event IDs and supporting values. By convention, evidence also carries a
  `recommended_action` key; this is how recommended actions are surfaced
  even though the `detections` table (see app/models/detection.py) has no
  dedicated column for it — evidence is a flexible JSON blob for exactly
  this kind of explainability payload.
"""
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import timedelta
from typing import Any, Optional

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.event import Event


@dataclass
class DetectionResult:
    rule_key: str
    title: str
    category: str
    severity: str
    confidence: float
    reason: str
    evidence: dict[str, Any] = field(default_factory=dict)
    source_ip: Optional[str] = None
    username: Optional[str] = None
    hostname: Optional[str] = None


class DetectionContext:
    """
    Provides windowed database lookups scoped relative to the event
    currently being evaluated, so rules reason only about data, not query
    mechanics. All windows look backward from `event.timestamp` (i.e. "in
    the last N seconds up to and including this event"), which matches how
    a streaming/batch detection system observes activity as it occurs.
    """

    _FILTERABLE_FIELDS = {
        "source_ip": Event.source_ip,
        "destination_ip": Event.destination_ip,
        "username": Event.username,
        "hostname": Event.hostname,
        "event_type": Event.event_type,
        "category": Event.category,
        "process_name": Event.process_name,
        "status": Event.status,
        "protocol": Event.protocol,
        "destination_port": Event.destination_port,
    }

    def __init__(self, db: AsyncSession, config: dict[str, Any]):
        self.db = db
        self.config = config

    def _window_bounds(self, event: Event, window_seconds: int):
        end = event.timestamp
        start = end - timedelta(seconds=window_seconds)
        return start, end

    def _resolve_column(self, field_name: str):
        column = self._FILTERABLE_FIELDS.get(field_name)
        if column is None:
            raise ValueError(
                f"Unsupported filter field '{field_name}'. "
                f"Allowed fields: {sorted(self._FILTERABLE_FIELDS.keys())}"
            )
        return column

    def _build_query(self, event: Event, window_seconds: int, filters: dict[str, Any]):
        start, end = self._window_bounds(event, window_seconds)
        query = select(Event).where(Event.timestamp >= start, Event.timestamp <= end)
        for field_name, value in filters.items():
            query = query.where(self._resolve_column(field_name) == value)
        return query

    async def count_events(self, event: Event, window_seconds: int, filters: dict[str, Any]) -> int:
        """Count events matching `filters` within the trailing window."""
        subquery = self._build_query(event, window_seconds, filters).subquery()
        result = await self.db.execute(select(func.count()).select_from(subquery))
        return result.scalar_one()

    async def get_recent_events(
        self, event: Event, window_seconds: int, filters: dict[str, Any], limit: int = 50
    ) -> list[Event]:
        """Return up to `limit` matching events within the trailing window, most recent first."""
        query = self._build_query(event, window_seconds, filters).order_by(Event.timestamp.desc()).limit(limit)
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def count_distinct(
        self, event: Event, window_seconds: int, filters: dict[str, Any], distinct_field: str
    ) -> int:
        """Count distinct values of `distinct_field` among matching events within the trailing window."""
        distinct_column = self._resolve_column(distinct_field)
        start, end = self._window_bounds(event, window_seconds)
        query = select(func.count(func.distinct(distinct_column))).where(
            Event.timestamp >= start, Event.timestamp <= end
        )
        for field_name, value in filters.items():
            query = query.where(self._resolve_column(field_name) == value)
        result = await self.db.execute(query)
        return result.scalar_one()


class BaseDetectionRule(ABC):
    """
    Shared interface every detection rule must implement.

    Class attributes double as the source of truth for rule metadata used
    when seeding the `rules` table (see database/seed/seed_rules.py) — the
    registry does not duplicate this information elsewhere.
    """

    rule_key: str
    category: str
    name: str
    description: str
    default_severity: str = "medium"
    default_threshold_config: dict[str, Any] = {}

    @abstractmethod
    async def evaluate(self, event: Event, context: DetectionContext) -> Optional[DetectionResult]:
        """
        Evaluate this rule against a single event.

        Returns a DetectionResult if the rule fires, or None otherwise.
        Must never raise for "no match" — only for genuine errors (which
        the caller, app.detection.detection_service, logs and skips so one
        failing rule cannot block evaluation of the others).
        """
        raise NotImplementedError