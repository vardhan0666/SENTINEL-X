"""
Normalizer for network connection telemetry (e.g. NetFlow-style / session
logs describing individual connections) into the canonical schema.

Expected raw fields:
    event_id, timestamp, src_ip, dst_ip, src_port, dst_port, protocol,
    conn_status ("established" | "failed" | "refused"), optional: hostname
"""
from typing import Any

from app.ingestion.normalizers.base import BaseNormalizer
from app.schemas.event import EventIngest


class NetworkNormalizer(BaseNormalizer):
    source_name = "network"

    def normalize(self, raw_event: dict[str, Any]) -> EventIngest:
        event_id = self._require(raw_event, "event_id")
        timestamp = self._parse_timestamp(self._require(raw_event, "timestamp"))
        src_ip = self._require(raw_event, "src_ip")
        dst_ip = raw_event.get("dst_ip")
        protocol = (raw_event.get("protocol") or "tcp").lower()
        conn_status = (raw_event.get("conn_status") or "established").lower()

        severity = raw_event.get("severity") or ("low" if conn_status == "established" else "medium")

        return EventIngest(
            event_id=str(event_id),
            timestamp=timestamp,
            source=self.source_name,
            category="network",
            event_type="network_connection",
            severity=severity,
            source_ip=src_ip,
            destination_ip=dst_ip,
            source_port=raw_event.get("src_port"),
            destination_port=raw_event.get("dst_port"),
            protocol=protocol,
            hostname=raw_event.get("hostname"),
            action="connect",
            status=conn_status,
            message=(
                f"{protocol.upper()} connection {conn_status} from "
                f"{src_ip}:{raw_event.get('src_port', '?')} to "
                f"{dst_ip}:{raw_event.get('dst_port', '?')}."
            ),
            metadata={},
        )