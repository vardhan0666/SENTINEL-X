/**
 * Sentinel-X — useWebSocket Hook
 *
 * Manages WebSocket subscription lifecycle for React components.
 *
 * Wraps the wsService singleton and ensures subscriptions are cleaned
 * up when the component unmounts or dependencies change.
 *
 * Features:
 *   - Subscribe to a specific message type (e.g. "event.created")
 *   - Subscribe to all messages
 *   - Track connection status reactively
 *   - Auto-unsubscribe on unmount
 *
 * Usage — subscribe to live events:
 *
 *   const { isConnected } = useWebSocket("event.created", (msg) => {
 *     const event = msg.data as EventRead;
 *     setEvents((prev) => [event, ...prev]);
 *   });
 *
 * Usage — subscribe to all messages:
 *
 *   useWebSocket(null, (msg) => {
 *     console.log("WS message:", msg.type);
 *   });
 *
 * Usage — observe connection status only:
 *
 *   const { isConnected } = useWebSocket();
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { wsService, type WsMessage, type WsMessageHandler } from "../services/websocketService";

// ---------------------------------------------------------------------------
// Connection status polling interval
// Polls wsService.isConnected every N ms to update the reactive state.
// ---------------------------------------------------------------------------

const CONNECTION_POLL_MS = 2_000;

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useWebSocket(
  /** Message type to subscribe to, or null to subscribe to all messages */
  messageType?: string | null,
  /** Handler called when a matching message arrives */
  handler?: WsMessageHandler
): { isConnected: boolean } {
  const [isConnected, setIsConnected] = useState<boolean>(
    wsService.isConnected
  );

  // Keep handler in a ref so the effect closure never stales
  const handlerRef = useRef<WsMessageHandler | undefined>(handler);
  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  // ── Subscription lifecycle ─────────────────────────────────────────────
  useEffect(() => {
    if (!handlerRef.current) return;

    const stableHandler: WsMessageHandler = (msg: WsMessage) => {
      handlerRef.current?.(msg);
    };

    let unsubscribe: (() => void) | undefined;

    if (messageType === null || messageType === undefined) {
      // Subscribe to all message types
      unsubscribe = wsService.subscribeAll(stableHandler);
    } else {
      // Subscribe to the specific message type
      unsubscribe = wsService.subscribe(messageType, stableHandler);
    }

    return () => {
      unsubscribe?.();
    };
  }, [messageType]); // Re-subscribe only when messageType changes

  // ── Connection status polling ──────────────────────────────────────────
  useEffect(() => {
    // Initial sync
    setIsConnected(wsService.isConnected);

    const interval = setInterval(() => {
      setIsConnected(wsService.isConnected);
    }, CONNECTION_POLL_MS);

    return () => {
      clearInterval(interval);
    };
  }, []);

  return { isConnected };
}

/**
 * Convenience hook — subscribe specifically to "event.created" messages.
 *
 * Usage:
 *   useLiveEvents((event) => setEvents(prev => [event, ...prev]));
 */
export function useLiveEvents(
  onEvent: (event: WsMessage["data"]) => void
): { isConnected: boolean } {
  const stableOnEvent = useCallback(
    (msg: WsMessage) => {
      onEvent(msg.data);
    },
    [onEvent]
  );

  return useWebSocket("event.created", stableOnEvent);
}

export default useWebSocket;