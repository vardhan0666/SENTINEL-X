/**
 * Sentinel-X — Analytics Service
 *
 * Matches the current backend analytics API.
 *
 * Endpoints:
 *   GET /api/v1/analytics/overview
 *   GET /api/v1/analytics/events-over-time
 *   GET /api/v1/analytics/severity-distribution
 *   GET /api/v1/analytics/top-sources
 *   GET /api/v1/analytics/detection-types
 *   GET /api/v1/health
 */

import apiClient from "./apiClient";

import type {
  DashboardSummary,
  DetectionTypeDistributionItem,
  EventsOverTimeParams,
  EventsOverTimePoint,
  SeverityDistributionItem,
  SystemHealthResponse,
  TopSourceItem,
  TopSourcesParams,
} from "../types/analytics";

// ---------------------------------------------------------------------------
// Dashboard overview
// ---------------------------------------------------------------------------

export async function getDashboardSummary(
  signal?: AbortSignal,
): Promise<DashboardSummary> {
  return apiClient.get<DashboardSummary>(
    "/analytics/overview",
    { signal },
  );
}

// ---------------------------------------------------------------------------
// Events over time
// ---------------------------------------------------------------------------

export async function getEventsOverTime(
  params: EventsOverTimeParams = {
    hours: 24,
    bucket_minutes: 60,
  },
  signal?: AbortSignal,
): Promise<EventsOverTimePoint[]> {
  const searchParams = new URLSearchParams();

  if (params.hours !== undefined) {
    searchParams.set(
      "hours",
      String(params.hours),
    );
  }

  if (params.bucket_minutes !== undefined) {
    searchParams.set(
      "bucket_minutes",
      String(params.bucket_minutes),
    );
  }

  const query = searchParams.toString();

  return apiClient.get<EventsOverTimePoint[]>(
    query
      ? `/analytics/events-over-time?${query}`
      : "/analytics/events-over-time",
    { signal },
  );
}

// ---------------------------------------------------------------------------
// Severity distribution
// ---------------------------------------------------------------------------

export async function getSeverityDistribution(
  signal?: AbortSignal,
): Promise<SeverityDistributionItem[]> {
  return apiClient.get<SeverityDistributionItem[]>(
    "/analytics/severity-distribution",
    { signal },
  );
}

// ---------------------------------------------------------------------------
// Top sources
// ---------------------------------------------------------------------------

export async function getTopSources(
  params: TopSourcesParams = { limit: 10 },
  signal?: AbortSignal,
): Promise<TopSourceItem[]> {
  const searchParams = new URLSearchParams();

  if (params.limit !== undefined) {
    searchParams.set(
      "limit",
      String(params.limit),
    );
  }

  const query = searchParams.toString();

  return apiClient.get<TopSourceItem[]>(
    query
      ? `/analytics/top-sources?${query}`
      : "/analytics/top-sources",
    { signal },
  );
}

// ---------------------------------------------------------------------------
// Detection types
// ---------------------------------------------------------------------------

export async function getDetectionTypes(
  signal?: AbortSignal,
): Promise<DetectionTypeDistributionItem[]> {
  return apiClient.get<DetectionTypeDistributionItem[]>(
    "/analytics/detection-types",
    { signal },
  );
}

// ---------------------------------------------------------------------------
// System health
// ---------------------------------------------------------------------------

export async function getSystemHealth(
  signal?: AbortSignal,
): Promise<SystemHealthResponse> {
  return apiClient.get<SystemHealthResponse>(
    "/health",
    { signal },
  );
}