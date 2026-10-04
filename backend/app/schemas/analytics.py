"""
Pydantic schemas for analytics/dashboard aggregate endpoints
(app/services/analytics_service.py and app/api/analytics.py, Batch 10).
"""
from datetime import datetime

from pydantic import BaseModel


class OverviewStats(BaseModel):
    total_events: int
    active_incidents: int
    critical_alerts: int
    high_risk_events: int
    anomaly_count: int
    monitored_assets: int


class EventsOverTimePoint(BaseModel):
    bucket: datetime
    count: int


class SeverityDistributionItem(BaseModel):
    severity: str
    count: int


class TopSourceItem(BaseModel):
    source_ip: str
    count: int


class DetectionTypeDistributionItem(BaseModel):
    detection_type: str
    count: int