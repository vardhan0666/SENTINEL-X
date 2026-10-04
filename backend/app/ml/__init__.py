"""
ML anomaly detection engine.

  - feature_extraction.py     — windowed behavioral feature vectors
  - baseline_stats.py         — statistical (z-score) anomaly detector
  - isolation_forest_model.py — Isolation Forest wrapper
  - model_registry.py         — model persistence/loading (ml_artifacts volume)
  - train.py                  — training pipeline (DB-driven, with synthetic
                                 bootstrap fallback)
  - anomaly_service.py        — orchestrates both methods, persists
                                 AnomalyResult rows, creates ML_ANOMALY
                                 Detection rows

IMPORTANT: Per the project's AI-transparency requirement, every output of
this engine is labeled distinctly from rule-based detections
(DetectionType.ML_ANOMALY) and is presented as a statistical signal, not a
certainty of malicious activity. See docs/ML.md (added in a later batch).
"""