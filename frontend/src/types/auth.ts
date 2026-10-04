/**
 * Sentinel-X — Authentication Types
 *
 * Matches the backend authentication contracts.
 */

// ---------------------------------------------------------------------------
// Role
// ---------------------------------------------------------------------------

export type UserRole = "ADMIN" | "ANALYST" | "VIEWER";

// ---------------------------------------------------------------------------
// Login token response
// ---------------------------------------------------------------------------

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: "bearer";
}

// ---------------------------------------------------------------------------
// Refresh token response
// ---------------------------------------------------------------------------

export interface RefreshResponse {
  access_token: string;
  refresh_token: string;
  token_type: "bearer";
}

// ---------------------------------------------------------------------------
// JWT access token payload
// ---------------------------------------------------------------------------

export interface AccessTokenPayload {
  sub: string;
  type: "access";
  role: UserRole;
  exp: number;
  iat: number;
}

// ---------------------------------------------------------------------------
// JWT refresh token payload
// ---------------------------------------------------------------------------

export interface RefreshTokenPayload {
  sub: string;
  type: "refresh";
  exp: number;
  iat: number;
}

// ---------------------------------------------------------------------------
// User
// ---------------------------------------------------------------------------

export interface UserRead {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

// ---------------------------------------------------------------------------
// Login credentials
// ---------------------------------------------------------------------------

export interface LoginCredentials {
  username: string;
  password: string;
}

// ---------------------------------------------------------------------------
// Auth state
// ---------------------------------------------------------------------------

export interface AuthState {
  user: UserRead | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

// ---------------------------------------------------------------------------
// Auth context
// ---------------------------------------------------------------------------

export interface AuthContextValue extends AuthState {
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
}