/**
 * Sentinel-X — Authentication Context
 *
 * Provides application-wide authentication state and actions.
 *
 * Responsibilities:
 *   - Holds current user and token state
 *   - Restores sessions from sessionStorage
 *   - Refreshes expired access tokens
 *   - Keeps rotated access/refresh tokens synchronized
 *   - Connects/disconnects the realtime WebSocket
 */

import React, {
  createContext,
  useCallback,
  useEffect,
  useReducer,
  useRef,
} from "react";

import type {
  AuthContextValue,
  AuthState,
  LoginCredentials,
  UserRead,
} from "../types/auth";

import {
  getCurrentUser,
  login as authLogin,
  logout as authLogout,
  refreshAccessToken,
} from "../services/authService";

import {
  getAccessToken,
  getRefreshToken,
  ApiError,
} from "../services/apiClient";

import { wsService } from "../services/websocketService";

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

export const AuthContext = createContext<AuthContextValue | null>(null);

// ---------------------------------------------------------------------------
// State + reducer
// ---------------------------------------------------------------------------

type AuthAction =
  | { type: "SET_LOADING"; payload: boolean }
  | {
      type: "LOGIN_SUCCESS";
      payload: {
        user: UserRead;
        accessToken: string;
        refreshToken: string;
      };
    }
  | {
      type: "SET_TOKENS";
      payload: {
        accessToken: string;
        refreshToken: string;
      };
    }
  | { type: "LOGOUT" }
  | { type: "SET_USER"; payload: UserRead };

const initialState: AuthState = {
  user: null,
  accessToken: null,
  refreshToken: null,
  isAuthenticated: false,
  isLoading: true,
};

function authReducer(
  state: AuthState,
  action: AuthAction,
): AuthState {
  switch (action.type) {
    case "SET_LOADING":
      return {
        ...state,
        isLoading: action.payload,
      };

    case "LOGIN_SUCCESS":
      return {
        ...state,
        user: action.payload.user,
        accessToken: action.payload.accessToken,
        refreshToken: action.payload.refreshToken,
        isAuthenticated: true,
        isLoading: false,
      };

    case "SET_TOKENS":
      return {
        ...state,
        accessToken: action.payload.accessToken,
        refreshToken: action.payload.refreshToken,
      };

    case "LOGOUT":
      return {
        ...initialState,
        isLoading: false,
      };

    case "SET_USER":
      return {
        ...state,
        user: action.payload,
        isAuthenticated: true,
      };

    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({
  children,
}: AuthProviderProps): React.JSX.Element {
  const [state, dispatch] = useReducer(
    authReducer,
    initialState,
  );

  const initRef = useRef(false);

  // -------------------------------------------------------------------------
  // Logout
  // -------------------------------------------------------------------------

  const performLogout = useCallback((): void => {
    authLogout();
    wsService.disconnect();

    dispatch({
      type: "LOGOUT",
    });
  }, []);

  // -------------------------------------------------------------------------
  // Restore session
  // -------------------------------------------------------------------------

  const restoreSession = useCallback(async (): Promise<void> => {
    const accessToken = getAccessToken();
    const refreshToken = getRefreshToken();

    if (!accessToken && !refreshToken) {
      dispatch({
        type: "SET_LOADING",
        payload: false,
      });
      return;
    }

    try {
      const user = await getCurrentUser();

      dispatch({
        type: "LOGIN_SUCCESS",
        payload: {
          user,
          accessToken: accessToken ?? "",
          refreshToken: refreshToken ?? "",
        },
      });

      wsService.connect();
    } catch (error) {
      if (
        error instanceof ApiError &&
        error.status === 401 &&
        refreshToken
      ) {
        try {
          const refreshed = await refreshAccessToken();
          const user = await getCurrentUser();

          dispatch({
            type: "LOGIN_SUCCESS",
            payload: {
              user,
              accessToken: refreshed.access_token,
              refreshToken: refreshed.refresh_token,
            },
          });

          wsService.connect();
        } catch {
          performLogout();
        }
      } else {
        performLogout();
      }
    }
  }, [performLogout]);

  // -------------------------------------------------------------------------
  // Initial session restore
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (initRef.current) {
      return;
    }

    initRef.current = true;

    void restoreSession();
  }, [restoreSession]);

  // -------------------------------------------------------------------------
  // Login
  // -------------------------------------------------------------------------

  const login = useCallback(
    async (credentials: LoginCredentials): Promise<void> => {
      dispatch({
        type: "SET_LOADING",
        payload: true,
      });

      try {
        const tokenResponse = await authLogin(credentials);
        const user = await getCurrentUser();

        dispatch({
          type: "LOGIN_SUCCESS",
          payload: {
            user,
            accessToken: tokenResponse.access_token,
            refreshToken: tokenResponse.refresh_token,
          },
        });

        wsService.connect();
      } catch (error) {
        dispatch({
          type: "SET_LOADING",
          payload: false,
        });

        throw error;
      }
    },
    [],
  );

  // -------------------------------------------------------------------------
  // Logout
  // -------------------------------------------------------------------------

  const logout = useCallback((): void => {
    performLogout();
  }, [performLogout]);

  // -------------------------------------------------------------------------
  // Refresh
  // -------------------------------------------------------------------------

  const refresh = useCallback(async (): Promise<void> => {
    try {
      const refreshed = await refreshAccessToken();

      dispatch({
        type: "SET_TOKENS",
        payload: {
          accessToken: refreshed.access_token,
          refreshToken: refreshed.refresh_token,
        },
      });
    } catch {
      performLogout();
    }
  }, [performLogout]);

  // -------------------------------------------------------------------------
  // Context value
  // -------------------------------------------------------------------------

  const contextValue: AuthContextValue = {
    ...state,
    login,
    logout,
    refresh,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

export default AuthProvider;