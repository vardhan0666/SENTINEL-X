"""
Normalizer for DNS query telemetry into the canonical schema.

Expected raw fields:
    event_id, timestamp, client_ip, query, query_type,
    optional: hostname, answer
"""
from typing import Any

from app.ingestion.normalizers.base import BaseNormalizer
from app.schemas.event import EventIngest


class DnsNormalizer(BaseNormalizer):
    source_name = "dns"

    def normalize(self, raw_event: dict[str, Any]) -> EventIngest:
        event_id = self._require(raw_event, "event_id")
        timestamp = self._parse_timestamp(self._require(raw_event, "timestamp"))
        client_ip = self._require(raw_event, "client_ip")
        query = self._require(raw_event, "query")
        query_type = raw_event.get("query_type", "A")

        metadata: dict[str, Any] = {"query": query, "query_type": query_type}
        if raw_event.get("answer"):
            metadata["answer"] = raw_event["answer"]

        return EventIngest(
            event_id=str(event_id),
            timestamp=timestamp,
            source=self.source_name,
            category="dns",
            event_type="dns_query",
            severity=raw_event.get("severity") or "low",
            source_ip=client_ip,
            hostname=raw_event.get("hostname"),
            action="dns_query",
            status="observed",
            message=f"DNS query for '{query}' ({query_type}) from {client_ip}.",
            metadata=metadata,
        )