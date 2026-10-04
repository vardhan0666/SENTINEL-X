"""
Aggregates every detection rule instance into a single registry consumed
by:
  - app.detection.detection_service (evaluates ALL_RULES against events)
  - database/seed/seed_rules.py (seeds the `rules` table from rule metadata)

NOTE: AUTH_UNUSUAL_TIME is intentionally not included yet — it depends on
the ML behavioral baseline introduced in Batch 8 and will be added here
at that point (see app/detection/__init__.py for details).
"""
from app.detection.auth_rules import (
    AuthBruteForceRule,
    AuthRepeatedFailuresRule,
    AuthSuccessAfterFailuresRule,
)
from app.detection.base_rule import BaseDetectionRule
from app.detection.dns_rules import DnsExcessiveQueriesRule, DnsSuspiciousDomainPatternRule
from app.detection.endpoint_rules import (
    EndpointAbnormalExecRateRule,
    EndpointSuspiciousProcessRule,
    FileUnusualActivityRule,
)
from app.detection.network_rules import (
    NetHighConnectionFrequencyRule,
    NetRepeatedConnFailuresRule,
    NetSuspiciousPortRule,
)

ALL_RULES: list[BaseDetectionRule] = [
    AuthRepeatedFailuresRule(),
    AuthBruteForceRule(),
    AuthSuccessAfterFailuresRule(),
    NetHighConnectionFrequencyRule(),
    NetSuspiciousPortRule(),
    NetRepeatedConnFailuresRule(),
    EndpointSuspiciousProcessRule(),
    EndpointAbnormalExecRateRule(),
    FileUnusualActivityRule(),
    DnsExcessiveQueriesRule(),
    DnsSuspiciousDomainPatternRule(),
]

RULES_BY_KEY: dict[str, BaseDetectionRule] = {rule.rule_key: rule for rule in ALL_RULES}