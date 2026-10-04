import React, {
  useMemo,
  useState,
} from "react";
import {
  NavLink,
  useLocation,
} from "react-router-dom";
import {
  LayoutDashboard,
  Radio,
  Search,
  Bell,
  FolderOpen,
  Shield,
  BarChart3,
  Activity,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  Network,
  Command,
  LockKeyhole,
} from "lucide-react";

import type { UserRole } from "../../types/auth";
import { useAuth } from "../../hooks/useAuth";

interface NavItem {
  path: string;
  label: string;
  code: string;
  description: string;
  Icon: React.ElementType;
  roles?: UserRole[];
}

const NAV_ITEMS: NavItem[] = [
  {
    path: "/",
    label: "Overview",
    code: "01",
    description: "SOC command center",
    Icon: LayoutDashboard,
  },
  {
    path: "/events",
    label: "Live Events",
    code: "02",
    description: "Realtime telemetry",
    Icon: Radio,
  },
  {
    path: "/events/explorer",
    label: "Event Explorer",
    code: "03",
    description: "Deep event search",
    Icon: Search,
  },
  {
    path: "/alerts",
    label: "Alerts",
    code: "04",
    description: "Detection queue",
    Icon: Bell,
  },
  {
    path: "/incidents",
    label: "Incidents",
    code: "05",
    description: "Response operations",
    Icon: FolderOpen,
  },
  {
    path: "/threat-intel",
    label: "Threat Intel",
    code: "06",
    description: "Indicator intelligence",
    Icon: Shield,
    roles: [
      "ADMIN",
      "ANALYST",
    ],
  },
  {
    path: "/analytics",
    label: "Analytics",
    code: "07",
    description: "Security analytics",
    Icon: BarChart3,
  },
  {
    path: "/system",
    label: "System Health",
    code: "08",
    description: "Platform diagnostics",
    Icon: Activity,
    roles: ["ADMIN"],
  },
];

function navLinkClass(
  isActive: boolean,
  collapsed: boolean,
): string {
  const base = [
    "group",
    "relative",
    "flex",
    "items-center",
    "rounded-lg",
    "border",
    "transition-all",
    "duration-200",
    "focus:outline-none",
  ].join(" ");

  if (collapsed) {
    return [
      base,
      "justify-center",
      "px-2",
      "py-3",
      isActive
        ? "border-emerald-700/60 bg-emerald-400/[0.07] text-emerald-300 shadow-[0_0_25px_rgba(70,255,145,.06)]"
        : "border-transparent text-slate-600 hover:border-emerald-950 hover:bg-emerald-950/20 hover:text-emerald-300",
    ].join(" ");
  }

  return [
    base,
    "gap-3",
    "px-2.5",
    "py-2.5",
    isActive
      ? "border-emerald-800/70 bg-emerald-400/[0.055] text-emerald-200 shadow-[inset_0_0_25px_rgba(70,255,145,.025)]"
      : "border-transparent text-slate-500 hover:border-emerald-950/80 hover:bg-emerald-950/20 hover:text-slate-200",
  ].join(" ");
}

function BrandMark(): React.JSX.Element {
  return (
    <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-emerald-800/70 bg-emerald-400/[0.045] shadow-[0_0_28px_rgba(70,255,145,.06)]">
      <ShieldAlert
        size={18}
        className="text-emerald-200"
        aria-hidden="true"
      />

      <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-emerald-300 shadow-[0_0_9px_rgba(110,255,160,.9)]" />

      <span className="absolute -bottom-0.5 -left-0.5 h-1.5 w-1.5 rounded-full bg-white/70" />
    </div>
  );
}

