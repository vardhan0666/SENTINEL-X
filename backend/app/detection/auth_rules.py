"""
Authentication-category detection rules.
"""
from typing import Optional

from app.detection.base_rule import BaseDetectionRule, DetectionContext, DetectionResult
from app.models.event import Event


class AuthRepeatedFailuresRule(BaseDetectionRule):
    rule_key = "AUTH_REPEATED_FAILURES"
    category = "authentication"
    name = "Repeated Authentication Failures"
    description = (
        "Flags a burst of failed authentication attempts from the same "
        "source IP within a short time window."
    )
    default_severity = "medium"
    default_threshold_config = {"window_seconds": 120, "threshold": 10}

    async def evaluate(self, event: Event, context: DetectionContext) -> Optional[DetectionResult]:
        if event.event_type != "authentication.failure" or not event.source_ip:
            return None

        window_seconds = context.config.get("window_seconds", 120)
        threshold = context.config.get("threshold", 10)
        filters = {"source_ip": event.source_ip, "event_type": "authentication.failure"}

        count = await context.count_events(event, window_seconds, filters)
        if count < threshold:
            return None

        recent = await context.get_recent_events(event, window_seconds, filters, limit=count)

        return DetectionResult(
            rule_key=self.rule_key,
            title="Repeated Authentication Failures",
            category=self.category,
            severity=context.config.get("severity", self.default_severity),
            confidence=min(0.5 + (count - threshold) * 0.03, 0.95),
            reason=(
                f"{count} failed authentication attempts were observed from "
                f"{event.source_ip} within {window_seconds} seconds."
            ),
            evidence={
                "event_ids": [e.event_id for e in recent],
                "count": count,
                "window_seconds": window_seconds,
                "threshold": threshold,
                "recommended_action": (
                    "Review the source IP for further malicious activity and "
                    "consider blocking it if attempts continue."
                ),
            },
            source_ip=event.source_ip,
            username=event.username,
            hostname=event.hostname,
        )


class AuthBruteForceRule(BaseDetectionRule):
    rule_key = "AUTH_BRUTE_FORCE"
    category = "authentication"
    name = "Brute-Force / Credential Spraying Pattern"
    description = (
        "Flags failed authentication attempts against multiple distinct "
        "usernames from the same source IP within a short window — a "
        "signature of credential spraying rather than a single-account "
        "brute-force attempt."
    )
    default_severity = "high"
    default_threshold_config = {
        "window_seconds": 300,
        "min_total_failures": 8,
        "min_distinct_usernames": 4,
    }

    async def evaluate(self, event: Event, context: DetectionContext) -> Optional[DetectionResult]:
        if event.event_type != "authentication.failure" or not event.source_ip:
            return None

        window_seconds = context.config.get("window_seconds", 300)
        min_total = context.config.get("min_total_failures", 8)
        min_distinct = context.config.get("min_distinct_usernames", 4)
        filters = {"source_ip": event.source_ip, "event_type": "authentication.failure"}

        total_failures = await context.count_events(event, window_seconds, filters)
        if total_failures < min_total:
            return None

        distinct_usernames = await context.count_distinct(event, window_seconds, filters, "username")
        if distinct_usernames < min_distinct:
            return None

        recent = await context.get_recent_events(event, window_seconds, filters, limit=total_failures)

        return DetectionResult(
            rule_key=self.rule_key,
            title="Brute-Force / Credential Spraying Pattern",
            category=self.category,
            severity=context.config.get("severity", self.default_severity),
            confidence=min(0.6 + (distinct_usernames - min_distinct) * 0.04, 0.97),
            reason=(
                f"{total_failures} failed authentication attempts against "
                f"{distinct_usernames} distinct usernames were observed from "
                f"{event.source_ip} within {window_seconds} seconds, consistent "
                f"with credential spraying."
            ),
            evidence={
                "event_ids": [e.event_id for e in recent],
                "total_failures": total_failures,
                "distinct_usernames": distinct_usernames,
                "window_seconds": window_seconds,
                "recommended_action": (
                    "Block or rate-limit the source IP, and review whether any "
                    "of the targeted accounts were ultimately compromised."
                ),
            },
            source_ip=event.source_ip,
            hostname=event.hostname,
        )


class AuthSuccessAfterFailuresRule(BaseDetectionRule):
    rule_key = "AUTH_SUCCESS_AFTER_FAILURES"
    category = "authentication"
    name = "Successful Login Following Repeated Failures"
    description = (
        "Flags a successful authentication that occurs shortly after a "
        "run of failed attempts for the same account or source — a common "
        "signature of an eventually successful brute-force or "
        "credential-stuffing attempt."
    )
    default_severity = "high"
    default_threshold_config = {"window_seconds": 600, "min_prior_failures": 5}

    async def evaluate(self, event: Event, context: DetectionContext) -> Optional[DetectionResult]:
        if event.event_type != "authentication.success":
            return None

        window_seconds = context.config.get("window_seconds", 600)
        min_prior_failures = context.config.get("min_prior_failures", 5)

        if event.username:
            filters = {"username": event.username, "event_type": "authentication.failure"}
            target_desc = f"account '{event.username}'"
        elif event.source_ip:
            filters = {"source_ip": event.source_ip, "event_type": "authentication.failure"}
            target_desc = f"source {event.source_ip}"
        else:
            return None

        prior_failures = await context.count_events(event, window_seconds, filters)
        if prior_failures < min_prior_failures:
            return None

        recent = await context.get_recent_events(event, window_seconds, filters, limit=prior_failures)

        return DetectionResult(
            rule_key=self.rule_key,
            title="Successful Login Following Repeated Failures",
            category=self.category,
            severity=context.config.get("severity", self.default_severity),
            confidence=min(0.6 + (prior_failures - min_prior_failures) * 0.05, 0.97),
            reason=(
                f"A successful authentication for {target_desc} occurred after "
                f"{prior_failures} failed attempts within {window_seconds} seconds, "
                f"a pattern consistent with a successful brute-force attempt."
            ),
            evidence={
                "event_ids": [e.event_id for e in recent] + [event.event_id],
                "prior_failures": prior_failures,
                "window_seconds": window_seconds,
                "threshold": min_prior_failures,
                "recommended_action": (
                    "Immediately verify this login with the account owner, "
                    "consider forcing a credential rotation, and review "
                    "subsequent activity from this session for signs of compromise."
                ),
            },
            source_ip=event.source_ip,
            username=event.username,
            hostname=event.hostname,
        )
