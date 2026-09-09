import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WS_TICKET_PROTOCOL } from "@nutriclinica/shared";
import { useRealtimeChat, type ChatMessage } from "./useRealtimeChat";

type HookOptions = Parameters<typeof useRealtimeChat>[0];

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function message(id: string, pacienteId: string): ChatMessage {
  return {
    id,
    tokenId: `token-${pacienteId}`,
    pacienteId,
    sucursalId: "synthetic-branch",
    profesionalId: null,
    content: id,
    direction: "patient_to_professional",
    readAt: null,
    createdAt: "2026-09-08T00:00:00.000Z",
  };
}

const PATIENT_A_MESSAGE = message("PATIENT_A_MESSAGE", "patient-a");
const PATIENT_B_MESSAGE = message("PATIENT_B_MESSAGE", "patient-b");

class FakeWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSED = 3;
  static instances: FakeWebSocket[] = [];

  readonly url: string;
  readonly protocols: string[];
  readyState = FakeWebSocket.CONNECTING;
  onopen: (() => void) | null = null;
  onmessage: ((event: MessageEvent<string>) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;
  readonly close = vi.fn(() => {
    this.readyState = FakeWebSocket.CLOSED;
  });

  constructor(url: string, protocols?: string | string[]) {
    this.url = url;
    this.protocols = Array.isArray(protocols)
      ? protocols
      : protocols
        ? [protocols]
        : [];
    FakeWebSocket.instances.push(this);
  }

  emitOpen(): void {
    this.readyState = FakeWebSocket.OPEN;
    this.onopen?.();
  }

  emitMessage(payload: unknown): void {
    this.onmessage?.({ data: JSON.stringify(payload) } as MessageEvent<string>);
  }

  emitClose(): void {
    this.readyState = FakeWebSocket.CLOSED;
    this.onclose?.();
  }
}

function options(
  identityKey: string,
  overrides: Partial<HookOptions> = {},
): HookOptions {
  return {
    identityKey,
    getWsConnection: () => new Promise(() => undefined),
    fetchMessages: async () => [],
    sendMessage: async () => undefined,
    markAsRead: async () => undefined,
    pollInterval: 1_000,
    ...overrides,
  };
}

async function flushPromises(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
  });
}

