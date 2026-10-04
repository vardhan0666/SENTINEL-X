/**
 * Sentinel-X — useAuth Hook
 *
 * Provides access to the AuthContext value.
 *
 * Must be used within an <AuthProvider>.
 * Throws a descriptive error if used outside of the provider to aid
 * development-time debugging.
 *
 * Usage:
 *   const { user, isAuthenticated, login, logout } = useAuth();
 */

import { useContext } from "react";
import { AuthContext } from "../context/AuthContext";
import type { AuthContextValue } from "../types/auth";

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (context === null) {
    throw new Error(
      "useAuth() must be used within an <AuthProvider>. " +
        "Ensure that <AuthProvider> wraps your component tree in App.tsx."
    );
  }

  return context;
}

export default useAuth;