"""
Named correlation pattern classification.

Given a set of related Detection rows grouped by the correlation engine,
derive a human-readable, analyst-meaningful title describing the pattern
represented — e.g. "Potential Account Compromise Sequence" rather than a
generic "3 correlated detections". This directly implements the example
scenario from the project specification: repeated failed logins ->
successful login -> new privileged activity.
"""
from app.models.detection import Detection

_ACCOUNT_COMPROMISE_KEYS = {"AUTH_SUCCESS_AFTER_FAILURES"}
_BRUTE_FORCE_KEYS = {"AUTH_REPEATED_FAILURES", "AUTH_BRUTE_FORCE"}
_NETWORK_CATEGORY = "network"
_DNS_CATEGORY = "dns"
_ENDPOINT_CATEGORY = "endpoint"


def derive_correlation_title(detections: list[Detection]) -> str:
    rule_keys = {d.rule_key for d in detections if d.rule_key}
    categories = {d.category for d in detections}
    entity = _primary_entity_label(detections)

    if rule_keys & _ACCOUNT_COMPROMISE_KEYS:
        return f"Potential Account Compromise Sequence ({entity})"

    if rule_keys & _BRUTE_FORCE_KEYS and len(categories) > 1:
        return f"Multi-Stage Attack Chain Following Brute-Force Activity ({entity})"

    if categories == {_NETWORK_CATEGORY}:
        return f"Network Reconnaissance / Scanning Pattern ({entity})"

    if categories == {_DNS_CATEGORY}:
        return f"Suspicious DNS Activity Pattern ({entity})"

    if categories == {_ENDPOINT_CATEGORY}:
        return f"Suspicious Endpoint Activity Chain ({entity})"

    if len(categories) > 1:
        return f"Multi-Category Correlated Activity ({entity})"

    return f"Correlated Security Activity ({entity})"


def _primary_entity_label(detections: list[Detection]) -> str:
    for detection in detections:
        if detection.username:
            return f"user: {detection.username}"
    for detection in detections:
        if detection.source_ip:
            return f"source: {detection.source_ip}"
    for detection in detections:
        if detection.hostname:
            return f"host: {detection.hostname}"
    return "unknown entity"