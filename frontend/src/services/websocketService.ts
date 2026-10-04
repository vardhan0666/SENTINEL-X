/**
 * Sentinel-X — WebSocket Service
 *
 * Connects to the existing backend WebSocket endpoint.
 *
 * Backend WebSocket manager:
 *   - Class: ConnectionManager (uses set<WebSocket> + asyncio.Lock)
 *   - Global instance: manager = ConnectionManager()
 *   - Broadcast message type: "event.created"
 *   - Messages are JSON-serializable dicts
 *
 * WebSocket URL:
 *   ws://localhost:8000/api/v1/ws   (or wss:// in production)
 *   Resolved from VITE_WS_URL env var, falling back to VITE_API_URL,
 *   falling back to ws://localhost:8000
 *
 * Features:
 *   - Automatic reconnect with exponential back-off (capped at 30 s)
 *   - Token-based authentication via URL query param or protocol header
 *   - Typed message dispatch via subscriber callbacks
 *   - Clean teardown via disconnect()
 *
 * This service is a singleton — one WebSocket connection for the entire app.
 * Subscribers register callbacks for specific message types.
 */

import { getAccessToken } from "./apiClient";

// ---------------------------------------------------------------------------
// WebSocket URL resolution
// ---------------------------------------------------------------------------

function _resolveWsBaseUrl(): string {
  const wsUrl = import.meta.env.VITE_WS_URL as string | undefined;
  if (wsUrl) return wsUrl.replace(/\/$/, "");

  const apiUrl = import.meta.env.VITE_API_URL as string | undefined;
  if (apiUrl) {
    // Convert http(s):// to ws(s)://
    return apiUrl.replace(/^http/, "ws").replace(/\/$/, "");
  }

  return "ws://localhost:8000";
}

const WS_BASE = _resolveWsBaseUrl();
const WS_ENDPOINT = `${WS_BASE}/api/v1/ws/events`;

// ---------------------------------------------------------------------------
// Message types — matching backend broadcast contracts
// ---------------------------------------------------------------------------

export interface WsMessage {
  type: string;
  data?: unknown;
  [key: string]: unknown;
}

export interface WsEventCreatedMessage extends WsMessage {
  type: "event.created";
  data: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Subscriber callback type
// ---------------------------------------------------------------------------

export type WsMessageHandler = (message: WsMessage) => void;

// ---------------------------------------------------------------------------
// Reconnect configuration
// ---------------------------------------------------------------------------

const RECONNECT_BASE_MS = 1_000;
const RECONNECT_MAX_MS = 30_000;
const RECONNECT_FACTOR = 2;

// ---------------------------------------------------------------------------
// WebSocket Service class
// ---------------------------------------------------------------------------

class WebSocketService {
  private _socket: WebSocket | null = null;
  private _subscribers: Map<string, Set<WsMessageHandler>> = new Map();
  private _globalSubscribers: Set<WsMessageHandler> = new Set();
  private _reconnectAttempt = 0;
  private _reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private _intentionalClose = false;
  private _connected = false;

  // ── Public API ────────────────────────────────────────────────────────

  /**
   * Open the WebSocket connection to the backend.
   * Attaches the current access token as a query parameter so the backend
   * can authenticate the connection.
   */
  connect(): void {
    if (this._socket && this._socket.readyState === WebSocket.OPEN) {
      return; // Already connected
    }

    this._intentionalClose = false;
    this._openSocket();
  }

  /**
   * Close the WebSocket connection permanently.
   * Does not reconnect.
   */
  disconnect(): void {
    this._intentionalClose = true;
    this._clearReconnectTimer();
    if (this._socket) {
      this._socket.close(1000, "Client disconnect");
      this._socket = null;
    }
    this._connected = false;
  }

  /**
   * Subscribe to a specific message type.
   * Returns an unsubscribe function.
   *
   * Example:
   *   const unsub = wsService.subscribe("event.created", handler);
   *   // later:
   *   unsub();
   */
  subscribe(messageType: string, handler: WsMessageHandler): () => void {
    if (!this._subscribers.has(messageType)) {
      this._subscribers.set(messageType, new Set());
    }
    this._subscribers.get(messageType)!.add(handler);

    return () => {
      const handlers = this._subscribers.get(messageType);
      if (handlers) {
        handlers.delete(handler);
        if (handlers.size === 0) {
          this._subscribers.delete(messageType);
        }
      }
    };
  }

  /**
   * Subscribe to ALL messages regardless of type.
   * Returns an unsubscribe function.
   */
  subscribeAll(handler: WsMessageHandler): () => void {
    this._globalSubscribers.add(handler);
    return () => {
      this._globalSubscribers.delete(handler);
    };
  }

  get isConnected(): boolean {
    return this._connected;
  }

  // ── Private ───────────────────────────────────────────────────────────

  private _openSocket(): void {
    const token = getAccessToken();
    const url = token
      ? `${WS_ENDPOINT}?token=${encodeURIComponent(token)}`
      : WS_ENDPOINT;

    try {
      this._socket = new WebSocket(url);
    } catch {
      this._scheduleReconnect();
      return;
    }

    this._socket.onopen = () => {
      this._connected = true;
      this._reconnectAttempt = 0;
    };

    this._socket.onmessage = (event: MessageEvent) => {
      this._handleMessage(event.data);
    };

    this._socket.onerror = () => {
      // onerror is always followed by onclose — reconnect there
    };

    this._socket.onclose = (event: CloseEvent) => {
      this._connected = false;
      this._socket = null;

      if (!this._intentionalClose && event.code !== 1000) {
        this._scheduleReconnect();
      }
    };
  }

  private _handleMessage(raw: unknown): void {
    if (typeof raw !== "string") return;

    let parsed: WsMessage;
    try {
      parsed = JSON.parse(raw) as WsMessage;
    } catch {
      return; // Not valid JSON — silently ignore
    }

    if (!parsed || typeof parsed.type !== "string") return;

    // Dispatch to type-specific subscribers
    const handlers = this._subscribers.get(parsed.type);
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          handler(parsed);
        } catch {
          // Individual handler errors must not crash the service
        }
      });
    }

    // Dispatch to global subscribers
    this._globalSubscribers.forEach((handler) => {
      try {
        handler(parsed);
      } catch {
        // Individual handler errors must not crash the service
      }
    });
  }

  private _scheduleReconnect(): void {
    this._clearReconnectTimer();
    const delay = Math.min(
      RECONNECT_BASE_MS * Math.pow(RECONNECT_FACTOR, this._reconnectAttempt),
      RECONNECT_MAX_MS
    );
    this._reconnectAttempt += 1;

    this._reconnectTimer = setTimeout(() => {
      if (!this._intentionalClose) {
        this._openSocket();
      }
    }, delay);
  }

  private _clearReconnectTimer(): void {
    if (this._reconnectTimer !== null) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }
  }
}

// ---------------------------------------------------------------------------
// Singleton export
// ---------------------------------------------------------------------------

export const wsService = new WebSocketService();

export default wsService;