describe("useRealtimeChat generation isolation", () => {
  beforeEach(() => {
    FakeWebSocket.instances = [];
    vi.stubGlobal("WebSocket", FakeWebSocket);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("A. ignores a patient A fetch that resolves after switching to patient B", async () => {
    const patientAFetch = deferred<ChatMessage[]>();
    const { result, rerender, unmount } = renderHook(
      (props: HookOptions) => useRealtimeChat(props),
      {
        initialProps: options("patient-a", {
          fetchMessages: () => patientAFetch.promise,
        }),
      },
    );

    rerender(
      options("patient-b", {
        fetchMessages: async () => [PATIENT_B_MESSAGE],
      }),
    );
    await waitFor(() =>
      expect(result.current.messages).toEqual([PATIENT_B_MESSAGE]),
    );

    await act(async () => patientAFetch.resolve([PATIENT_A_MESSAGE]));
    expect(result.current.messages).toEqual([PATIENT_B_MESSAGE]);
    expect(result.current.messages).not.toContainEqual(PATIENT_A_MESSAGE);
    unmount();
  });

  it("B. never creates a socket from a stale pending connection result", async () => {
    const patientAConnection = deferred<{ url: string; ticket: string }>();
    const patientBConnection = deferred<{ url: string; ticket: string }>();
    const { rerender, unmount } = renderHook(
      (props: HookOptions) => useRealtimeChat(props),
      {
        initialProps: options("patient-a", {
          getWsConnection: () => patientAConnection.promise,
        }),
      },
    );

    rerender(
      options("patient-b", {
        getWsConnection: () => patientBConnection.promise,
      }),
    );
    await act(async () => {
      patientAConnection.resolve({ url: "ws://patient-a.test", ticket: "a" });
      await patientAConnection.promise;
    });

    expect(FakeWebSocket.instances).toHaveLength(0);
    unmount();
  });

  it("C. ignores an old-token fetch response and treats abort as lifecycle", async () => {
    const oldFetch = deferred<ChatMessage[]>();
    let oldSignal: AbortSignal | undefined;
    const { result, rerender, unmount } = renderHook(
      (props: HookOptions) => useRealtimeChat(props),
      {
        initialProps: options("patient-a:token-old", {
          fetchMessages: (signal) => {
            oldSignal = signal;
            return oldFetch.promise;
          },
        }),
      },
    );
    await waitFor(() => expect(oldSignal).toBeDefined());

    rerender(
      options("patient-a:token-new", {
        fetchMessages: async () => [PATIENT_B_MESSAGE],
      }),
    );
    expect(oldSignal?.aborted).toBe(true);
    await act(async () => oldFetch.resolve([PATIENT_A_MESSAGE]));
    await waitFor(() =>
      expect(result.current.messages).toEqual([PATIENT_B_MESSAGE]),
    );
    expect(result.current.error).toBeNull();
    unmount();
  });

  it("D. closes a connecting old-token socket during generation change", async () => {
    const { rerender, unmount } = renderHook(
      (props: HookOptions) => useRealtimeChat(props),
      {
        initialProps: options("patient-a:token-old", {
          getWsConnection: async () => ({
            url: "ws://patient-a.test",
            ticket: "a".repeat(64),
          }),
        }),
      },
    );
    await waitFor(() => expect(FakeWebSocket.instances).toHaveLength(1));
    const oldSocket = FakeWebSocket.instances[0]!;

    rerender(options("patient-a:token-new"));
    expect(oldSocket.close).toHaveBeenCalledOnce();
    expect(oldSocket.readyState).toBe(FakeWebSocket.CLOSED);
    unmount();
  });

  it("E. aborts pending fetch and ignores its completion after unmount", async () => {
    const pendingFetch = deferred<ChatMessage[]>();
    let signal: AbortSignal | undefined;
    const hookOptions = options("patient-a", {
      fetchMessages: (nextSignal) => {
        signal = nextSignal;
        return pendingFetch.promise;
      },
    });
    const { unmount } = renderHook(() => useRealtimeChat(hookOptions));
    await waitFor(() => expect(signal).toBeDefined());

    unmount();
    expect(signal?.aborted).toBe(true);
    await act(async () => pendingFetch.resolve([PATIENT_A_MESSAGE]));
  });

  it("F. closes a pending WebSocket when the hook unmounts", async () => {
    const hookOptions = options("patient-a", {
      getWsConnection: async () => ({
        url: "ws://patient-a.test",
        ticket: "a".repeat(64),
      }),
    });
    const { unmount } = renderHook(() => useRealtimeChat(hookOptions));
    await waitFor(() => expect(FakeWebSocket.instances).toHaveLength(1));
    const socket = FakeWebSocket.instances[0]!;

    unmount();
    expect(socket.close).toHaveBeenCalledOnce();
  });

  it("G. ignores a queued old-socket event after a patient switch", async () => {
    const patientBConnection = deferred<{ url: string; ticket: string }>();
    const { result, rerender, unmount } = renderHook(
      (props: HookOptions) => useRealtimeChat(props),
      {
        initialProps: options("patient-a", {
          getWsConnection: async () => ({
            url: "ws://patient-a.test",
            ticket: "a".repeat(64),
          }),
        }),
      },
    );
    await waitFor(() => expect(FakeWebSocket.instances).toHaveLength(1));
    const oldSocket = FakeWebSocket.instances[0]!;
    const queuedOldHandler = oldSocket.onmessage!;

    rerender(
      options("patient-b", {
        getWsConnection: () => patientBConnection.promise,
      }),
    );
    act(() => {
      queuedOldHandler({
        data: JSON.stringify({
          type: "message:new",
          message: PATIENT_A_MESSAGE,
        }),
      } as MessageEvent<string>);
    });

    expect(result.current.messages).toEqual([]);
    expect(result.current.messages).not.toContainEqual(PATIENT_A_MESSAGE);
    unmount();
  });

  it("H. ignores an obsolete polling response after identity change", async () => {
    vi.useFakeTimers();
    const oldPoll = deferred<ChatMessage[]>();
    const patientAFetch = vi
      .fn<HookOptions["fetchMessages"]>()
      .mockResolvedValueOnce([])
      .mockImplementationOnce(() => oldPoll.promise);
    const { result, rerender, unmount } = renderHook(
      (props: HookOptions) => useRealtimeChat(props),
      {
        initialProps: options("patient-a", {
          getWsConnection: async () => {
            throw new Error("synthetic websocket failure");
          },
          fetchMessages: patientAFetch,
        }),
      },
    );
    await flushPromises();
    await act(async () => vi.advanceTimersByTimeAsync(1_000));
    expect(patientAFetch).toHaveBeenCalledTimes(2);

    rerender(
      options("patient-b", {
        fetchMessages: async () => [PATIENT_B_MESSAGE],
      }),
    );
    await act(async () => oldPoll.resolve([PATIENT_A_MESSAGE]));
    await flushPromises();
    expect(result.current.messages).toEqual([PATIENT_B_MESSAGE]);
    expect(result.current.messages).not.toContainEqual(PATIENT_A_MESSAGE);
    unmount();
  });

  it("I. connects the current generation with the ticket subprotocol", async () => {
    const patientAConnection = deferred<{ url: string; ticket: string }>();
    const { result, rerender, unmount } = renderHook(
      (props: HookOptions) => useRealtimeChat(props),
      {
        initialProps: options("patient-a", {
          getWsConnection: () => patientAConnection.promise,
        }),
      },
    );

    rerender(
      options("patient-b", {
        getWsConnection: async () => ({
          url: "ws://patient-b.test",
          ticket: "b".repeat(64),
        }),
      }),
    );
    await waitFor(() => expect(FakeWebSocket.instances).toHaveLength(1));
    const socket = FakeWebSocket.instances[0]!;
    expect(socket.url).toBe("ws://patient-b.test");
    expect(socket.protocols).toEqual([WS_TICKET_PROTOCOL, "b".repeat(64)]);

    act(() => socket.emitOpen());
    expect(result.current.isRealtime).toBe(true);
    act(() =>
      socket.emitMessage({
        type: "message:new",
        message: PATIENT_B_MESSAGE,
      }),
    );
    expect(result.current.messages).toContainEqual(PATIENT_B_MESSAGE);
    unmount();
  });

  it("J. keeps one functional polling loop after current WebSocket failure", async () => {
    vi.useFakeTimers();
    const fetchMessages = vi
      .fn<HookOptions["fetchMessages"]>()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([PATIENT_B_MESSAGE]);
    const hookOptions = options("patient-b", {
      getWsConnection: async () => {
        throw new Error("synthetic websocket failure");
      },
      fetchMessages,
    });
    const { result, unmount } = renderHook(() => useRealtimeChat(hookOptions));
    await flushPromises();
    await act(async () => vi.advanceTimersByTimeAsync(1_000));
    await flushPromises();

    expect(fetchMessages).toHaveBeenCalledTimes(2);
    expect(result.current.messages).toEqual([PATIENT_B_MESSAGE]);
    expect(result.current.isRealtime).toBe(false);
    unmount();
  });
});
