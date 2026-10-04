/**

* Authoritative frontend types for the SENTINEL-X incident API.
  */

export type IncidentStatus =
| "NEW"
| "INVESTIGATING"
| "CONTAINED"
| "RESOLVED"
| "FALSE_POSITIVE";

export type IncidentSeverity =
| "critical"
| "high"
| "medium"
| "low"
| "info";

export interface IncidentExplanation {
summary?: string;
risk_factors?: string[];
[key: string]: unknown;
}

export interface IncidentEventRead {
id?: string;
event_id: string;
timestamp?: string;
event_type?: string;
source_ip?: string | null;
destination_ip?: string | null;
source_port?: number | null;
destination_port?: number | null;
username?: string | null;
hostname?: string | null;
process_name?: string | null;
query_name?: string | null;
severity?: IncidentSeverity | string | null;
metadata?: Record<string, unknown> | null;
[key: string]: unknown;
}

export interface DetectionRead {
id: string;
title: string;
detection_type: string;
severity: IncidentSeverity | string;
reason?: string | null;
confidence?: number | null;
category?: string | null;
rule_key?: string | null;
correlation_group_id?: string | null;
risk_score?: number | null;
created_at?: string;
event_id?: string | null;
explanation?: string[] | null;
[key: string]: unknown;
}

export interface IncidentRead {
id: string;
title: string;
severity: IncidentSeverity | string;
risk_score: number;
status: IncidentStatus;
created_at: string;
updated_at: string;
correlation_group_id?: string | null;
explanation?: IncidentExplanation | null;
recommended_actions?: string[];
analyst_notes?: string | null;
assigned_to?: string | null;
}

export interface IncidentDetailRead extends IncidentRead {
events: IncidentEventRead[];
detections: DetectionRead[];
}

export interface IncidentUpdate {
status?: IncidentStatus;
analyst_notes?: string | null;
assigned_to?: string | null;
}

export interface IncidentRespondRequest {
action_type: string;
notes?: string | null;
}

export interface PaginatedIncidents {
items: IncidentRead[];
total: number;
limit: number;
offset: number;
}

export type IncidentListResponse =
| IncidentRead[]
| PaginatedIncidents;

export interface IncidentSummary {
total: number;
new_count: number;
investigating_count: number;
contained_count: number;
resolved_count: number;
false_positive_count: number;
}
