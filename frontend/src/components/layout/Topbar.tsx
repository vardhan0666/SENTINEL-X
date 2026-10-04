import React, {
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  Wifi,
  WifiOff,
  User,
  LogOut,
  ChevronDown,
  Bell,
  ShieldCheck,
  Activity,
  Clock3,
  Terminal,
  CircleDot,
} from "lucide-react";
import {
  useLocation,
  useNavigate,
} from "react-router-dom";

import { useAuth } from "../../hooks/useAuth";
import { useWebSocket } from "../../hooks/useWebSocket";
import type { UserRole } from "../../types/auth";

const ROLE_STYLES: Record<UserRole, string> = {
  ADMIN:
    "border-red-900/70 bg-red-950/30 text-red-300",
  ANALYST:
    "border-emerald-900/70 bg-emerald-950/30 text-emerald-300",
  VIEWER:
    "border-slate-800 bg-slate-950/50 text-slate-400",
};

const PAGE_CONTEXT: Record<
  string,
  {
    code: string;
    label: string;
  }
> = {
  "/": {
    code: "SOC-01",
    label: "SECURITY OVERVIEW",
  },
  "/events": {
    code: "SOC-02",
    label: "LIVE EVENTS",
  },
  "/events/explorer": {
    code: "SOC-03",
    label: "EVENT EXPLORER",
  },
  "/alerts": {
    code: "SOC-04",
    label: "ALERT MONITOR",
  },
  "/incidents": {
    code: "SOC-05",
    label: "INCIDENT RESPONSE",
  },
  "/threat-intel": {
    code: "SOC-06",
    label: "THREAT INTELLIGENCE",
  },
  "/analytics": {
    code: "SOC-07",
    label: "SECURITY ANALYTICS",
  },
  "/system": {
    code: "SOC-08",
    label: "SYSTEM HEALTH",
  },
};

function getPageContext(
  pathname: string,
): {
  code: string;
  label: string;
} {
  if (
    pathname.startsWith(
      "/incidents/",
    )
  ) {
    return {
      code: "SOC-05",
      label: "INCIDENT DETAIL",
    };
  }

  if (
    pathname.startsWith(
      "/events/explorer",
    )
  ) {
    return PAGE_CONTEXT[
      "/events/explorer"
    ];
  }

  for (const [
    path,
    context,
  ] of Object.entries(
    PAGE_CONTEXT,
  )) {
    if (
      path !== "/" &&
      pathname.startsWith(path)
    ) {
      return context;
    }
  }

  return PAGE_CONTEXT["/"];
}

