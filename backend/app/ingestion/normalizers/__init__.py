"""
Normalizer registry mapping a telemetry source name to its normalizer
instance. Used by app.ingestion.ingestion_service when ingesting raw,
source-specific payloads via POST /events/raw/{source}.
"""
from app.ingestion.normalizers.auth_normalizer import AuthNormalizer
from app.ingestion.normalizers.base import BaseNormalizer
from app.ingestion.normalizers.dns_normalizer import DnsNormalizer
from app.ingestion.normalizers.endpoint_normalizer import EndpointNormalizer
from app.ingestion.normalizers.firewall_normalizer import FirewallNormalizer
from app.ingestion.normalizers.network_normalizer import NetworkNormalizer

NORMALIZER_REGISTRY: dict[str, BaseNormalizer] = {
    AuthNormalizer.source_name: AuthNormalizer(),
    NetworkNormalizer.source_name: NetworkNormalizer(),
    DnsNormalizer.source_name: DnsNormalizer(),
    EndpointNormalizer.source_name: EndpointNormalizer(),
    FirewallNormalizer.source_name: FirewallNormalizer(),
}


def get_normalizer(source: str) -> BaseNormalizer:
    normalizer = NORMALIZER_REGISTRY.get(source.lower())
    if normalizer is None:
        raise ValueError(
            f"No normalizer registered for source '{source}'. "
            f"Available sources: {sorted(NORMALIZER_REGISTRY.keys())}"
        )
    return normalizer


__all__ = ["BaseNormalizer", "NORMALIZER_REGISTRY", "get_normalizer"]