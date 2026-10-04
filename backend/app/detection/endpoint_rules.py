"""
Endpoint-category detection rules (process and file activity).
"""
from typing import Optional

from app.detection.base_rule import BaseDetectionRule, DetectionContext, DetectionResult
from app.models.event import Event


class EndpointSuspiciousProcessRule(BaseDetectionRule):
    rule_key = "ENDPOINT_SUSPICIOUS_PROCESS"
    category = "endpoint"
    name = "Suspicious Process Execution"
    description = (
        "Flags execution of processes on a configurable watchlist of tools "
        "commonly associated with post-exploitation activity. This is a "
        "heuristic watchlist match, not proof of malicious intent — several "
        "listed tools have legitimate administrative uses."
    )
    default_severity = "high"
    default_threshold_config = {
        "suspicious_processes": ["nc", "netcat", "mimikatz", "psexec", "certutil", "wmic", "rundll32"]
    }

    async def evaluate(self, event: Event, context: DetectionContext) -> Optional[DetectionResult]:
        if event.category != "process" or not event.process_name:
            return None

        watchlist = {p.lower() for p in context.config.get("suspicious_processes", [])}
        if event.process_name.lower() not in watchlist:
            return None

        return DetectionResult(
            rule_key=self.rule_key,
            title="Suspicious Process Execution",
            category=self.category,
            severity=context.config.get("severity", self.default_severity),
            confidence=0.5,
            reason=(
                f"Process '{event.process_name}' on host '{event.hostname}' "
                f"matched the suspicious-process watchlist."
            ),
            evidence={
                "event_ids": [event.event_id],
                "process_name": event.process_name,
                "recommended_action": (
                    "Confirm whether this process execution was authorized; "
                    "if not, isolate the host and investigate further."
                ),
            },
            hostname=event.hostname,
            username=event.username,
        )


class EndpointAbnormalExecRateRule(BaseDetectionRule):
    rule_key = "ENDPOINT_ABNORMAL_EXEC_RATE"
    category = "endpoint"
    name = "Abnormal Process Execution Rate"
    description = "Flags an unusually high number of process starts on a single host within a short window."
    default_severity = "medium"
    default_threshold_config = {"window_seconds": 60, "threshold": 30}

    async def evaluate(self, event: Event, context: DetectionContext) -> Optional[DetectionResult]:
        if event.event_type != "process.start" or not event.hostname:
            return None

        window_seconds = context.config.get("window_seconds", 60)
        threshold = context.config.get("threshold", 30)
        filters = {"hostname": event.hostname, "event_type": "process.start"}

        count = await context.count_events(event, window_seconds, filters)
        if count < threshold:
            return None

        recent = await context.get_recent_events(event, window_seconds, filters, limit=min(count, 100))

        return DetectionResult(
            rule_key=self.rule_key,
            title="Abnormal Process Execution Rate",
            category=self.category,
            severity=context.config.get("severity", self.default_severity),
            confidence=min(0.5 + (count - threshold) * 0.02, 0.9),
            reason=(
                f"{count} process starts were observed on host "
                f"'{event.hostname}' within {window_seconds} seconds."
            ),
            evidence={
                "event_ids": [e.event_id for e in recent],
                "count": count,
                "window_seconds": window_seconds,
                "threshold": threshold,
                "recommended_action": (
                    "Review the process list on this host for scripted or "
                    "automated execution consistent with malware behavior."
                ),
            },
            hostname=event.hostname,
        )


class FileUnusualActivityRule(BaseDetectionRule):
    rule_key = "FILE_UNUSUAL_ACTIVITY"
    category = "endpoint"
    name = "Unusual File Activity"
    description = (
        "Flags a high-frequency burst of file create/modify/delete "
        "operations on a single host within a short window."
    )
    default_severity = "medium"
    default_threshold_config = {"window_seconds": 60, "threshold": 50}

    async def evaluate(self, event: Event, context: DetectionContext) -> Optional[DetectionResult]:
        if event.category != "file" or not event.hostname:
            return None

        window_seconds = context.config.get("window_seconds", 60)
        threshold = context.config.get("threshold", 50)
        filters = {"hostname": event.hostname, "category": "file"}

        count = await context.count_events(event, window_seconds, filters)
        if count < threshold:
            return None

        recent = await context.get_recent_events(event, window_seconds, filters, limit=min(count, 100))

        return DetectionResult(
            rule_key=self.rule_key,
            title="Unusual File Activity",
            category=self.category,
            severity=context.config.get("severity", self.default_severity),
            confidence=min(0.5 + (count - threshold) * 0.01, 0.9),
            reason=(
                f"{count} file create/modify/delete events were observed on "
                f"host '{event.hostname}' within {window_seconds} seconds."
            ),
            evidence={
                "event_ids": [e.event_id for e in recent],
                "count": count,
                "window_seconds": window_seconds,
                "threshold": threshold,
                "recommended_action": (
                    "Review affected files for signs of ransomware-like mass "
                    "modification or data staging."
                ),
            },
            hostname=event.hostname,
        )
