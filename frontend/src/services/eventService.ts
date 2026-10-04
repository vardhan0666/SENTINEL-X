/**
 * Sentinel-X — Event Service
 *
 * Implements the existing backend event API:
 *
 *   POST /api/v1/events                — ingest single event
 *   POST /api/v1/events/batch          — ingest batch of events
 *   GET  /api/v1/events                — list events (paginated or flat)
 *   GET  /api/v1/events/{event_id}     — get single event
 *
 * Authentication: Bearer token (ADMIN or ANALYST role required for POST).
 * GET endpoints require any authenticated user.
 */

import apiClient from "./apiClient";
import type {
  EventBatchIngest,
  EventBatchIngestResponse,
  EventIngest,
  EventIngestResponse,
  EventListResponse,
  EventRead,
} from "../types/event";

// ---------------------------------------------------------------------------
// Query parameters for event listing
// ---------------------------------------------------------------------------

export interface EventListParams {
  page?: number;
  size?: number;
  severity?: string;
  source?: string;
  event_type?: string;
  from?: string;    // ISO 8601
  to?: string;      // ISO 8601
}

// ---------------------------------------------------------------------------
// Ingest a single event
// ---------------------------------------------------------------------------

/**
 * POST /api/v1/events
 *
 * Requires ADMIN or ANALYST role.
 * Returns the persisted EventRead.
 */
export async function ingestEvent(
  payload: EventIngest,
  signal?: AbortSignal
): Promise<EventIngestResponse> {
  return apiClient.post<EventIngestResponse>("/events", payload, { signal });
}

// ---------------------------------------------------------------------------
// Ingest a batch of events
// ---------------------------------------------------------------------------

/**
 * POST /api/v1/events/batch
 *
 * Payload: { events: EventIngest[] }  — 1 to 1000 events.
 * Requires ADMIN or ANALYST role.
 */
export async function ingestEventBatch(
  payload: EventBatchIngest,
  signal?: AbortSignal
): Promise<EventBatchIngestResponse> {
  return apiClient.post<EventBatchIngestResponse>("/events/batch", payload, {
    signal,
  });
}

// ---------------------------------------------------------------------------
// List events
// ---------------------------------------------------------------------------

/**
 * GET /api/v1/events
 *
 * Returns a list or paginated response depending on the backend implementation.
 * Query parameters are forwarded as URL search params.
 */
export async function listEvents(
  params: EventListParams = {},
  signal?: AbortSignal
): Promise<EventListResponse> {
  const searchParams = _buildSearchParams(params);
  const path = searchParams ? `/events?${searchParams}` : "/events";
  return apiClient.get<EventListResponse>(path, { signal });
}

// ---------------------------------------------------------------------------
// Get single event by ID
// ---------------------------------------------------------------------------

/**
 * GET /api/v1/events/{event_id}
 *
 * Returns EventRead or throws ApiError 404 if not found.
 */
export async function getEvent(
  eventId: string,
  signal?: AbortSignal
): Promise<EventRead> {
  return apiClient.get<EventRead>(`/events/${encodeURIComponent(eventId)}`, {
    signal,
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function _buildSearchParams(params: EventListParams): string {
  const p = new URLSearchParams();
  if (params.page !== undefined) p.set("page", String(params.page));
  if (params.size !== undefined) p.set("size", String(params.size));
  if (params.severity) p.set("severity", params.severity);
  if (params.source) p.set("source", params.source);
  if (params.event_type) p.set("event_type", params.event_type);
  if (params.from) p.set("from", params.from);
  if (params.to) p.set("to", params.to);
  return p.toString();
}