import * as React from "react";
import { WS_TICKET_PROTOCOL } from "@nutriclinica/shared";

export interface ChatMessage {
  id: string;
  tokenId: string;
  pacienteId: string;
  sucursalId: string;
  profesionalId: string | null;
  content: string;
  direction: "patient_to_professional" | "professional_to_patient";
  readAt: string | null;
  createdAt: string | null;
}

interface UseRealtimeChatOptions {
  getWsConnection: () => Promise<{ url: string; ticket: string }>;
  fetchMessages: (signal?: AbortSignal) => Promise<ChatMessage[]>;
  sendMessage: (content: string) => Promise<void>;
  markAsRead: (messageId: string) => Promise<void>;
  pollInterval?: number;
}

export function useRealtimeChat(options: UseRealtimeChatOptions) {
  const {
    getWsConnection,
    fetchMessages,
    sendMessage,
    markAsRead: markMessageAsRead,
    pollInterval = 30_000,
  } = options;
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [isRealtime, setIsRealtime] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const wsRef = React.useRef<WebSocket | null>(null);
  const reconnectTimerRef = React.useRef<
    ReturnType<typeof setTimeout> | undefined
  >(undefined);
  const pollTimerRef = React.useRef<ReturnType<typeof setInterval> | undefined>(
    undefined,
  );
  const mountedRef = React.useRef(true);

  const loadMessages = React.useCallback(
    async (signal?: AbortSignal) => {
      try {
        const data = await fetchMessages(signal);
        if (mountedRef.current) {
          setMessages(data);
          setError(null);
        }
      } catch (err) {
        if (mountedRef.current && !signal?.aborted) {
          setError(err instanceof Error ? err.message : String(err));
        }
      } finally {
        if (mountedRef.current) {
          setLoading(false);
        }
      }
    },
    [fetchMessages],
  );

  React.useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  React.useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectDelay = 1000;

    async function connect() {
      if (!mountedRef.current) return;
      let connection: { url: string; ticket: string };
      try {
        connection = await getWsConnection();
      } catch {
        setIsRealtime(false);
        startPolling();
        return;
      }
      try {
        ws = new WebSocket(connection.url, [
          WS_TICKET_PROTOCOL,
          connection.ticket,
        ]);
      } catch {
        setIsRealtime(false);
        startPolling();
        return;
      }

      ws.onopen = () => {
        if (mountedRef.current) {
          setIsRealtime(true);
          reconnectDelay = 1000;
          stopPolling();
        }
      };

      ws.onmessage = (event) => {
        if (!mountedRef.current) return;
        try {
          const data = JSON.parse(event.data);
          if (data.type === "message:new" && data.message) {
            setMessages((prev) => {
              const exists = prev.some((m) => m.id === data.message.id);
              return exists ? prev : [...prev, data.message];
            });
          } else if (data.type === "message:read" && data.messageId) {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === data.messageId
                  ? { ...m, readAt: data.readAt ?? null }
                  : m,
              ),
            );
          }
        } catch {
          // Ignore malformed messages
        }
      };

      ws.onclose = () => {
        if (mountedRef.current) {
          setIsRealtime(false);
          startPolling();
          reconnectDelay = Math.min(reconnectDelay * 2, 30000);
          reconnectTimerRef.current = setTimeout(
            () => void connect(),
            reconnectDelay,
          );
        }
      };

      ws.onerror = () => {
        ws?.close();
      };

      wsRef.current = ws;
    }

    function startPolling() {
      if (pollTimerRef.current) return;
      pollTimerRef.current = setInterval(() => {
        if (mountedRef.current) {
          void loadMessages();
        }
      }, pollInterval);
    }

    function stopPolling() {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = undefined;
      }
    }

    // Initial load
    void loadMessages();

    // Try WebSocket
    void connect();

    return () => {
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      stopPolling();
      if (ws) {
        ws.onclose = null;
        ws.close();
      }
      wsRef.current = null;
    };
  }, [getWsConnection, loadMessages, pollInterval]);

  const send = React.useCallback(
    async (content: string) => {
      await sendMessage(content);
    },
    [sendMessage],
  );

  const markAsRead = React.useCallback(
    async (messageId: string) => {
      await markMessageAsRead(messageId);
    },
    [markMessageAsRead],
  );

  const refresh = React.useCallback(() => {
    setLoading(true);
    void loadMessages();
  }, [loadMessages]);

  return { messages, send, markAsRead, loading, error, isRealtime, refresh };
}
