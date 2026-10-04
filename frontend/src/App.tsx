import React from "react";
import {
  Navigate,
  Route,
  Routes,
} from "react-router-dom";

import { useAuth } from "./hooks/useAuth";

import LoginPage from "./pages/LoginPage";
import OverviewPage from "./pages/OverviewPage";
import LiveEventsPage from "./pages/LiveEventsPage";
import EventExplorerPage from "./pages/EventExplorerPage";
import AlertsPage from "./pages/AlertsPage";
import IncidentsPage from "./pages/IncidentsPage";
import IncidentDetailPage from "./pages/IncidentDetailPage";
import ThreatIntelPage from "./pages/ThreatIntelPage";
import AnalyticsPage from "./pages/AnalyticsPage";
import SystemHealthPage from "./pages/SystemHealthPage";

import Sidebar from "./components/layout/Sidebar";
import Topbar from "./components/layout/Topbar";
import GlobalTacticalCursor from "./components/layout/GlobalTacticalCursor";

function ProtectedApplication(): React.JSX.Element {
  const {
    isAuthenticated,
    isLoading,
  } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#010402] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="relative h-10 w-10">
            <div className="absolute inset-0 rounded-full border border-emerald-900/60" />
            <div className="absolute inset-0 animate-spin rounded-full border border-emerald-300 border-r-transparent border-b-transparent" />
            <div className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rotate-45 bg-emerald-300 shadow-[0_0_12px_rgba(110,255,160,.8)]" />
          </div>

          <p className="font-mono text-[9px] tracking-[0.2em] text-emerald-600">
            LOADING SENTINEL-X...
          </p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Navigate
        to="/login"
        replace
      />
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#010402] text-white">
      <Sidebar />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Topbar />

        <main className="min-h-0 flex-1 overflow-hidden">
          <Routes>
            <Route
              path="/"
              element={<OverviewPage />}
            />

            <Route
              path="/events"
              element={<LiveEventsPage />}
            />

            <Route
              path="/events/explorer"
              element={<EventExplorerPage />}
            />

            <Route
              path="/alerts"
              element={<AlertsPage />}
            />

            <Route
              path="/incidents"
              element={<IncidentsPage />}
            />

            <Route
              path="/incidents/:id"
              element={<IncidentDetailPage />}
            />

            <Route
              path="/threat-intel"
              element={<ThreatIntelPage />}
            />

            <Route
              path="/analytics"
              element={<AnalyticsPage />}
            />

            <Route
              path="/system"
              element={<SystemHealthPage />}
            />

            <Route
              path="*"
              element={
                <Navigate
                  to="/"
                  replace
                />
              }
            />
          </Routes>
        </main>
      </div>
    </div>
  );
}

function App(): React.JSX.Element {
  const {
    isAuthenticated,
    isLoading,
  } = useAuth();

  if (isLoading) {
    return (
      <>
        <GlobalTacticalCursor />

        <div className="min-h-screen bg-[#010402] flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="relative h-10 w-10">
              <div className="absolute inset-0 rounded-full border border-emerald-900/60" />

              <div className="absolute inset-0 animate-spin rounded-full border border-emerald-300 border-r-transparent border-b-transparent" />

              <div className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rotate-45 bg-emerald-300 shadow-[0_0_12px_rgba(110,255,160,.8)]" />
            </div>

            <p className="font-mono text-[9px] tracking-[0.2em] text-emerald-600">
              INITIALIZING SENTINEL-X...
            </p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <GlobalTacticalCursor />

      <Routes>
        <Route
          path="/login"
          element={
            isAuthenticated ? (
              <Navigate
                to="/"
                replace
              />
            ) : (
              <LoginPage />
            )
          }
        />

        <Route
          path="/*"
          element={
            <ProtectedApplication />
          }
        />
      </Routes>
    </>
  );
}

export default App;