export function Sidebar(): React.JSX.Element {
  const [
    collapsed,
    setCollapsed,
  ] = useState(false);

  const {
    user,
  } = useAuth();

  const location =
    useLocation();

  const role =
    user?.role as
      | UserRole
      | undefined;

  const visibleItems =
    useMemo(
      () =>
        NAV_ITEMS.filter(
          (item) => {
            if (!item.roles) {
              return true;
            }

            if (!role) {
              return false;
            }

            return item.roles.includes(
              role,
            );
          },
        ),
      [role],
    );

  const activeContext =
    useMemo(() => {
      if (
        location.pathname === "/"
      ) {
        return {
          code: "SOC-01",
          label: "COMMAND CENTER",
        };
      }

      if (
        location.pathname.startsWith(
          "/incidents/",
        )
      ) {
        return {
          code: "SOC-05",
          label: "INCIDENT DETAIL",
        };
      }

      const item =
        visibleItems.find(
          (navItem) =>
            navItem.path !==
              "/" &&
            location.pathname.startsWith(
              navItem.path,
            ),
        );

      return {
        code:
          item
            ? `SOC-${item.code}`
            : "SOC-X",
        label:
          item?.label
            .toUpperCase() ??
          "SECURITY MODULE",
      };
    }, [
      location.pathname,
      visibleItems,
    ]);

  return (
    <aside
      className={`relative flex h-full shrink-0 flex-col overflow-hidden border-r border-emerald-950/90 bg-[#030704] transition-all duration-300 ease-out ${
        collapsed
          ? "w-[68px]"
          : "w-[258px]"
      }`}
      aria-label="Main navigation"
    >
      <style>
        {`
          @keyframes sentinelSidebarScan {
            0% {
              transform: translateY(-120%);
            }

            100% {
              transform: translateY(120%);
            }
          }

          @keyframes sentinelSidebarPulse {
            0%,
            100% {
              opacity: .3;
            }

            50% {
              opacity: 1;
            }
          }

          .sentinel-sidebar-grid {
            background-image:
              linear-gradient(
                rgba(70,255,140,.028) 1px,
                transparent 1px
              ),
              linear-gradient(
                90deg,
                rgba(70,255,140,.028) 1px,
                transparent 1px
              );
            background-size: 28px 28px;
          }
        `}
      </style>

      <div className="pointer-events-none absolute inset-0">
        <div className="sentinel-sidebar-grid absolute inset-0 opacity-80" />

        <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-emerald-400/[0.02] to-transparent" />

        <div
          className="absolute left-0 right-0 h-20 bg-gradient-to-b from-transparent via-emerald-300/[0.018] to-transparent"
          style={{
            animation:
              "sentinelSidebarScan 8s linear infinite",
          }}
        />
      </div>

      <div className="relative z-10 flex shrink-0 items-center border-b border-emerald-950/80 px-3 py-4">
        <BrandMark />

        {!collapsed && (
          <div className="ml-3 min-w-0">
            <div className="text-sm font-black tracking-[0.24em] text-white">
              SENTINEL-X
            </div>

            <div className="mt-1 flex items-center gap-2">
              <span className="font-mono text-[8px] tracking-[0.18em] text-emerald-700">
                SOC PLATFORM
              </span>

              <span className="h-1 w-1 rounded-full bg-emerald-400/60" />

              <span className="font-mono text-[7px] tracking-[0.14em] text-slate-800">
                V1
              </span>
            </div>
          </div>
        )}

        {!collapsed && (
          <div className="ml-auto">
            <div className="flex items-center gap-1.5 rounded-md border border-emerald-950 bg-black/25 px-2 py-1">
              <span
                className="h-1.5 w-1.5 rounded-full bg-emerald-300"
                style={{
                  animation:
                    "sentinelSidebarPulse 1.4s ease-in-out infinite",
                }}
              />

              <span className="font-mono text-[7px] tracking-[0.14em] text-emerald-800">
                ONLINE
              </span>
            </div>
          </div>
        )}
      </div>

      {!collapsed && (
        <div className="relative z-10 border-b border-emerald-950/70 px-3 py-3">
          <div className="flex items-center justify-between">
            <div className="flex min-w-0 items-center gap-2">
              <Command
                size={13}
                className="shrink-0 text-emerald-800"
              />

              <span className="truncate font-mono text-[8px] font-bold tracking-[0.17em] text-slate-600">
                NAVIGATION MATRIX
              </span>
            </div>

            <span className="font-mono text-[7px] tracking-[0.13em] text-emerald-950">
              {activeContext.code}
            </span>
          </div>

          <div className="mt-2 flex items-center justify-between">
            <span className="truncate text-[9px] uppercase tracking-[0.14em] text-slate-700">
              {activeContext.label}
            </span>

            <Network
              size={11}
              className="text-emerald-950"
            />
          </div>
        </div>
      )}

      <nav
        className={`relative z-10 flex-1 overflow-y-auto ${
          collapsed
            ? "px-2 py-3"
            : "px-2.5 py-3"
        }`}
      >
        <div
          className={`mb-2 px-2 font-mono text-[7px] font-bold tracking-[0.22em] text-slate-800 ${
            collapsed
              ? "hidden"
              : "block"
          }`}
        >
          SECURITY MODULES
        </div>

        <div className="flex flex-col gap-1">
          {visibleItems.map(
            (item) => {
              const Icon =
                item.Icon;

              const isActive =
                item.path === "/"
                  ? location.pathname ===
                    "/"
                  : item.path ===
                      "/events"
                    ? location.pathname ===
                      "/events"
                    : location.pathname.startsWith(
                        item.path,
                      );

              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  data-cursor-target
                  className={navLinkClass(
                    isActive,
                    collapsed,
                  )}
                  aria-label={
                    collapsed
                      ? item.label
                      : undefined
                  }
                  title={
                    collapsed
                      ? item.label
                      : undefined
                  }
                >
                  {isActive && (
                    <span className="absolute left-0 top-1/2 h-7 w-0.5 -translate-y-1/2 rounded-full bg-emerald-300 shadow-[0_0_9px_rgba(110,255,160,.8)]" />
                  )}

                  <div
                    className={`relative flex shrink-0 items-center justify-center rounded-md transition-all duration-200 ${
                      collapsed
                        ? "h-9 w-9"
                        : "h-8 w-8"
                    } ${
                      isActive
                        ? "border border-emerald-800/60 bg-emerald-400/[0.055]"
                        : "border border-transparent"
                    }`}
                  >
                    <Icon
                      size={17}
                      className={
                        isActive
                          ? "text-emerald-200"
                          : "text-slate-600 transition-colors group-hover:text-emerald-300"
                      }
                      aria-hidden="true"
                    />

                    {isActive && (
                      <span className="absolute -right-0.5 -top-0.5 h-1 w-1 rounded-full bg-white" />
                    )}
                  </div>

                  {!collapsed && (
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`truncate text-[10px] font-bold tracking-[0.06em] ${
                            isActive
                              ? "text-white"
                              : "text-slate-500 group-hover:text-slate-200"
                          }`}
                        >
                          {item.label}
                        </span>

                        <span
                          className={`shrink-0 font-mono text-[7px] tracking-[0.14em] ${
                            isActive
                              ? "text-emerald-700"
                              : "text-slate-900 group-hover:text-emerald-950"
                          }`}
                        >
                          {item.code}
                        </span>
                      </div>

                      <div
                        className={`mt-0.5 truncate text-[8px] ${
                          isActive
                            ? "text-emerald-800"
                            : "text-slate-800 group-hover:text-slate-700"
                        }`}
                      >
                        {item.description}
                      </div>
                    </div>
                  )}

                  <span
                    className={`pointer-events-none absolute inset-y-0 left-0 w-20 -translate-x-full bg-gradient-to-r from-transparent via-emerald-300/[0.035] to-transparent transition-transform duration-700 group-hover:translate-x-[430%] ${
                      collapsed
                        ? "hidden"
                        : "block"
                    }`}
                  />
                </NavLink>
              );
            },
          )}
        </div>
      </nav>

      <div className="relative z-10 shrink-0 border-t border-emerald-950/80 p-2.5">
        {!collapsed && (
          <div className="mb-2 rounded-lg border border-emerald-950/70 bg-black/20 p-3">
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <LockKeyhole
                  size={12}
                  className="text-emerald-800"
                />

                <span className="font-mono text-[7px] tracking-[0.16em] text-slate-700">
                  OPERATOR SESSION
                </span>
              </div>

              <span className="font-mono text-[7px] text-emerald-950">
                SECURE
              </span>
            </div>

            <div className="truncate text-[10px] font-bold text-slate-400">
              {user?.username ??
                "UNKNOWN OPERATOR"}
            </div>

            <div className="mt-1 flex items-center gap-2">
              <span className="h-1 w-1 rounded-full bg-emerald-300" />

              <span className="font-mono text-[7px] tracking-[0.13em] text-emerald-800">
                {role ??
                  "VIEWER"}
              </span>

              <span className="text-[7px] text-slate-900">
                //
              </span>

              <span className="font-mono text-[7px] tracking-[0.13em] text-slate-800">
                AUTHORIZED
              </span>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={() =>
            setCollapsed(
              (current) =>
                !current,
            )
          }
          data-cursor-target
          className={`group relative flex w-full items-center rounded-lg border border-transparent py-2.5 text-slate-600 transition-all duration-200 hover:border-emerald-950 hover:bg-emerald-950/20 hover:text-emerald-300 focus:outline-none ${
            collapsed
              ? "justify-center px-2"
              : "gap-2 px-3"
          }`}
          aria-label={
            collapsed
              ? "Expand sidebar"
              : "Collapse sidebar"
          }
          title={
            collapsed
              ? "Expand sidebar"
              : "Collapse sidebar"
          }
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-md border border-emerald-950 bg-black/15 transition-colors group-hover:border-emerald-900">
            {collapsed ? (
              <ChevronRight
                size={15}
                aria-hidden="true"
              />
            ) : (
              <ChevronLeft
                size={15}
                aria-hidden="true"
              />
            )}
          </div>

          {!collapsed && (
            <div className="flex min-w-0 flex-1 items-center justify-between">
              <span className="text-[9px] font-bold tracking-[0.12em]">
                COLLAPSE MATRIX
              </span>

              <span className="font-mono text-[7px] tracking-[0.12em] text-slate-800 group-hover:text-emerald-900">
                UI
              </span>
            </div>
          )}
        </button>

        {!collapsed && (
          <div className="mt-2 flex items-center justify-between px-1">
            <div className="flex items-center gap-1.5">
              <span className="h-1 w-1 rounded-full bg-emerald-400" />

              <span className="font-mono text-[7px] tracking-[0.15em] text-slate-900">
                DEFENSIVE MODE
              </span>
            </div>

            <span className="font-mono text-[7px] text-emerald-950">
              SX-CORE
            </span>
          </div>
        )}
      </div>
    </aside>
  );
}

export default Sidebar;