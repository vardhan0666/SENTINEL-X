/**
 * Sentinel-X — Authentication Service
 *
 * Implements:
 *   POST /api/v1/auth/login
 *   POST /api/v1/auth/refresh
 *   GET  /api/v1/auth/me
 *
 * Tokens are persisted in sessionStorage.
 */

import apiClient, {
  clearTokens,
  getRefreshToken,
  setTokens,
} from "./apiClient";

import type {
  LoginCredentials,
  RefreshResponse,
  TokenResponse,
  UserRead,
} from "../types/auth";

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------

export async function login(
  credentials: LoginCredentials,
): Promise<TokenResponse> {
  const tokenResponse = await apiClient.postForm<TokenResponse>(
    "/auth/login",
    {
      username: credentials.username,
      password: credentials.password,
    },
    { auth: null },
  );

  setTokens(
    tokenResponse.access_token,
    tokenResponse.refresh_token,
  );

  return tokenResponse;
}

// ---------------------------------------------------------------------------
// Refresh
// ---------------------------------------------------------------------------

export async function refreshAccessToken(): Promise<RefreshResponse> {
  const refreshToken = getRefreshToken();

  if (!refreshToken) {
    throw new Error("No refresh token available");
  }

  const response = await apiClient.post<RefreshResponse>(
    "/auth/refresh",
    {
      refresh_token: refreshToken,
    },
    { auth: null },
  );

  // Backend rotates BOTH tokens.
  setTokens(
    response.access_token,
    response.refresh_token,
  );

  return response;
}

// ---------------------------------------------------------------------------
// Current user
// ---------------------------------------------------------------------------

export async function getCurrentUser(): Promise<UserRead> {
  return apiClient.get<UserRead>("/auth/me");
}

// ---------------------------------------------------------------------------
// Logout
// ---------------------------------------------------------------------------

export function logout(): void {
  clearTokens();
}