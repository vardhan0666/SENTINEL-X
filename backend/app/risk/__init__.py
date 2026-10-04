"""
Risk scoring engine: combines detection severity, frequency, confidence,
detection type, correlation strength, asset importance, and historical
repetition into a single, transparent 0-100 risk score.

  - factors.py  — individual, pure, unit-testable factor calculations
  - scoring.py  — weighted combination, classification, and DB-backed
                  lookups (asset criticality, historical activity)

See scoring.py's module docstring for the full documented formula.
"""