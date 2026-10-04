"""
Network-category detection rules.
"""
from typing import Optional

from app.detection.base_rule import BaseDetectionRule, DetectionContext, DetectionResult
from app.models.event import Event


class NetHighConnectionFrequencyRule(BaseDetectionRule):
    rule_key = "NET_HIGH_CONNECTION_FREQUENCY"
    category = "network"
    name = "High Connection Frequency"
    description = (
        "Flags an unusually high number of connections from a single "
        "source within a short window."
    )
    default_severity = "medium"
    default_threshold_config = {"window_seconds": 60, "threshold": 50}

    async def evaluate(self, event: Event, context: DetectionContext) -> Optional[DetectionResult]:
        if event.event_type != "network.connection" or not event.source_ip:
            return None

        window_seconds = context.config.get("window_seconds", 60)
        threshold = context.config.get("threshold", 50)
        filters = {"source_ip": event.source_ip, "event_type": "network.connection"}

        count = await context.count_events(event, window_seconds, filters)
        if count < threshold:
            return None

        recent = await context.get_recent_events(event, window_seconds, filters, limit=min(count, 100))

        return DetectionResult(
            rule_key=self.rule_key,
            title="High Connection Frequency",
            category=self.category,
            severity=context.config.get("severity", self.default_severity),
            confidence=min(0.5 + (count - threshold) * 0.01, 0.9),
            reason=(
                f"{count} network connections were observed from "
                f"{event.source_ip} within {window_seconds} seconds."
            ),
            evidence={
                "event_ids": [e.event_id for e in recent],
                "count": count,
                "window_seconds": window_seconds,
                "threshold": threshold,
                "recommended_action": (
                    "Review the destination hosts/ports contacted by this "
                    "source for scanning or data exfiltration behavior."
                ),
            },
            source_ip=event.source_ip,
            hostname=event.hostname,
        )


class NetSuspiciousPortRule(BaseDetectionRule):
    rule_key = "NET_SUSPICIOUS_PORT"
    category = "network"
    name = "Connection to Suspicious Port"
    description = (
        "Flags connections to ports commonly associated with remote "
        "administration, lateral movement, or legacy/insecure services."
    )
    default_severity = "medium"
    default_threshold_config = {"watchlist_ports": [23, 135, 445, 1433, 3306, 3389, 4444, 5900]}

    async def evaluate(self, event: Event, context: DetectionContext) -> Optional[DetectionResult]:
        if event.category not in ("network", "firewall") or event.destination_port is None:
            return None

        watchlist = context.config.get("watchlist_ports", [])
        if event.destination_port not in watchlist:
            return None

        return DetectionResult(
            rule_key=self.rule_key,
            title="Connection to Suspicious Port",
            category=self.category,
            severity=context.config.get("severity", self.default_severity),
            confidence=0.55,
            reason=(
                f"A connection from {event.source_ip or 'unknown'} to "
                f"{event.destination_ip or 'unknown'}:{event.destination_port} was "
                f"observed, which is on the configured sensitive-port watchlist."
            ),
            evidence={
                "event_ids": [event.event_id],
                "destination_port": event.destination_port,
                "watchlist_ports": watchlist,
                "recommended_action": (
                    "Verify this connection is authorized; unexpected use of "
                    "administrative ports may indicate lateral movement."
                ),
            },
            source_ip=event.source_ip,
            hostname=event.hostname,
        )


class NetRepeatedConnFailuresRule(BaseDetectionRule):
    rule_key = "NET_REPEATED_CONN_FAILURES"
    category = "network"
    name = "Repeated Connection Failures"
    description = (
        "Flags repeated failed/refused connection attempts from the same "
        "source, a pattern consistent with network scanning."
    )
    default_severity = "medium"
    default_threshold_config = {"window_seconds": 120, "threshold": 20}

    async def evaluate(self, event: Event, context: DetectionContext) -> Optional[DetectionResult]:
        if (
            event.event_type != "network.connection"
            or event.status not in ("failed", "refused")
            or not event.source_ip
        ):
            return None

        window_seconds = context.config.get("window_seconds", 120)
        threshold = context.config.get("threshold", 20)
        filters = {
            "source_ip": event.source_ip,
            "event_type": "network.connection",
            "status": event.status,
        }

        count = await context.count_events(event, window_seconds, filters)
        if count < threshold:
            return None

        recent = await context.get_recent_events(event, window_seconds, filters, limit=min(count, 100))

        return DetectionResult(
            rule_key=self.rule_key,
            title="Repeated Connection Failures",
            category=self.category,
            severity=context.config.get("severity", self.default_severity),
            confidence=min(0.5 + (count - threshold) * 0.02, 0.9),
            reason=(
                f"{count} {event.status} connection attempts were observed "
                f"from {event.source_ip} within {window_seconds} seconds, "
                f"consistent with network scanning."
            ),
            evidence={
                "event_ids": [e.event_id for e in recent],
                "count": count,
                "window_seconds": window_seconds,
                "threshold": threshold,
                "recommended_action": (
                    "Investigate the source for port-scanning behavior and "
                    "consider blocking if it continues."
                ),
            },
            source_ip=event.source_ip,
            hostname=event.hostname,
        )
