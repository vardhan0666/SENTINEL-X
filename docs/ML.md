# SENTINEL-X Machine Learning

## Purpose

The ML layer supplements rule-based detection with statistical anomaly
analysis of security telemetry.

## Components

`feature_extraction.py`

Transforms canonical event data into numeric features suitable for anomaly
analysis.

`baseline_stats.py`

Supports baseline statistics used to describe expected telemetry behavior.

`isolation_forest_model.py`

Provides the Isolation Forest based anomaly-model implementation.

`model_registry.py`

Provides model registration/retrieval and model artifact coordination.

`train.py`

Provides the model-training workflow.

`anomaly_service.py`

Coordinates anomaly evaluation and persistence/integration with the rest of
the security pipeline.

## Pipeline integration

ML evaluation is performed after event persistence and rule-based detection.
The current pipeline evaluates anomalies for supported entity keys such as
source IP, username, and hostname.

## Operational considerations

- Models and artifacts should remain local to the configured artifact volume.
- Training data should be authorized and suitable for the target environment.
- Synthetic simulator events are appropriate for development and testing.
- Tests should avoid depending on external model-serving infrastructure.

## Why ML is not the only detector

Rule-based detections are explicit and auditable. ML anomaly detection is
complementary and is therefore handled as an additional evidence source before
correlation and incident evaluation.
