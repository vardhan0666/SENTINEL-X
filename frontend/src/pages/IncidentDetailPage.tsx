import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import PageContainer from "../components/layout/PageContainer";
import {
  getIncident,
  updateIncident,
} from "../services/incidentService";
import type {
  IncidentDetailRead,
  IncidentStatus,
  IncidentUpdate,
} from "../types/incident";

function formatDate(value: unknown): string {
  if (!value) {
    return "ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â";
  }

  const date = new Date(String(value));

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleString();
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â";
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function recordValue(
  value: unknown,
  key: string,
): unknown {
  if (
    value &&
    typeof value === "object" &&
    !Array.isArray(value)
  ) {
    return (value as Record<string, unknown>)[key];
  }

  return undefined;
}

function severityMeta(value: unknown): {
  label: string;
  className: string;
  dotClass: string;
} {
  const severity = String(value ?? "").toUpperCase();

  switch (severity) {
    case "CRITICAL":
      return {
        label: "CRITICAL",
        className:
          "border-red-500/40 bg-red-500/10 text-red-300",
        dotClass: "bg-red-400",
      };

    case "HIGH":
      return {
        label: "HIGH",
        className:
          "border-orange-500/40 bg-orange-500/10 text-orange-300",
        dotClass: "bg-orange-400",
      };

    case "MEDIUM":
      return {
        label: "MEDIUM",
        className:
          "border-yellow-500/40 bg-yellow-500/10 text-yellow-300",
        dotClass: "bg-yellow-400",
      };

    case "LOW":
      return {
        label: "LOW",
        className:
          "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
        dotClass: "bg-emerald-400",
      };

    default:
      return {
        label: severity || "UNKNOWN",
        className:
          "border-white/10 bg-white/5 text-white/50",
        dotClass: "bg-white/30",
      };
  }
}

function statusMeta(value: IncidentStatus): {
  label: string;
  className: string;
  dotClass: string;
} {
  switch (value) {
    case "NEW":
      return {
        label: "NEW",
        className:
          "border-red-500/30 bg-red-500/10 text-red-300",
        dotClass: "bg-red-400",
      };

    case "INVESTIGATING":
      return {
        label: "INVESTIGATING",
        className:
          "border-yellow-500/30 bg-yellow-500/10 text-yellow-300",
        dotClass: "bg-yellow-400",
      };

    case "CONTAINED":
      return {
        label: "CONTAINED",
        className:
          "border-orange-500/30 bg-orange-500/10 text-orange-300",
        dotClass: "bg-orange-400",
      };

    case "RESOLVED":
      return {
        label: "RESOLVED",
        className:
          "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
        dotClass: "bg-emerald-400",
      };

    case "FALSE_POSITIVE":
      return {
        label: "FALSE POSITIVE",
        className:
          "border-white/10 bg-white/5 text-white/40",
        dotClass: "bg-white/25",
      };

    default:
      return {
        label: String(value).replace(/_/g, " "),
        className:
          "border-white/10 bg-white/5 text-white/50",
        dotClass: "bg-white/30",
      };
  }
}

function riskMeta(score: number): {
  label: string;
  className: string;
} {
  if (score >= 80) {
    return {
      label: "CRITICAL",
      className: "text-red-300",
    };
  }

  if (score >= 60) {
    return {
      label: "HIGH",
      className: "text-orange-300",
    };
  }

  if (score >= 40) {
    return {
      label: "ELEVATED",
      className: "text-yellow-300",
    };
  }

  return {
    label: "LOW",
    className: "text-emerald-300",
  };
}

function clampRisk(score: number): number {
  if (!Number.isFinite(score)) {
    return 0;
  }

  return Math.max(0, Math.min(100, score));
}

function keyLabel(value: string): string {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, function (character: string) {
      return character.toUpperCase();
    });
}

