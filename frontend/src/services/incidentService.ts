/**
 * Sentinel-X — Incident Service
 *
 * Matches the current backend incident API:
 *
 *   GET   /api/v1/incidents
 *   GET   /api/v1/incidents/{id}
 *   PATCH /api/v1/incidents/{id}
 */

import apiClient from "./apiClient";

import type {
  IncidentDetailRead,
  IncidentListResponse,
  IncidentRead,
  IncidentUpdate,
} from "../types/incident";

// ---------------------------------------------------------------------------
// Query parameters
// ---------------------------------------------------------------------------

export interface IncidentListParams {
  limit?: number;
  offset?: number;
  status?: string;
  severity?: string;
  assigned_to?: string;
}

// ---------------------------------------------------------------------------
// List incidents
// ---------------------------------------------------------------------------

export async function listIncidents(
  params: IncidentListParams = {},
  signal?: AbortSignal,
): Promise<IncidentListResponse> {
  const searchParams = new URLSearchParams();

  if (params.limit !== undefined) {
    searchParams.set(
      "limit",
      String(params.limit),
    );
  }

  if (params.offset !== undefined) {
    searchParams.set(
      "offset",
      String(params.offset),
    );
  }

  if (params.status) {
    searchParams.set(
      "status",
      params.status,
    );
  }

  if (params.severity) {
    searchParams.set(
      "severity",
      params.severity,
    );
  }

  if (params.assigned_to) {
    searchParams.set(
      "assigned_to",
      params.assigned_to,
    );
  }

  const query = searchParams.toString();

  return apiClient.get<IncidentListResponse>(
    query
      ? `/incidents?${query}`
      : "/incidents",
    { signal },
  );
}

// ---------------------------------------------------------------------------
// Get incident detail
// ---------------------------------------------------------------------------

export async function getIncident(
  incidentId: string,
  signal?: AbortSignal,
): Promise<IncidentDetailRead> {
  return apiClient.get<IncidentDetailRead>(
    `/incidents/${encodeURIComponent(incidentId)}`,
    { signal },
  );
}

// ---------------------------------------------------------------------------
// Update incident
// ---------------------------------------------------------------------------

export async function updateIncident(
  incidentId: string,
  update: IncidentUpdate,
  signal?: AbortSignal,
): Promise<IncidentRead> {
  return apiClient.patch<IncidentRead>(
    `/incidents/${encodeURIComponent(incidentId)}`,
    update,
    { signal },
  );
}