function ConnectionIndicator({
  connected,
}: {
  connected: boolean;
}): React.JSX.Element {
  return (
    <div
      className={`group relative flex items-center gap-2 rounded-md border px-2.5 py-1.5 transition-all duration-300 ${
        connected
          ? "border-emerald-900/80 bg-emerald-950/20"
          : "border-red-900/70 bg-red-950/20"
      }`}
      title={
        connected
          ? "Live feed connected"
          : "Live feed disconnected"
      }
    >
      <span className="relative flex h-2 w-2">
        <span
          className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-40 ${
            connected
              ? "bg-emerald-300"
              : "bg-red-400"
          }`}
        />

        <span
          className={`relative inline-flex h-2 w-2 rounded-full ${
            connected
              ? "bg-emerald-300"
              : "bg-red-400"
          }`}
        />
      </span>

      {connected ? (
        <Wifi
          size={12}
          className="text-emerald-300"
          aria-hidden="true"
        />
      ) : (
        <WifiOff
          size={12}
          className="text-red-300"
          aria-hidden="true"
        />
      )}

      <span
        className={`font-mono text-[8px] font-bold tracking-[0.16em] ${
          connected
            ? "text-emerald-300"
            : "text-red-300"
        }`}
      >
        {connected
          ? "LIVE LINK"
          : "OFFLINE"}
      </span>

      <span
        className={`hidden text-[7px] tracking-[0.12em] sm:inline ${
          connected
            ? "text-emerald-900"
            : "text-red-900"
        }`}
      >
        /
        {connected
          ? " STREAM"
          : " RETRY"}
      </span>
    </div>
  );
}

function UserMenu(): React.JSX.Element {
  const {
    user,
    logout,
  } = useAuth();

  const navigate =
    useNavigate();

  const [
    open,
    setOpen,
  ] = useState(false);

  const role =
    user?.role as
      | UserRole
      | undefined;

  const roleStyle =
    role
      ? ROLE_STYLES[role]
      : ROLE_STYLES.VIEWER;

  const handleLogout =
    (): void => {
      setOpen(false);
      logout();

      navigate(
        "/login",
        {
          replace: true,
        },
      );
    };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() =>
          setOpen(
            (current) =>
              !current,
          )
        }
        data-cursor-target
        className="group flex items-center gap-2 rounded-lg border border-transparent px-2 py-1.5 transition-all duration-200 hover:border-emerald-950 hover:bg-emerald-950/20 focus:outline-none"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Operator menu"
      >
        <div className="relative flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-900/70 bg-emerald-400/[0.045]">
          <User
            size={14}
            className="text-emerald-200"
            aria-hidden="true"
          />

          <span className="absolute bottom-0 right-0 h-2 w-2 rounded-full border border-[#050a07] bg-emerald-300" />
        </div>

        <div className="hidden min-w-0 sm:flex sm:flex-col sm:items-start">
          <span className="max-w-[120px] truncate text-[10px] font-bold tracking-wide text-slate-200">
            {user?.username ??
              "UNKNOWN"}
          </span>

          {role && (
            <span
              className={`mt-0.5 rounded border px-1.5 py-0.5 font-mono text-[7px] font-bold tracking-[0.14em] ${roleStyle}`}
            >
              {role}
            </span>
          )}
        </div>

        <ChevronDown
          size={12}
          className={`text-slate-700 transition-transform duration-200 ${
            open
              ? "rotate-180 text-emerald-400"
              : ""
          }`}
          aria-hidden="true"
        />
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() =>
              setOpen(false)
            }
            aria-hidden="true"
          />

          <div
            role="menu"
            className="absolute right-0 top-full z-50 mt-2 w-64 overflow-hidden rounded-xl border border-emerald-900/70 bg-[#040805]/95 shadow-[0_20px_70px_rgba(0,0,0,.55)] backdrop-blur-2xl"
          >
            <div className="relative border-b border-emerald-950/80 px-4 py-4">
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/40 to-transparent" />

              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldCheck
                    size={14}
                    className="text-emerald-300"
                  />

                  <span className="font-mono text-[8px] font-bold tracking-[0.18em] text-emerald-600">
                    OPERATOR PROFILE
                  </span>
                </div>

                <span className="font-mono text-[7px] tracking-[0.16em] text-emerald-950">
                  AUTHORIZED
                </span>
              </div>

              <p className="text-sm font-bold text-white">
                {user?.username ??
                  "—"}
              </p>

              <p className="mt-1 truncate text-[10px] text-slate-600">
                {user?.email ??
                  "No operator email"}
              </p>

              <div className="mt-3 flex items-center justify-between rounded-md border border-emerald-950 bg-black/25 px-2.5 py-2">
                <span className="font-mono text-[7px] tracking-[0.16em] text-slate-700">
                  ACCESS LEVEL
                </span>

                <span
                  className={`rounded border px-1.5 py-0.5 font-mono text-[7px] font-bold tracking-[0.12em] ${roleStyle}`}
                >
                  {role ??
                    "VIEWER"}
                </span>
              </div>
            </div>

            <div className="border-b border-emerald-950/80 px-4 py-3">
              <div className="mb-2 flex items-center gap-2">
                <Terminal
                  size={12}
                  className="text-emerald-800"
                />

                <span className="font-mono text-[7px] tracking-[0.16em] text-slate-700">
                  SESSION STATUS
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-300" />

                <span className="font-mono text-[9px] text-emerald-300">
                  SECURE SESSION ACTIVE
                </span>
              </div>
            </div>

            <button
              type="button"
              role="menuitem"
              onClick={
                handleLogout
              }
              data-cursor-target
              className="group flex w-full items-center gap-2.5 px-4 py-3 text-left transition-colors hover:bg-red-950/20"
            >
              <LogOut
                size={14}
                className="text-slate-700 transition-colors group-hover:text-red-300"
                aria-hidden="true"
              />

              <div>
                <div className="text-[10px] font-bold text-slate-400 group-hover:text-red-300">
                  Terminate Session
                </div>

                <div className="mt-0.5 font-mono text-[7px] tracking-[0.14em] text-slate-800">
                  RETURN TO ACCESS GATE
                </div>
              </div>
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export function Topbar(): React.JSX.Element {
  const {
    isConnected,
  } = useWebSocket();

  const location =
    useLocation();

  const [time, setTime] =
    useState(
      new Date(),
    );

  const context =
    useMemo(
      () =>
        getPageContext(
          location.pathname,
        ),
      [location.pathname],
    );

  useEffect(() => {
    const timer =
      window.setInterval(
        () => {
          setTime(
            new Date(),
          );
        },
        1000,
      );

    return () => {
      window.clearInterval(
        timer,
      );
    };
  }, []);

  return (
    <header className="relative z-30 flex h-14 flex-shrink-0 items-center justify-between overflow-hidden border-b border-emerald-950/80 bg-[#030704]/96 px-3 shadow-[0_8px_35px_rgba(0,0,0,.25)] sm:px-5">
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-emerald-400/20 to-transparent" />

      <div className="pointer-events-none absolute left-0 right-0 top-0 h-8 bg-gradient-to-b from-emerald-400/[0.018] to-transparent" />

      <div className="flex min-w-0 items-center gap-3">
        <div className="hidden items-center gap-2 xl:flex">
          <div className="relative flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-900/70 bg-emerald-400/[0.035]">
            <CrosshairIcon />

            <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-emerald-300" />
          </div>
        </div>

        <div className="hidden min-w-0 md:block">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[7px] tracking-[0.2em] text-emerald-900">
              {context.code}
            </span>

            <span className="h-1 w-1 rounded-full bg-emerald-500/50" />

            <span className="truncate text-[10px] font-bold tracking-[0.15em] text-slate-300">
              {context.label}
            </span>
          </div>

          <div className="mt-0.5 flex items-center gap-2">
            <span className="font-mono text-[7px] tracking-[0.15em] text-slate-800">
              SENTINEL-X COMMAND FABRIC
            </span>

            <span className="text-[7px] text-slate-900">
              //
            </span>

            <span className="font-mono text-[7px] tracking-[0.15em] text-emerald-950">
              DEFENSIVE MODE
            </span>
          </div>
        </div>

        <ConnectionIndicator
          connected={
            isConnected
          }
        />
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <div className="hidden items-center gap-2 rounded-md border border-emerald-950 bg-black/20 px-2.5 py-1.5 lg:flex">
          <Activity
            size={12}
            className={
              isConnected
                ? "text-emerald-300"
                : "text-red-300"
            }
          />

          <span className="font-mono text-[7px] tracking-[0.16em] text-slate-700">
            TELEMETRY
          </span>

          <span className="font-mono text-[8px] font-bold text-slate-400">
            {isConnected
              ? "STREAMING"
              : "PAUSED"}
          </span>
        </div>

        <div className="hidden items-center gap-2 rounded-md border border-emerald-950 bg-black/20 px-2.5 py-1.5 sm:flex">
          <Clock3
            size={11}
            className="text-emerald-800"
          />

          <span className="font-mono text-[9px] text-emerald-400">
            {time.toLocaleTimeString(
              [],
              {
                hour12:
                  false,
              },
            )}
          </span>
        </div>

        <div className="hidden items-center gap-1.5 font-mono text-[7px] tracking-[0.16em] text-slate-800 xl:flex">
          <CircleDot
            size={10}
            className="animate-pulse text-emerald-700"
          />

          NODE ACTIVE
        </div>

        <button
          type="button"
          data-cursor-target
          className="relative rounded-lg border border-transparent p-2 text-slate-600 transition-all duration-200 hover:border-emerald-950 hover:bg-emerald-950/20 hover:text-emerald-300 focus:outline-none"
          aria-label="Notifications"
        >
          <Bell
            size={16}
            aria-hidden="true"
          />

          <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-emerald-300 shadow-[0_0_8px_rgba(110,255,160,.8)]" />
        </button>

        <UserMenu />
      </div>
    </header>
  );
}

function CrosshairIcon(): React.JSX.Element {
  return (
    <div className="relative h-4 w-4">
      <span className="absolute left-1/2 top-0 h-1.5 w-px -translate-x-1/2 bg-emerald-300" />

      <span className="absolute bottom-0 left-1/2 h-1.5 w-px -translate-x-1/2 bg-emerald-300" />

      <span className="absolute left-0 top-1/2 h-px w-1.5 -translate-y-1/2 bg-emerald-300" />

      <span className="absolute right-0 top-1/2 h-px w-1.5 -translate-y-1/2 bg-emerald-300" />

      <span className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rotate-45 border border-emerald-200 bg-emerald-400/30" />
    </div>
  );
}

export default Topbar;