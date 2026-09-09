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
  identityKey: string;
  getWsConnection: () => Promise<{ url: string; ticket: string }>;
  fetchMessages: (signal?: AbortSignal) => Promise<ChatMessage[]>;
  sendMessage: (content: string) => Promise<void>;
  markAsRead: (messageId: string) => Promise<void>;
  pollInterval?: number;
}

interface RealtimeSnapshot {
  identityKey: string;
  messages: ChatMessage[];
  isRealtime: boolean;
  loading: boolean;
  error: string | null;
}

function initialSnapshot(identityKey: string): RealtimeSnapshot {
  return {
    identityKey,
    messages: [],
    isRealtime: false,
    loading: true,
    error: null,
  };
}

function isAbortError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    error.name === "AbortError"
  );
}

export function useRealtimeChat(options: UseRealtimeChatOptions) {
  const {
    identityKey,
    getWsConnection,
    fetchMessages,
    sendMessage,
    markAsRead: markMessageAsRead,
    pollInterval = 30_000,
  } = options;
  const [snapshot, setSnapshot] = React.useState<RealtimeSnapshot>(() =>
    initialSnapshot(identityKey),
  );
  const generationRef = React.useRef(0);
  const refreshRef = React.useRef<() => void>(() => undefined);

  React.useEffect(() => {
    const generation = generationRef.current + 1;
    generationRef.current = generation;
    let active = true;
    let socket: WebSocket | null = null;
    let connecting = false;
    let reconnectDelay = 1000;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    let pollTimer: ReturnType<typeof setInterval> | undefined;
    let fetchController: AbortController | null = null;

    setSnapshot(initialSnapshot(identityKey));

    function isCurrentGeneration(): boolean {
      return active && generationRef.current === generation;
    }

    function updateSnapshot(
      update: (current: RealtimeSnapshot) => RealtimeSnapshot,
    ): void {
      if (!isCurrentGeneration()) return;
      setSnapshot((current) =>
        current.identityKey === identityKey ? update(current) : current,
      );
    }

    async function loadMessages(showLoading = false): Promise<void> {
      if (!isCurrentGeneration()) return;
      fetchController?.abort();
      const controller = new AbortController();
      fetchController = controller;
      if (showLoading) {
        updateSnapshot((current) => ({ ...current, loading: true }));
      }
      try {
        const data = await fetchMessages(controller.signal);
        if (
          !isCurrentGeneration() ||
          controller.signal.aborted ||
          fetchController !== controller
        ) {
          return;
        }
        updateSnapshot((current) => ({
          ...current,
          messages: data,
          error: null,
        }));
      } catch (error) {
        if (
          !isCurrentGeneration() ||
          controller.signal.aborted ||
          isAbortError(error) ||
          fetchController !== controller
        ) {
          return;
        }
        updateSnapshot((current) => ({
          ...current,
          error: error instanceof Error ? error.message : String(error),
        }));
      } finally {
        if (fetchController === controller) {
          fetchController = null;
          updateSnapshot((current) => ({ ...current, loading: false }));
        }
      }
    }

    function startPolling(): void {
      if (!isCurrentGeneration() || pollTimer) return;
      pollTimer = setInterval(() => {
        if (isCurrentGeneration()) void loadMessages();
      }, pollInterval);
    }

    function stopPolling(): void {
      if (!pollTimer) return;
      clearInterval(pollTimer);
      pollTimer = undefined;
    }

    function scheduleReconnect(): void {
      if (!isCurrentGeneration() || reconnectTimer) return;
      const delay = reconnectDelay;
      reconnectDelay = Math.min(reconnectDelay * 2, 30_000);
      reconnectTimer = setTimeout(() => {
        reconnectTimer = undefined;
        if (isCurrentGeneration()) void connect();
      }, delay);
    }

    async function connect() {
      if (!isCurrentGeneration() || connecting || socket) return;
      connecting = true;
      let connection: { url: string; ticket: string };
      try {
        connection = await getWsConnection();
      } catch {
        if (isCurrentGeneration()) {
          updateSnapshot((current) => ({ ...current, isRealtime: false }));
          startPolling();
          scheduleReconnect();
        }
        connecting = false;
        return;
      }
      if (!isCurrentGeneration()) {
        connecting = false;
        return;
      }

      let nextSocket: WebSocket;
      try {
        nextSocket = new WebSocket(connection.url, [
          WS_TICKET_PROTOCOL,
          connection.ticket,
        ]);
      } catch {
        connecting = false;
        updateSnapshot((current) => ({ ...current, isRealtime: false }));
        startPolling();
        scheduleReconnect();
        return;
      }
      connecting = false;
      if (!isCurrentGeneration()) {
        nextSocket.close();
        return;
      }
      socket = nextSocket;

      nextSocket.onopen = () => {
        if (!isCurrentGeneration() || socket !== nextSocket) return;
        updateSnapshot((current) => ({ ...current, isRealtime: true }));
        reconnectDelay = 1000;
        stopPolling();
      };

      nextSocket.onmessage = (event) => {
        if (!isCurrentGeneration() || socket !== nextSocket) return;
        try {
          const data = JSON.parse(event.data);
          if (data.type === "message:new" && data.message) {
            updateSnapshot((current) => {
              const exists = current.messages.some(
                (message) => message.id === data.message.id,
              );
              return exists
                ? current
                : { ...current, messages: [...current.messages, data.message] };
            });
          } else if (data.type === "message:read" && data.messageId) {
            updateSnapshot((current) => ({
              ...current,
              messages: current.messages.map((message) =>
                message.id === data.messageId
                  ? { ...message, readAt: data.readAt ?? null }
                  : message,
              ),
            }));
          }
        } catch {
          // Ignore malformed messages
        }
      };

      nextSocket.onclose = () => {
        if (!isCurrentGeneration() || socket !== nextSocket) return;
        socket = null;
        updateSnapshot((current) => ({ ...current, isRealtime: false }));
        startPolling();
        scheduleReconnect();
      };

      nextSocket.onerror = () => {
        if (isCurrentGeneration() && socket === nextSocket) nextSocket.close();
      };
    }

    void loadMessages();
    void connect();
    const refresh = () => void loadMessages(true);
    refreshRef.current = refresh;

    return () => {
      active = false;
      if (generationRef.current === generation) generationRef.current += 1;
      fetchController?.abort();
      fetchController = null;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      reconnectTimer = undefined;
      stopPolling();
      if (refreshRef.current === refresh) {
        refreshRef.current = () => undefined;
      }
      if (socket) {
        socket.onopen = null;
        socket.onmessage = null;
        socket.onerror = null;
        socket.onclose = null;
        socket.close();
        socket = null;
      }
    };
  }, [identityKey, getWsConnection, fetchMessages, pollInterval]);

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

  const refresh = React.useCallback(() => refreshRef.current(), []);

  const hasCurrentIdentity = snapshot.identityKey === identityKey;

  return {
    messages: hasCurrentIdentity ? snapshot.messages : [],
    send,
    markAsRead,
    loading: hasCurrentIdentity ? snapshot.loading : true,
    error: hasCurrentIdentity ? snapshot.error : null,
    isRealtime: hasCurrentIdentity ? snapshot.isRealtime : false,
    refresh,
  };
}
