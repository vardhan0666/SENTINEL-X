"""
Rule-based detection engine.

  - base_rule.py        — BaseDetectionRule interface, DetectionResult,
                           and DetectionContext (windowed event queries)
  - auth_rules.py        — authentication-category rules
  - network_rules.py      — network-category rules
  - endpoint_rules.py     — endpoint/process/file-category rules
  - dns_rules.py         — DNS-category rules
  - rule_registry.py     — aggregates every rule instance
  - detection_service.py — orchestrates rule evaluation against events

NOTE: AUTH_UNUSUAL_TIME (authentication outside a user's learned baseline
hours) is intentionally not implemented here. It depends on the ML
behavioral baseline built in Batch 8 (app/ml/baseline_stats.py) and will
be added to the rule catalog at that point.
"""