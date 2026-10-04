/**
 * Sentinel-X — PageContainer Component
 *
 * Provides a consistent page layout shell:
 *   - Page title and optional subtitle
 *   - Optional header actions (buttons, badges)
 *   - Consistent padding and max-width
 *   - Optional loading state overlay
 */

import React from "react";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface PageContainerProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  loading?: boolean;
  className?: string;
  /** Remove default padding (for full-bleed content) */
  noPadding?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PageContainer({
  title,
  subtitle,
  actions,
  children,
  loading = false,
  className = "",
  noPadding = false,
}: PageContainerProps): React.JSX.Element {
  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Page header */}
      <div className="flex-shrink-0 px-6 pt-6 pb-4 border-b border-surface-700/50">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold text-white truncate">{title}</h1>
            {subtitle && (
              <p className="text-sm text-gray-400 mt-0.5 truncate">{subtitle}</p>
            )}
          </div>
          {actions && (
            <div className="flex items-center gap-2 flex-shrink-0">
              {actions}
            </div>
          )}
        </div>
      </div>

      {/* Page content */}
      <div
        className={`flex-1 overflow-y-auto relative ${noPadding ? "" : "p-6"}`}
      >
        {loading && (
          <div className="absolute inset-0 bg-surface-900/60 backdrop-blur-sm flex items-center justify-center z-10">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-3 border-sentinel-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-gray-400">Loading…</p>
            </div>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

export default PageContainer;