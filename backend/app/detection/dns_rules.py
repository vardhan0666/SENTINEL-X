"""
DNS-category detection rules.
"""
import math
from collections import Counter
from typing import Optional

from app.detection.base_rule import BaseDetectionRule, DetectionContext, DetectionResult
from app.models.event import Event


def _shannon_entropy(label: str) -> float:
    """Compute Shannon entropy (bits/char) of a string — a simple, real
    heuristic for detecting algorithmically-generated or obfuscated domain
    labels (higher entropy ~ more random-looking)."""
    if not label:
        return 0.0
    counts = Counter(label)
    length = len(label)
    return -sum((count / length) * math.log2(count / length) for count in counts.values())


class DnsExcessiveQueriesRule(BaseDetectionRule):
    rule_key = "DNS_EXCESSIVE_QUERIES"
    category = "dns"
    name = "Excessive DNS Query Volume"
    description = "Flags an unusually high volume of DNS queries from a single host within a short window."
    default_severity = "medium"
    default_threshold_config = {"window_seconds": 60, "threshold": 100}

    async def evaluate(self, event: Event, context: DetectionContext) -> Optional[DetectionResult]:
        if event.event_type != "dns.query" or not event.source_ip:
            return None

        window_seconds = context.config.get("window_seconds", 60)
        threshold = context.config.get("threshold", 100)
        filters = {"source_ip": event.source_ip, "event_type": "dns.query"}

        count = await context.count_events(event, window_seconds, filters)
        if count < threshold:
            return None

        recent = await context.get_recent_events(event, window_seconds, filters, limit=min(count, 100))

        return DetectionResult(
            rule_key=self.rule_key,
            title="Excessive DNS Query Volume",
            category=self.category,
            severity=context.config.get("severity", self.default_severity),
            confidence=min(0.5 + (count - threshold) * 0.01, 0.9),
            reason=(
                f"{count} DNS queries were observed from {event.source_ip} "
                f"within {window_seconds} seconds."
            ),
            evidence={
                "event_ids": [e.event_id for e in recent],
                "count": count,
                "window_seconds": window_seconds,
                "threshold": threshold,
                "recommended_action": (
                    "Investigate the querying host for DNS tunneling or "
                    "malware beaconing behavior."
                ),
            },
            source_ip=event.source_ip,
            hostname=event.hostname,
        )


class DnsSuspiciousDomainPatternRule(BaseDetectionRule):
    rule_key = "DNS_SUSPICIOUS_DOMAIN_PATTERN"
    category = "dns"
    name = "Suspicious Domain Pattern"
    description = (
        "Flags DNS queries for domains with unusually high length or "
        "character entropy in the leading label — a heuristic indicator "
        "of algorithmically generated or obfuscated domains, not a "
        "definitive verdict."
    )
    default_severity = "medium"
    default_threshold_config = {"max_length": 40, "max_entropy": 3.7}

    async def evaluate(self, event: Event, context: DetectionContext) -> Optional[DetectionResult]:
        if event.event_type != "dns.query":
            return None

        metadata = event.event_metadata or {}
        query = metadata.get("query_name") or metadata.get("query")
        if not query:
            return None

        label = query.split(".")[0]
        entropy = _shannon_entropy(label)
        max_length = context.config.get("max_length", 40)
        max_entropy = context.config.get("max_entropy", 3.7)

        if len(query) <= max_length and entropy <= max_entropy:
            return None

        reasons = []
        if len(query) > max_length:
            reasons.append(f"domain length {len(query)} exceeds {max_length} characters")
        if entropy > max_entropy:
            reasons.append(f"label entropy {entropy:.2f} exceeds {max_entropy:.2f} bits/char")

        return DetectionResult(
            rule_key=self.rule_key,
            title="Suspicious Domain Pattern",
            category=self.category,
            severity=context.config.get("severity", self.default_severity),
            confidence=0.55,
            reason=(
                f"DNS query for '{query}' from {event.source_ip or 'unknown'} "
                f"flagged: {' and '.join(reasons)}."
            ),
            evidence={
                "event_ids": [event.event_id],
                "query": query,
                "length": len(query),
                "entropy": round(entropy, 3),
                "recommended_action": (
                    "Investigate the queried domain and the requesting host "
                    "for signs of DGA malware or data exfiltration via DNS."
                ),
            },
            source_ip=event.source_ip,
            hostname=event.hostname,
        )