export default function IncidentDetailPage() {
  const navigate = useNavigate();
  const params = useParams<Record<string, string | undefined>>();

  const incidentId =
    params.incidentId ?? params.id;

  const [incident, setIncident] =
    useState<IncidentDetailRead | null>(null);

  const [loading, setLoading] = useState(true);

  const [error, setError] =
    useState<string | null>(null);

  const [saving, setSaving] = useState(false);

  const [status, setStatus] =
    useState<IncidentStatus | "">("");

  const [notes, setNotes] =
    useState("");

  useEffect(() => {
    let mounted = true;

    if (!incidentId) {
      setError("Incident ID is missing.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    getIncident(incidentId)
      .then((data) => {
        if (!mounted) {
          return;
        }

        setIncident(data);
        setStatus(data.status);
        setNotes(data.analyst_notes ?? "");
      })
      .catch((err) => {
        if (!mounted) {
          return;
        }

        setError(
          err instanceof Error
            ? err.message
            : "Unable to load incident.",
        );
      })
      .finally(() => {
        if (mounted) {
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [incidentId]);

  async function handleSave() {
    if (!incidentId || !incident) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const payload: IncidentUpdate = {
        status: status || incident.status,
        analyst_notes: notes.trim() || null,
      };

      const updated = await updateIncident(
        incidentId,
        payload,
      );

      setIncident((current) => {
        if (!current) {
          return null;
        }

        return {
          ...current,
          ...updated,
        };
      });

      setStatus(updated.status);
      setNotes(updated.analyst_notes ?? "");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to update incident.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <PageContainer
        title="Incident Command"
        subtitle="Loading security incident telemetry"
      >
        <div className="min-h-[60vh] rounded-2xl border border-emerald-500/15 bg-[#050706] p-10">
          <div className="flex min-h-[50vh] items-center justify-center">
            <div className="text-center">
              <div className="mx-auto h-14 w-14 animate-spin rounded-full border-2 border-white/10 border-t-emerald-400" />

              <div className="mt-6 text-[10px] font-bold uppercase tracking-[0.3em] text-emerald-400/70">
                Establishing secure channel
              </div>

              <div className="mt-2 font-mono text-[9px] uppercase tracking-[0.18em] text-white/25">
                Loading incident telemetry...
              </div>
            </div>
          </div>
        </div>
      </PageContainer>
    );
  }

  if (error && !incident) {
    return (
      <PageContainer
        title="Incident Command"
        subtitle="Unable to load incident"
      >
        <div className="space-y-5 rounded-2xl border border-red-500/20 bg-[#070706] p-6">
          <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-5">
            <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-red-300">
              Incident Retrieval Failure
            </div>

            <p className="mt-3 text-sm leading-6 text-red-200/70">
              {error}
            </p>
          </div>

          <button
            type="button"
            onClick={() => navigate("/incidents")}
            data-cursor-target="back to incidents"
            className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-2.5 text-xs font-bold uppercase tracking-[0.18em] text-white/60 transition hover:border-emerald-400/30 hover:text-emerald-300"
          >
            ÃƒÂ¢Ã¢â‚¬Â Ã‚Â Back to Incidents
          </button>
        </div>
      </PageContainer>
    );
  }

  if (!incident) {
    return (
      <PageContainer
        title="Incident Command"
        subtitle="Incident not found"
      >
        <div className="rounded-2xl border border-white/10 bg-[#070a08] p-10 text-center">
          <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-white/35">
            No Incident Record
          </div>

          <p className="mt-3 text-sm text-white/50">
            The requested incident does not exist or is no longer available.
          </p>
        </div>
      </PageContainer>
    );
  }

  const explanation = incident.explanation ?? {};

  const riskValue = clampRisk(
    Number(incident.risk_score ?? 0),
  );

  const currentSeverity = severityMeta(
    incident.severity,
  );

  const currentStatus = statusMeta(
    incident.status,
  );

  const currentRisk = riskMeta(riskValue);

  const riskFactorsRaw =
    explanation.risk_factors;

  const riskFactorsEntries =
    riskFactorsRaw &&
    typeof riskFactorsRaw === "object" &&
    !Array.isArray(riskFactorsRaw)
      ? Object.entries(
          riskFactorsRaw as Record<string, unknown>,
        )
      : [];

  const riskFactorsArray =
    Array.isArray(riskFactorsRaw)
      ? riskFactorsRaw
      : [];

  const recommendedActionsRaw =
    incident.recommended_actions;

  const recommendedActions =
    recommendedActionsRaw &&
    typeof recommendedActionsRaw === "object" &&
    !Array.isArray(recommendedActionsRaw) &&
    "actions" in recommendedActionsRaw &&
    Array.isArray(
      (
        recommendedActionsRaw as {
          actions?: unknown;
        }
      ).actions,
    )
      ? (
          recommendedActionsRaw as {
            actions: unknown[];
          }
        ).actions
      : Array.isArray(recommendedActionsRaw)
        ? recommendedActionsRaw
        : [];

  const events: unknown[] = Array.isArray(
    incident.events,
  )
    ? incident.events
    : [];

  const detections: unknown[] = Array.isArray(
    incident.detections,
  )
    ? incident.detections
    : [];

  const detectionTypes = Array.from(new Set(detections.map((detection) => formatValue(recordValue(detection, "detection_type") ?? recordValue(detection, "rule_key")))));


  return (
    <PageContainer
      title="Incident Command"
      subtitle="Security incident investigation and response control"
    >
      <div className="min-h-full space-y-6 bg-[#050706] text-white">
        {/* Hero */}
        <section className="relative overflow-hidden rounded-2xl border border-emerald-500/20 bg-[#07100c] p-6 shadow-[0_0_45px_rgba(16,185,129,0.06)]">
          <div className="pointer-events-none absolute inset-0 opacity-20">
            <div
              className="absolute inset-0"
              style={{
                backgroundImage:
                  "linear-gradient(rgba(16,185,129,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(16,185,129,0.08) 1px, transparent 1px)",
                backgroundSize: "32px 32px",
              }}
            />
          </div>

          <div className="pointer-events-none absolute right-[-100px] top-[-100px] h-80 w-80 rounded-full border border-emerald-400/10" />

          <div className="relative">
            <button
              type="button"
              onClick={() => navigate("/incidents")}
              data-cursor-target="back to incidents"
              className="mb-5 text-[10px] font-bold uppercase tracking-[0.2em] text-white/35 transition hover:text-emerald-300"
            >
              ÃƒÂ¢Ã¢â‚¬Â Ã‚Â Incident Queue
            </button>

            <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
              <div className="max-w-4xl">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span className="flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/5 px-3 py-1 text-[9px] font-bold uppercase tracking-[0.2em] text-emerald-300">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                    Active Incident Record
                  </span>

                  <span className="font-mono text-[9px] uppercase tracking-[0.15em] text-white/20">
                    SOC / INCIDENT / {incident.id.slice(0, 12)}
                  </span>
                </div>

                <h1 className="text-3xl font-black uppercase tracking-[0.06em] text-white md:text-4xl">
                  {incident.title || "Untitled Incident"}
                </h1>

                <p className="mt-4 max-w-3xl text-sm leading-6 text-white/40">
                  {explanation.summary ??
                    "No incident explanation is currently available."}
                </p>

                <div className="mt-5 flex flex-wrap gap-2">
                  <span
                    className={
                      "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.16em] " +
                      currentSeverity.className
                    }
                  >
                    <span
                      className={
                        "h-1.5 w-1.5 rounded-full " +
                        currentSeverity.dotClass
                      }
                    />
                    {currentSeverity.label}
                  </span>

                  <span
                    className={
                      "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.16em] " +
                      currentStatus.className
                    }
                  >
                    <span
                      className={
                        "h-1.5 w-1.5 rounded-full " +
                        currentStatus.dotClass
                      }
                    />
                    {currentStatus.label}
                  </span>
                </div>
              </div>

              {/* Risk reactor */}
              <div className="flex shrink-0 justify-center xl:pr-8">
                <div className="relative flex h-40 w-40 items-center justify-center">
                  <div
                    className="absolute inset-0 rounded-full"
                    style={{
                      background:
                        `conic-gradient(from 0deg, rgba(52,211,153,0.95) ${riskValue}%, rgba(255,255,255,0.05) ${riskValue}% 100%)`,
                      mask:
                        "radial-gradient(circle, transparent 58%, black 59%)",
                      WebkitMask:
                        "radial-gradient(circle, transparent 58%, black 59%)",
                    }}
                  />

                  <div className="absolute inset-3 rounded-full border border-emerald-400/15 bg-[#050706]" />
                  <div className="absolute inset-7 rounded-full border border-white/5" />

                  <div className="relative text-center">
                    <div className="font-mono text-4xl font-black text-white">
                      {riskValue.toFixed(0)}
                    </div>

                    <div
                      className={
                        "mt-1 text-[9px] font-bold uppercase tracking-[0.2em] " +
                        currentRisk.className
                      }
                    >
                      {currentRisk.label} RISK
                    </div>
                  </div>

                  <div className="absolute left-1/2 top-0 h-2 w-px -translate-x-1/2 bg-emerald-400/50" />
                  <div className="absolute bottom-0 left-1/2 h-2 w-px -translate-x-1/2 bg-emerald-400/20" />
                </div>
              </div>
            </div>

            <div className="mt-6 grid gap-3 border-t border-white/5 pt-5 sm:grid-cols-2 lg:grid-cols-4">
              <TacticalMetric
                label="Incident ID"
                value={incident.id}
                mono
              />

              <TacticalMetric
                label="Created"
                value={formatDate(incident.created_at)}
              />

              <TacticalMetric
                label="Last Update"
                value={formatDate(incident.updated_at)}
              />

              <TacticalMetric
                label="Assigned Analyst"
                value={formatValue(incident.assigned_to)}
              />
            </div>
          </div>
        </section>

        {/* Command metrics */}
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            label="Risk Score"
            value={riskValue.toFixed(1)}
            accent="emerald"
            sublabel={currentRisk.label}
          />

          <MetricCard
            label="Linked Events"
            value={events.length.toLocaleString()}
            accent="white"
            sublabel="Correlated telemetry"
          />

          <MetricCard
            label="Detections"
            value={detections.length.toLocaleString()}
            accent="orange"
            sublabel="Contributing signals"
          />

          <MetricCard
            label="Detection Types"
            value={detectionTypes.length.toLocaleString()}
            accent="purple"
            sublabel="Unique detection classes"
          />
        </section>

        {error && (
          <section className="rounded-xl border border-red-500/30 bg-red-500/5 p-4">
            <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-red-300">
              Command Error
            </div>
            <p className="mt-2 text-sm text-red-200/70">
              {error}
            </p>
          </section>
        )}

        {/* Information + explanation */}
        <section className="grid gap-6 xl:grid-cols-3">
          <div className="xl:col-span-1">
            <Section title="Incident Intelligence" code="INTEL-01">
              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-1">
                <InfoRow
                  label="Status"
                  value={String(
                    incident.status ?? "ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â",
                  )}
                />

                <InfoRow
                  label="Severity"
                  value={String(
                    incident.severity ?? "ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â",
                  )}
                />

                <InfoRow
                  label="Assigned To"
                  value={formatValue(
                    incident.assigned_to,
                  )}
                />

                <InfoRow
                  label="Correlation Group"
                  value={
                    incident.correlation_group_id ??
                    "No correlation group assigned."
                  }
                />
              </div>
            </Section>
          </div>

          <div className="xl:col-span-2">
            <Section title="Detection Explanation" code="ANALYSIS-01">
              <div className="space-y-5">
                <div className="rounded-xl border border-emerald-500/10 bg-black/20 p-5">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-emerald-400/60">
                      Analyst Summary
                    </span>

                    <span className="font-mono text-[9px] text-white/20">
                      EXPLANATION
                    </span>
                  </div>

                  <p className="text-sm leading-7 text-white/65">
                    {typeof explanation.summary ===
                    "string"
                      ? explanation.summary
                      : "No explanation available."}
                  </p>
                </div>

                <div>
                  <div className="mb-3 text-[9px] font-bold uppercase tracking-[0.22em] text-white/30">
                    Risk Factors
                  </div>

                  {riskFactorsEntries.length === 0 &&
                  riskFactorsArray.length === 0 ? (
                    <div className="rounded-xl border border-white/5 bg-black/20 p-4 text-xs text-white/25">
                      No risk factors available.
                    </div>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {riskFactorsEntries.map(
                        ([key, value]) => {
                          const structured =
                            value &&
                            typeof value ===
                              "object" &&
                            !Array.isArray(value)
                              ? (value as Record<
                                  string,
                                  unknown
                                >)
                              : null;

                          const numericValue =
                            structured &&
                            typeof structured.value ===
                              "number"
                              ? structured.value
                              : null;

                          const contribution =
                            structured &&
                            typeof structured.contribution ===
                              "number"
                              ? structured.contribution
                              : null;

                          return (
                            <div
                              key={key}
                              className="rounded-xl border border-white/7 bg-black/20 p-4"
                            >
                              <div className="flex items-center justify-between gap-3">
                                <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/35">
                                  {keyLabel(key)}
                                </span>

                                {numericValue !== null && (
                                  <span className="font-mono text-xs font-bold text-emerald-300">
                                    {numericValue}
                                  </span>
                                )}
                              </div>

                              {contribution !==
                                null && (
                                <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/5">
                                  <div
                                    className="h-full rounded-full bg-emerald-400"
                                    style={{
                                      width:
                                        Math.max(
                                          0,
                                          Math.min(
                                            100,
                                            Math.abs(
                                              contribution,
                                            ),
                                          ),
                                        ) + "%",
                                    }}
                                  />
                                </div>
                              )}

                              <div className="mt-3 whitespace-pre-wrap text-xs leading-5 text-white/45">
                                {formatValue(
                                  value,
                                )}
                              </div>
                            </div>
                          );
                        },
                      )}

                      {riskFactorsArray.map(
                        (factor, index) => (
                          <div
                            key={index}
                            className="rounded-xl border border-white/7 bg-black/20 p-4 text-xs leading-5 text-white/45"
                          >
                            {formatValue(factor)}
                          </div>
                        ),
                      )}
                    </div>
                  )}
                </div>
              </div>
            </Section>
          </div>
        </section>

        {/* Recommended actions */}
        <Section
          title="Recommended Defensive Actions"
          code="RESPONSE-01"
        >
          {recommendedActions.length === 0 ? (
            <div className="rounded-xl border border-white/5 bg-black/20 p-5 text-xs text-white/25">
              No recommended actions are currently associated with this
              incident.
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {recommendedActions.map(
                (action, index) => (
                  <div
                    key={index}
                    className="group rounded-xl border border-emerald-500/10 bg-emerald-500/[0.025] p-4 transition hover:border-emerald-500/25 hover:bg-emerald-500/[0.04]"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-emerald-500/20 bg-emerald-500/5 font-mono text-[10px] font-bold text-emerald-300">
                        {String(index + 1).padStart(
                          2,
                          "0",
                        )}
                      </div>

                      <div className="text-[9px] font-bold uppercase tracking-[0.18em] text-emerald-400/60">
                        Recommended Response
                      </div>
                    </div>

                    <div className="mt-4 whitespace-pre-wrap text-sm leading-6 text-white/60">
                      {formatValue(action)}
                    </div>
                  </div>
                ),
              )}
            </div>
          )}
        </Section>

        {/* Incident management */}
        <Section
          title="Incident Management"
          code="CONTROL-01"
        >
          <div className="grid gap-5 lg:grid-cols-2">
            <div>
              <label
                htmlFor="incident-status"
                className="mb-2 block text-[9px] font-bold uppercase tracking-[0.2em] text-white/35"
              >
                Incident Status
              </label>

              <select
                id="incident-status"
                value={status}
                onChange={(event) =>
                  setStatus(
                    event.target.value as IncidentStatus,
                  )
                }
                data-cursor-target="incident status"
                className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-xs font-bold uppercase tracking-[0.12em] text-white outline-none transition focus:border-emerald-400/40 focus:ring-1 focus:ring-emerald-400/10"
              >
                <option
                  value="NEW"
                  className="bg-[#07100c]"
                >
                  NEW
                </option>

                <option
                  value="INVESTIGATING"
                  className="bg-[#07100c]"
                >
                  INVESTIGATING
                </option>

                <option
                  value="CONTAINED"
                  className="bg-[#07100c]"
                >
                  CONTAINED
                </option>

                <option
                  value="RESOLVED"
                  className="bg-[#07100c]"
                >
                  RESOLVED
                </option>

                <option
                  value="FALSE_POSITIVE"
                  className="bg-[#07100c]"
                >
                  FALSE POSITIVE
                </option>
              </select>
            </div>

            <div>
              <label
                htmlFor="incident-notes"
                className="mb-2 block text-[9px] font-bold uppercase tracking-[0.2em] text-white/35"
              >
                Analyst Notes
              </label>

              <textarea
                id="incident-notes"
                value={notes}
                onChange={(event) =>
                  setNotes(event.target.value)
                }
                rows={6}
                placeholder="Enter investigation notes..."
                data-cursor-target="analyst notes"
                className="w-full resize-y rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm leading-6 text-white/75 outline-none transition placeholder:text-white/15 focus:border-emerald-400/40 focus:ring-1 focus:ring-emerald-400/10"
              />
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-3 border-t border-white/5 pt-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-white/20">
              Changes are written to the incident record
            </div>

            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              data-cursor-target="save incident"
              className="rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-6 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-emerald-300 transition hover:border-emerald-300/50 hover:bg-emerald-400/15 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {saving
                ? "Writing Record..."
                : "Commit Changes"}
            </button>
          </div>
        </Section>

        {/* Linked events */}
        <Section
          title={`Linked Events (${events.length})`}
          code="TELEMETRY-01"
        >
          {events.length === 0 ? (
            <div className="rounded-xl border border-white/5 bg-black/20 p-5 text-xs text-white/25">
              No linked events are attached to this incident.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-white/5">
              <table className="min-w-full text-left">
                <thead className="border-b border-white/7 bg-black/20">
                  <tr className="text-[9px] uppercase tracking-[0.2em] text-white/25">
                    <th className="px-4 py-4">
                      Event ID
                    </th>

                    <th className="px-4 py-4">
                      Type
                    </th>

                    <th className="px-4 py-4">
                      Source
                    </th>

                    <th className="px-4 py-4">
                      Severity
                    </th>

                    <th className="px-4 py-4">
                      Timestamp
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-white/5">
                  {events.map((event, index) => {
                    const eventSeverity =
                      severityMeta(
                        recordValue(
                          event,
                          "severity",
                        ),
                      );

                    const eventId = String(
                      recordValue(
                        event,
                        "id",
                      ) ??
                        recordValue(
                          event,
                          "event_id",
                        ) ??
                        `event-${index}`,
                    );

                    const eventType =
                      recordValue(
                        event,
                        "event_type",
                      );

                    const source =
                      recordValue(
                        event,
                        "source_ip",
                      ) ??
                      recordValue(
                        event,
                        "hostname",
                      ) ??
                      recordValue(
                        event,
                        "source",
                      );

                    const timestamp =
                      recordValue(
                        event,
                        "timestamp",
                      ) ??
                      recordValue(
                        event,
                        "created_at",
                      );

                    return (
                      <tr
                        key={eventId}
                        className="transition hover:bg-emerald-500/[0.025]"
                      >
                        <td className="px-4 py-4">
                          <span className="font-mono text-[10px] text-emerald-300/70">
                            {eventId.slice(
                              0,
                              16,
                            )}
                          </span>
                        </td>

                        <td className="px-4 py-4">
                          <span className="text-xs font-semibold text-white/65">
                            {formatValue(
                              eventType,
                            )}
                          </span>
                        </td>

                        <td className="px-4 py-4">
                          <span className="font-mono text-[10px] text-white/40">
                            {formatValue(source)}
                          </span>
                        </td>

                        <td className="px-4 py-4">
                          <span
                            className={
                              "inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[8px] font-bold uppercase tracking-[0.14em] " +
                              eventSeverity.className
                            }
                          >
                            <span
                              className={
                                "h-1.5 w-1.5 rounded-full " +
                                eventSeverity.dotClass
                              }
                            />
                            {eventSeverity.label}
                          </span>
                        </td>

                        <td className="px-4 py-4">
                          <span className="text-[10px] text-white/35">
                            {formatDate(
                              timestamp,
                            )}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Section>

        {/* Detections */}
        <Section
          title={`Contributing Detections (${detections.length})`}
          code="DETECTION-01"
        >
          {detections.length === 0 ? (
            <div className="rounded-xl border border-white/5 bg-black/20 p-5 text-xs text-white/25">
              No contributing detections are attached to this incident.
            </div>
          ) : (
            <div className="space-y-3">
              {detections.map(
                (detection, index) => {
                  const detectionId = String(
                    recordValue(
                      detection,
                      "id",
                    ) ??
                      `detection-${index}`,
                  );

                  const ruleName =
                    recordValue(
                      detection,
                      "rule_name",
                    ) ??
                    recordValue(
                      detection,
                      "rule_key",
                    ) ??
                    recordValue(
                      detection,
                      "detection_type",
                    );

                  const detectionType =
                    recordValue(
                      detection,
                      "detection_type",
                    );

                  const ruleKey =
                    recordValue(
                      detection,
                      "rule_key",
                    );

                  const confidence =
                    recordValue(
                      detection,
                      "confidence",
                    );

                  const description =
                    recordValue(
                      detection,
                      "description",
                    );

                  const detectionSeverity =
                    severityMeta(
                      recordValue(
                        detection,
                        "severity",
                      ),
                    );

                  return (
                    <div
                      key={detectionId}
                      className="rounded-xl border border-white/7 bg-black/20 p-5 transition hover:border-emerald-500/20"
                    >
                      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                        <div>
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-500/15 bg-emerald-500/5 font-mono text-[9px] font-bold text-emerald-300">
                              D{String(
                                index + 1,
                              ).padStart(
                                2,
                                "0",
                              )}
                            </div>

                            <div>
                              <div className="text-sm font-bold uppercase tracking-wide text-white/80">
                                {formatValue(
                                  ruleName,
                                )}
                              </div>

                              <div className="mt-1 font-mono text-[9px] uppercase tracking-[0.15em] text-white/20">
                                ID:{" "}
                                {detectionId.slice(
                                  0,
                                  14,
                                )}
                              </div>
                            </div>
                          </div>
                        </div>

                        <span
                          className={
                            "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.15em] " +
                            detectionSeverity.className
                          }
                        >
                          <span
                            className={
                              "h-1.5 w-1.5 rounded-full " +
                              detectionSeverity.dotClass
                            }
                          />
                          {detectionSeverity.label}
                        </span>
                      </div>

                      <div className="mt-5 grid gap-3 sm:grid-cols-3">
                        <DetectionField
                          label="Detection Type"
                          value={formatValue(
                            detectionType,
                          )}
                        />

                        <DetectionField
                          label="Rule"
                          value={formatValue(
                            ruleKey,
                          )}
                        />

                        <DetectionField
                          label="Confidence"
                          value={formatValue(
                            confidence,
                          )}
                        />
                      </div>

                      {description !==
                        undefined &&
                        description !== null && (
                          <div className="mt-4 rounded-xl border border-white/5 bg-white/[0.015] p-4">
                            <div className="mb-2 text-[9px] font-bold uppercase tracking-[0.18em] text-white/25">
                              Detection Context
                            </div>

                            <div className="whitespace-pre-wrap text-xs leading-6 text-white/40">
                              {formatValue(
                                description,
                              )}
                            </div>
                          </div>
                        )}
                    </div>
                  );
                },
              )}
            </div>
          )}
        </Section>

        {/* Correlation */}
        <Section
          title="Correlation Network"
          code="CORR-01"
        >
          <div className="relative overflow-hidden rounded-xl border border-emerald-500/10 bg-black/20 p-6">
            <div
              className="pointer-events-none absolute inset-0 opacity-15"
              style={{
                backgroundImage:
                  "radial-gradient(circle at 20% 30%, rgba(52,211,153,0.22) 0 1px, transparent 1px), radial-gradient(circle at 80% 70%, rgba(255,255,255,0.12) 0 1px, transparent 1px)",
                backgroundSize:
                  "28px 28px, 42px 42px",
              }}
            />

            <div className="relative grid gap-6 lg:grid-cols-[1fr_auto_1fr] lg:items-center">
              <CorrelationNode
                label="Incident"
                value={
                  incident.title ||
                  "Untitled Incident"
                }
                active
              />

              <div className="hidden items-center justify-center lg:flex">
                <div className="h-px w-20 bg-gradient-to-r from-emerald-400/50 to-emerald-400/10" />
                <div className="h-2 w-2 rounded-full border border-emerald-400/50 bg-[#07100c]" />
                <div className="h-px w-20 bg-gradient-to-l from-emerald-400/50 to-emerald-400/10" />
              </div>

              <CorrelationNode
                label="Correlation Group"
                value={
                  incident.correlation_group_id ??
                  "Unassigned"
                }
              />
            </div>
          </div>
        </Section>
      </div>
    </PageContainer>
  );
}

function TacticalMetric({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded-xl border border-white/5 bg-black/20 px-4 py-3">
      <div className="text-[8px] font-bold uppercase tracking-[0.2em] text-white/25">
        {label}
      </div>

      <div
        className={
          "mt-2 break-all text-xs font-semibold text-white/55 " +
          (mono ? "font-mono" : "")
        }
      >
        {value}
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  sublabel,
  accent,
}: {
  label: string;
  value: string;
  sublabel: string;
  accent:
    | "emerald"
    | "white"
    | "orange"
    | "purple";
}) {
  const accentClass = {
    emerald: "text-emerald-300",
    white: "text-white",
    orange: "text-orange-300",
    purple: "text-purple-300",
  }[accent];

  const borderClass = {
    emerald: "border-emerald-500/15",
    white: "border-white/10",
    orange: "border-orange-500/15",
    purple: "border-purple-500/15",
  }[accent];

  return (
    <div
      className={
        "rounded-xl border bg-[#070a08] p-5 " +
        borderClass
      }
    >
      <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/30">
        {label}
      </div>

      <div
        className={
          "mt-3 font-mono text-2xl font-black " +
          accentClass
        }
      >
        {value}
      </div>

      <div className="mt-1 text-[9px] uppercase tracking-[0.15em] text-white/20">
        {sublabel}
      </div>
    </div>
  );
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="border-b border-white/5 pb-4 last:border-b-0 last:pb-0">
      <div className="text-[8px] font-bold uppercase tracking-[0.2em] text-white/25">
        {label}
      </div>

      <div className="mt-2 break-words text-sm text-white/60">
        {value}
      </div>
    </div>
  );
}

function DetectionField({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.015] p-4">
      <div className="text-[8px] font-bold uppercase tracking-[0.18em] text-white/25">
        {label}
      </div>

      <div className="mt-2 break-words text-xs font-semibold text-white/55">
        {value}
      </div>
    </div>
  );
}

function CorrelationNode({
  label,
  value,
  active = false,
}: {
  label: string;
  value: string;
  active?: boolean;
}) {
  return (
    <div
      className={
        "rounded-xl border p-5 " +
        (active
          ? "border-emerald-500/20 bg-emerald-500/[0.035]"
          : "border-white/7 bg-black/20")
      }
    >
      <div className="flex items-center gap-2">
        <span
          className={
            "h-2 w-2 rounded-full " +
            (active
              ? "animate-pulse bg-emerald-400"
              : "bg-white/20")
          }
        />

        <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/30">
          {label}
        </span>
      </div>

      <div className="mt-3 break-all text-sm font-semibold text-white/65">
        {value}
      </div>
    </div>
  );
}

function Section({
  title,
  code,
  children,
}: {
  title: string;
  code: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-white/10 bg-[#070a08] shadow-[0_0_30px_rgba(0,0,0,0.25)]">
      <div className="flex items-center justify-between border-b border-white/7 bg-black/20 px-5 py-4">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-emerald-400/65">
            {title}
          </div>
        </div>

        <div className="font-mono text-[8px] uppercase tracking-[0.18em] text-white/20">
          {code}
        </div>
      </div>

      <div className="p-5">{children}</div>
    </section>
  );
}

