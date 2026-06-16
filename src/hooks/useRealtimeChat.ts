import * as React from "react";

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
  wsUrl: string;
  fetchMessages: (signal?: AbortSignal) => Promise<ChatMessage[]>;
  sendMessage: (content: string) => Promise<void>;
  markAsRead: (messageId: string) => Promise<void>;
  pollInterval?: number;
}

export function useRealtimeChat(options: UseRealtimeChatOptions) {
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [isRealtime, setIsRealtime] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const wsRef = React.useRef<WebSocket | null>(null);
  const reconnectTimerRef = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pollTimerRef = React.useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const mountedRef = React.useRef(true);

  const loadMessages = React.useCallback(async (signal?: AbortSignal) => {
    try {
      const data = await options.fetchMessages(signal);
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
  }, [options.fetchMessages]);

  React.useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  React.useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectDelay = 1000;

    function connect() {
      if (!mountedRef.current) return;
      try {
        ws = new WebSocket(options.wsUrl);
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
                m.id === data.messageId ? { ...m, readAt: data.readAt ?? null } : m,
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
          reconnectTimerRef.current = setTimeout(connect, reconnectDelay);
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
        if (mountedRef.current && !isRealtime) {
          void loadMessages();
        }
      }, options.pollInterval ?? 30000);
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
    connect();

    return () => {
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      stopPolling();
      if (ws) {
        ws.onclose = null;
        ws.close();
      }
      wsRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.wsUrl, options.pollInterval]);

  const send = React.useCallback(async (content: string) => {
    await options.sendMessage(content);
  }, [options.sendMessage]);

  const markAsRead = React.useCallback(async (messageId: string) => {
    await options.markAsRead(messageId);
  }, [options.markAsRead]);

  const refresh = React.useCallback(() => {
    setLoading(true);
    void loadMessages();
  }, [loadMessages]);

  return { messages, send, markAsRead, loading, error, isRealtime, refresh };
}
