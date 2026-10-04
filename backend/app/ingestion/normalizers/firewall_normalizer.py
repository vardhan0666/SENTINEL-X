"""
Normalizer for firewall-style telemetry (allow/block/deny decisions) into
the canonical schema.

Expected raw fields:
    event_id, timestamp, src_ip, dst_ip, dst_port, protocol,
    action ("allow" | "block" | "deny"), optional: rule_name
"""
from typing import Any

from app.ingestion.normalizers.base import BaseNormalizer
from app.schemas.event import EventIngest


class FirewallNormalizer(BaseNormalizer):
    source_name = "firewall"

    def normalize(self, raw_event: dict[str, Any]) -> EventIngest:
        event_id = self._require(raw_event, "event_id")
        timestamp = self._parse_timestamp(self._require(raw_event, "timestamp"))
        src_ip = self._require(raw_event, "src_ip")
        dst_ip = raw_event.get("dst_ip")
        protocol = (raw_event.get("protocol") or "tcp").lower()
        action = self._require(raw_event, "action").lower()

        if action not in ("allow", "block", "deny"):
            raise ValueError("Field 'action' must be one of 'allow', 'block', 'deny'.")

        severity = raw_event.get("severity") or ("low" if action == "allow" else "medium")
        rule_name = raw_event.get("rule_name")

        return EventIngest(
            event_id=str(event_id),
            timestamp=timestamp,
            source=self.source_name,
            category="firewall",
            event_type=f"firewall_{action}",
            severity=severity,
            source_ip=src_ip,
            destination_ip=dst_ip,
            destination_port=raw_event.get("dst_port"),
            protocol=protocol,
            action=action,
            status=action,
            message=(
                f"Firewall {action} {protocol.upper()} {src_ip} -> "
                f"{dst_ip}:{raw_event.get('dst_port', '?')} (rule: {rule_name or 'n/a'})."
            ),
            metadata={"rule_name": rule_name} if rule_name else {},
        )