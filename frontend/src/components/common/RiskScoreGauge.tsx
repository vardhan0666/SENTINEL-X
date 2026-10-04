/**
 * Sentinel-X — RiskScoreGauge Component
 *
 * Renders a semicircular gauge representing a risk score.
 * Score range: 0–100 (matching the backend risk scoring implementation).
 *
 * Colour zones:
 *   0–25   → low (green)
 *   26–50  → medium (amber)
 *   51–75  → high (orange)
 *   76–100 → critical (red)
 */

import React from "react";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function _scoreToColor(score: number): string {
  if (score <= 25) return "#22c55e";   // green-500
  if (score <= 50) return "#f59e0b";   // amber-500
  if (score <= 75) return "#f97316";   // orange-500
  return "#ef4444";                     // red-500
}

function _scoreToLabel(score: number): string {
  if (score <= 25) return "Low";
  if (score <= 50) return "Medium";
  if (score <= 75) return "High";
  return "Critical";
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface RiskScoreGaugeProps {
  score: number;          // 0–100
  size?: number;          // px, default 120
  strokeWidth?: number;   // default 10
  showLabel?: boolean;
  showScore?: boolean;
  className?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function RiskScoreGauge({
  score,
  size = 120,
  strokeWidth = 10,
  showLabel = true,
  showScore = true,
  className = "",
}: RiskScoreGaugeProps): React.JSX.Element {
  // Clamp score to [0, 100]
  const clamped = Math.max(0, Math.min(100, score));

  const radius = (size - strokeWidth) / 2;
  const center = size / 2;

  // We draw a semicircle (180° arc) from 180° to 0° (left to right, top half)
  // The arc goes from the bottom-left to the bottom-right of the viewBox
  const startAngle = 180; // degrees
  const arcAngle = startAngle - (clamped / 100) * 180;

  function _polarToCartesian(
    cx: number,
    cy: number,
    r: number,
    angleDeg: number
  ): { x: number; y: number } {
    const rad = ((angleDeg - 90) * Math.PI) / 180;
    return {
      x: cx + r * Math.cos(rad),
      y: cy + r * Math.sin(rad),
    };
  }

  function _describeArc(
    cx: number,
    cy: number,
    r: number,
    startDeg: number,
    endDeg: number
  ): string {
    const start = _polarToCartesian(cx, cy, r, endDeg);
    const end = _polarToCartesian(cx, cy, r, startDeg);
    const largeArc = startDeg - endDeg <= 180 ? "0" : "1";
    return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`;
  }

  const color = _scoreToColor(clamped);
  const label = _scoreToLabel(clamped);

  // Full background arc (grey) — 180° semicircle
  const bgPath = _describeArc(center, center, radius, 180, 0);
  // Filled arc based on score
  const fillPath =
    clamped > 0
      ? _describeArc(center, center, radius, 180, arcAngle)
      : "";

  return (
    <div
      className={`inline-flex flex-col items-center ${className}`}
      role="meter"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`Risk score: ${clamped} — ${label}`}
    >
      <svg
        width={size}
        height={size / 2 + strokeWidth}
        viewBox={`0 0 ${size} ${size / 2 + strokeWidth}`}
        overflow="visible"
      >
        {/* Background track */}
        <path
          d={bgPath}
          fill="none"
          stroke="#1a2540"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
        {/* Score fill */}
        {clamped > 0 && (
          <path
            d={fillPath}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            style={{ filter: `drop-shadow(0 0 6px ${color}80)` }}
          />
        )}
        {/* Score text */}
        {showScore && (
          <text
            x={center}
            y={size / 2 + strokeWidth - 2}
            textAnchor="middle"
            dominantBaseline="auto"
            className="font-bold tabular-nums"
            style={{
              fill: color,
              fontSize: size * 0.22,
              fontFamily: "Inter, sans-serif",
              fontWeight: 700,
            }}
          >
            {clamped}
          </text>
        )}
      </svg>
      {showLabel && (
        <span
          className="text-xs font-semibold mt-1"
          style={{ color }}
        >
          {label} Risk
        </span>
      )}
    </div>
  );
}

export default RiskScoreGauge;