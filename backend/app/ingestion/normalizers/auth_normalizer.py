"""
Normalizer for authentication telemetry (e.g. SSH, VPN, application login
events) into the canonical SENTINEL-X event schema.

Expected raw fields:
    event_id, timestamp, src_ip, username, hostname, result
    (result: "success" | "failure"), optional: auth_method, severity
"""
from typing import Any

from app.ingestion.normalizers.base import BaseNormalizer
from app.schemas.event import EventIngest


class AuthNormalizer(BaseNormalizer):
    source_name = "auth"

    def normalize(self, raw_event: dict[str, Any]) -> EventIngest:
        event_id = self._require(raw_event, "event_id")
        timestamp = self._parse_timestamp(self._require(raw_event, "timestamp"))
        src_ip = raw_event.get("src_ip")
        username = raw_event.get("username")
        hostname = raw_event.get("hostname")
        result = self._require(raw_event, "result").lower()

        if result not in ("success", "failure"):
            raise ValueError("Field 'result' must be 'success' or 'failure'.")

        event_type = "authentication_success" if result == "success" else "authentication_failure"
        severity = raw_event.get("severity") or ("low" if result == "success" else "medium")

        metadata: dict[str, Any] = {}
        if raw_event.get("auth_method"):
            metadata["auth_method"] = raw_event["auth_method"]

        return EventIngest(
            event_id=str(event_id),
            timestamp=timestamp,
            source=self.source_name,
            category="authentication",
            event_type=event_type,
            severity=severity,
            source_ip=src_ip,
            username=username,
            hostname=hostname,
            action="login_attempt",
            status=result,
            message=(
                f"Authentication {result} for user '{username}' from "
                f"{src_ip or 'unknown source'} to host '{hostname or 'unknown host'}'."
            ),
            metadata=metadata,
        )