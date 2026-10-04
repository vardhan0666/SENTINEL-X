/**
 * Sentinel-X — Central API Client
 *
 * A thin wrapper around the Fetch API that:
 *   - Resolves the base URL from the Vite environment (VITE_API_URL)
 *   - Automatically attaches the Bearer token from sessionStorage
 *   - Serialises request bodies as JSON
 *   - Deserialises JSON responses
 *   - Exposes typed error handling via ApiError
 *   - Does NOT handle 401 refresh internally (AuthContext handles that)
 *
 * Base URL resolution order:
 *   1. import.meta.env.VITE_API_URL  (set in .env / docker-compose)
 *   2. http://localhost:8000          (local development fallback)
 *
 * Token storage:
 *   sessionStorage is used so tokens do not persist across browser sessions.
 *   AuthContext reads from here after restoring state.
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BASE_URL: string =
  (import.meta.env.VITE_API_URL as string | undefined) ??
  "http://localhost:8000";

export const API_PREFIX = "/api/v1";
export const API_BASE = `${BASE_URL}${API_PREFIX}`;

// ---------------------------------------------------------------------------
// Token storage keys
// ---------------------------------------------------------------------------

export const TOKEN_KEYS = {
  ACCESS: "sentinelx_access_token",
  REFRESH: "sentinelx_refresh_token",
} as const;

// ---------------------------------------------------------------------------
// Token helpers — used by apiClient and authService
// ---------------------------------------------------------------------------

export function getAccessToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEYS.ACCESS);
}

export function getRefreshToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEYS.REFRESH);
}

export function setTokens(access: string, refresh: string): void {
  sessionStorage.setItem(TOKEN_KEYS.ACCESS, access);
  sessionStorage.setItem(TOKEN_KEYS.REFRESH, refresh);
}

export function setAccessToken(access: string): void {
  sessionStorage.setItem(TOKEN_KEYS.ACCESS, access);
}

export function clearTokens(): void {
  sessionStorage.removeItem(TOKEN_KEYS.ACCESS);
  sessionStorage.removeItem(TOKEN_KEYS.REFRESH);
}

// ---------------------------------------------------------------------------
// ApiError — structured error from the backend or network
// ---------------------------------------------------------------------------

export class ApiError extends Error {
  public readonly status: number;
  public readonly detail: string;
  public readonly raw: unknown;

  constructor(status: number, detail: string, raw?: unknown) {
    super(`API Error ${status}: ${detail}`);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
    this.raw = raw;
  }
}

// ---------------------------------------------------------------------------
// Request options
// ---------------------------------------------------------------------------

export interface ApiRequestOptions {
  /** Override the Authorization header (pass null to omit auth) */
  auth?: string | null;
  /** Additional headers to merge */
  headers?: Record<string, string>;
  /** Request body (will be JSON-serialised) */
  body?: unknown;
  /** Raw signal for abort */
  signal?: AbortSignal;
}

// ---------------------------------------------------------------------------
// Core request function
// ---------------------------------------------------------------------------

async function request<T>(
  method: string,
  path: string,
  options: ApiRequestOptions = {}
): Promise<T> {
  const url = path.startsWith("http") ? path : `${API_BASE}${path}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  // Attach bearer token unless explicitly suppressed
  if (options.auth !== null) {
    const token = options.auth ?? getAccessToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
  }

  const init: RequestInit = {
    method,
    headers,
    signal: options.signal,
  };

  if (options.body !== undefined) {
    init.body = JSON.stringify(options.body);
  }

  let response: Response;
  try {
    response = await fetch(url, init);
  } catch (networkError) {
    throw new ApiError(0, "Network error — backend unreachable", networkError);
  }

  // Parse response body
  let responseBody: unknown;
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    try {
      responseBody = await response.json();
    } catch {
      responseBody = null;
    }
  } else {
    try {
      responseBody = await response.text();
    } catch {
      responseBody = null;
    }
  }

  if (!response.ok) {
    const detail =
      typeof responseBody === "object" &&
      responseBody !== null &&
      "detail" in responseBody
        ? String((responseBody as Record<string, unknown>)["detail"])
        : response.statusText || `HTTP ${response.status}`;

    throw new ApiError(response.status, detail, responseBody);
  }

  return responseBody as T;
}

// ---------------------------------------------------------------------------
// HTTP method shortcuts
// ---------------------------------------------------------------------------

export const apiClient = {
  get<T>(path: string, options?: Omit<ApiRequestOptions, "body">): Promise<T> {
    return request<T>("GET", path, options);
  },

  post<T>(
    path: string,
    body?: unknown,
    options?: ApiRequestOptions
  ): Promise<T> {
    return request<T>("POST", path, { ...options, body });
  },

  put<T>(
    path: string,
    body?: unknown,
    options?: ApiRequestOptions
  ): Promise<T> {
    return request<T>("PUT", path, { ...options, body });
  },

  patch<T>(
    path: string,
    body?: unknown,
    options?: ApiRequestOptions
  ): Promise<T> {
    return request<T>("PATCH", path, { ...options, body });
  },

  delete<T>(path: string, options?: Omit<ApiRequestOptions, "body">): Promise<T> {
    return request<T>("DELETE", path, options);
  },

  /**
   * POST with application/x-www-form-urlencoded body.
   * Used exclusively for the OAuth2 login endpoint.
   */
  async postForm<T>(
    path: string,
    data: Record<string, string>,
    options?: Omit<ApiRequestOptions, "body">
  ): Promise<T> {
    const url = path.startsWith("http") ? path : `${API_BASE}${path}`;

    const headers: Record<string, string> = {
      "Content-Type": "application/x-www-form-urlencoded",
      ...(options?.headers ?? {}),
    };

    // Form-encoded login does not send a bearer token
    const init: RequestInit = {
      method: "POST",
      headers,
      body: new URLSearchParams(data).toString(),
      signal: options?.signal,
    };

    let response: Response;
    try {
      response = await fetch(url, init);
    } catch (networkError) {
      throw new ApiError(0, "Network error", networkError);
    }

    let responseBody: unknown;
    try {
      responseBody = await response.json();
    } catch {
      responseBody = null;
    }

    if (!response.ok) {
      const detail =
        typeof responseBody === "object" &&
        responseBody !== null &&
        "detail" in responseBody
          ? String((responseBody as Record<string, unknown>)["detail"])
          : response.statusText;
      throw new ApiError(response.status, detail, responseBody);
    }

    return responseBody as T;
  },
} as const;

export default apiClient;