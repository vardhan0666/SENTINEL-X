/**
 * Sentinel-X — Event Types
 *
 * Matches the existing backend event schemas exactly:
 *   EventIngest   — POST /api/v1/events
 *   EventBatchIngest — POST /api/v1/events/batch
 *   EventRead     — GET  /api/v1/events, GET /api/v1/events/{event_id}
 *
 * Required fields: event_id, timestamp, source, event_type, severity
 * Severity values: low | medium | high | critical
 * The backend DB field `event_metadata` is exposed as `metadata` in the API.
 * Batch schema: { events: EventIngest[] }  max 1000 events.
 */

// ---------------------------------------------------------------------------
// Severity
// ---------------------------------------------------------------------------

export type Severity = "low" | "medium" | "high" | "critical";

// ---------------------------------------------------------------------------
// EventIngest — payload for POST /api/v1/events
// ---------------------------------------------------------------------------

export interface EventIngest {
  // Required
  event_id: string;
  timestamp: string;        // ISO 8601
  source: string;
  event_type: string;
  severity: Severity;

  // Optional
  category?: string;
  source_ip?: string;
  destination_ip?: string;
  source_port?: number;     // 1–65535
  destination_port?: number; // 1–65535
  protocol?: string;
  username?: string;
  hostname?: string;
  process_name?: string;
  action?: string;
  status?: string;
  message?: string;
  metadata?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// EventBatchIngest — payload for POST /api/v1/events/batch
// ---------------------------------------------------------------------------

export interface EventBatchIngest {
  events: EventIngest[];    // 1–1000 events
}

// ---------------------------------------------------------------------------
// EventRead — response from GET /api/v1/events and GET /api/v1/events/{id}
// All EventIngest fields are present plus server-assigned fields.
// ---------------------------------------------------------------------------

export interface EventRead {
  // Required (always present in response)
  event_id: string;
  timestamp: string;
  source: string;
  event_type: string;
  severity: Severity;

  // Optional (may be null/absent)
  category: string | null;
  source_ip: string | null;
  destination_ip: string | null;
  source_port: number | null;
  destination_port: number | null;
  protocol: string | null;
  username: string | null;
  hostname: string | null;
  process_name: string | null;
  action: string | null;
  status: string | null;
  message: string | null;
  metadata: Record<string, unknown> | null;  // backend: event_metadata → API: metadata

  // Server timestamps
  created_at?: string;
  updated_at?: string;
}

// ---------------------------------------------------------------------------
// EventIngestResponse — response from POST /api/v1/events
// Backend returns the persisted Event object (same shape as EventRead).
// ---------------------------------------------------------------------------

export type EventIngestResponse = EventRead;

// ---------------------------------------------------------------------------
// EventBatchIngestResponse — response from POST /api/v1/events/batch
// ---------------------------------------------------------------------------

export interface EventBatchIngestResponse {
  ingested: number;
  failed: number;
  events?: EventRead[];
}

// ---------------------------------------------------------------------------
// Paginated events response (if backend returns paginated list)
// ---------------------------------------------------------------------------

export interface PaginatedEvents {
  items: EventRead[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

// ---------------------------------------------------------------------------
// Event list response — backend may return flat list or paginated object
// ---------------------------------------------------------------------------

export type EventListResponse = EventRead[] | PaginatedEvents;

// ---------------------------------------------------------------------------
// WebSocket live event message (broadcast type: "event.created")
// ---------------------------------------------------------------------------

export interface LiveEventMessage {
  type: "event.created";
  data: EventRead;
}