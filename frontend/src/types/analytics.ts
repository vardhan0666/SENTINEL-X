/**
 * Sentinel-X — Analytics Types
 *
 * Matches the current backend analytics API exactly.
 *
 * Backend endpoints:
 *   GET /api/v1/analytics/overview
 *   GET /api/v1/analytics/events-over-time
 *   GET /api/v1/analytics/severity-distribution
 *   GET /api/v1/analytics/top-sources
 *   GET /api/v1/analytics/detection-types
 *   GET /api/v1/health
 */

// ---------------------------------------------------------------------------
// Dashboard overview
// ---------------------------------------------------------------------------

export interface DashboardSummary {
  total_events: number;
  active_incidents: number;
  critical_alerts: number;
  high_risk_events: number;
  anomaly_count: number;
  monitored_assets: number;
}

// ---------------------------------------------------------------------------
// Events over time
// ---------------------------------------------------------------------------

export interface EventsOverTimePoint {
  bucket: string;
  count: number;
}

// ---------------------------------------------------------------------------
// Severity distribution
// ---------------------------------------------------------------------------

export interface SeverityDistributionItem {
  severity: string;
  count: number;
}

// ---------------------------------------------------------------------------
// Top event sources
// ---------------------------------------------------------------------------

export interface TopSourceItem {
  source_ip: string;
  count: number;
}

// ---------------------------------------------------------------------------
// Detection type distribution
// ---------------------------------------------------------------------------

export interface DetectionTypeDistributionItem {
  detection_type: string;
  count: number;
}

// ---------------------------------------------------------------------------
// System health
// ---------------------------------------------------------------------------

export interface ServiceHealth {
  name: string;
  status: "healthy" | "degraded" | "unhealthy";
  latency_ms?: number;
  last_checked: string;
  details?: Record<string, unknown>;
}

export interface SystemHealthResponse {
  overall_status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  services: ServiceHealth[];
  event_pipeline_active: boolean;
  ingestion_rate?: number;
  db_connection?: boolean;
  ml_models_loaded?: boolean;
}

// ---------------------------------------------------------------------------
// Analytics query parameters
// ---------------------------------------------------------------------------

export interface EventsOverTimeParams {
  hours?: number;
  bucket_minutes?: number;
}

export interface TopSourcesParams {
  limit?: number;
}