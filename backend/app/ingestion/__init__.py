"""
Ingestion engine: validation, normalization, enrichment, and persistence
of telemetry into the canonical Event schema. See:

  - app.ingestion.validators     — business-rule validation
  - app.ingestion.normalizers.*  — per-source canonicalization
  - app.ingestion.enrichment     — local asset/indicator enrichment
  - app.ingestion.ingestion_service — orchestration entry point
"""