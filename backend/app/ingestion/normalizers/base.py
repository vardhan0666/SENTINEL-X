"""
Shared interface for source-specific normalizers.

Each concrete normalizer converts a raw, source-specific payload (arbitrary
field names/shapes, as a real log source would emit) into the canonical
EventIngest schema used everywhere downstream (detection, correlation,
risk scoring, ML).
"""
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from typing import Any

from app.schemas.event import EventIngest


class BaseNormalizer(ABC):
    source_name: str

    @abstractmethod
    def normalize(self, raw_event: dict[str, Any]) -> EventIngest:
        """Convert a raw source-specific payload into a canonical EventIngest."""
        raise NotImplementedError

    @staticmethod
    def _require(raw_event: dict[str, Any], key: str) -> Any:
        value = raw_event.get(key)
        if value in (None, ""):
            raise ValueError(f"Missing required field '{key}' in raw event payload.")
        return value

    @staticmethod
    def _parse_timestamp(value: Any) -> datetime:
        if isinstance(value, datetime):
            return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
        if isinstance(value, str):
            normalized = value.replace("Z", "+00:00")
            try:
                parsed = datetime.fromisoformat(normalized)
            except ValueError as exc:
                raise ValueError(f"Could not parse timestamp value '{value}'.") from exc
            return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
        raise ValueError(f"Unsupported timestamp type: {type(value)!r}")