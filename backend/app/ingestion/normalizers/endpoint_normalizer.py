"""
Normalizer for endpoint telemetry (process execution and file activity)
into the canonical schema.

Expected raw fields:
    event_id, timestamp, hostname, action
    (action: "process_start" | "process_stop" | "file_create" |
             "file_modify" | "file_delete", or another endpoint action),
    optional: process_name, pid, parent_process, username
"""
from typing import Any

from app.ingestion.normalizers.base import BaseNormalizer
from app.schemas.event import EventIngest

_PROCESS_ACTIONS = {"process_start", "process_stop"}
_FILE_ACTIONS = {"file_create", "file_modify", "file_delete"}


class EndpointNormalizer(BaseNormalizer):
    source_name = "endpoint"

    def normalize(self, raw_event: dict[str, Any]) -> EventIngest:
        event_id = self._require(raw_event, "event_id")
        timestamp = self._parse_timestamp(self._require(raw_event, "timestamp"))
        hostname = self._require(raw_event, "hostname")
        action = self._require(raw_event, "action")

        if action in _PROCESS_ACTIONS:
            category = "process"
        elif action in _FILE_ACTIONS:
            category = "file"
        else:
            category = "endpoint"

        metadata: dict[str, Any] = {}
        if raw_event.get("pid") is not None:
            metadata["pid"] = raw_event["pid"]
        if raw_event.get("parent_process"):
            metadata["parent_process"] = raw_event["parent_process"]

        process_name = raw_event.get("process_name")

        return EventIngest(
            event_id=str(event_id),
            timestamp=timestamp,
            source=self.source_name,
            category=category,
            event_type=action,
            severity=raw_event.get("severity") or "low",
            hostname=hostname,
            username=raw_event.get("username"),
            process_name=process_name,
            action=action,
            status="observed",
            message=(
                f"Endpoint event '{action}' for process "
                f"'{process_name or 'unknown'}' on host '{hostname}'."
            ),
            metadata=metadata,
        )