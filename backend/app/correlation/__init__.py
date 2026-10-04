"""
Correlation engine: groups related Detection rows into CorrelationGroup
chains based on shared source IP, username, or hostname within a
configurable time window, and produces a human-readable, pattern-aware
title for each chain (e.g. "Potential Account Compromise Sequence").

  - correlation_engine.py — grouping logic
  - correlation_rules.py  — named pattern classification / title derivation

NOTE: This engine is not yet invoked automatically. Batch 10's
app/services/pipeline.py wires it into the ingestion -> detection ->
correlation -> risk -> ML -> incident chain. Batch 9's incident_service
will call it directly when creating incidents from newly created
detections.
"""