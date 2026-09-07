import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useAuthStore } from "@store/authStore";
import { useSyncStore } from "@store/syncStore";

const { getWsTicket } = vi.hoisted(() => ({
  getWsTicket: vi.fn(),
}));

vi.mock("@services/api/telemedicinaApi", () => ({
  telemedicinaApi: { getWsTicket },
}));

import { buildRtcConfig, useWebRTC } from "./useWebRTC";

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  delete process.env.VITE_API_URL;
});

describe("buildRtcConfig", () => {
  it("accepts an explicitly disabled server configuration", async () => {
    process.env.VITE_API_URL = "https://api.example.test";
    useAuthStore.setState({ token: "disabled-config-token" });
    useSyncStore.setState({ sucursalId: "branch-1" });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ configured: false, iceServers: [] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(buildRtcConfig()).resolves.toEqual({ iceServers: [] });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.test/telemedicina/turn-config",
      expect.objectContaining({
        headers: {
          Authorization: "Bearer disabled-config-token",
          "X-Sucursal-Id": "branch-1",
        },
      }),
    );
  });

  it("does not silently downgrade when the TURN endpoint fails", async () => {
    process.env.VITE_API_URL = "https://api.example.test";
    useAuthStore.setState({ token: "failed-config-token" });
    useSyncStore.setState({ sucursalId: null });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 503 }),
    );

    await expect(buildRtcConfig()).rejects.toThrow(
      "TURN configuration request failed (503)",
    );
  });

  it("rejects malformed configuration payloads", async () => {
    process.env.VITE_API_URL = "https://api.example.test";
    useAuthStore.setState({ token: "malformed-config-token" });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ configured: true, iceServers: "turn" }),
      }),
    );

    await expect(buildRtcConfig()).rejects.toThrow(
      "Invalid TURN configuration response",
    );
  });
});

describe("useWebRTC negotiation", () => {
  it("lets only the existing peer create the initial offer", async () => {
    process.env.VITE_API_URL = "https://api.example.test";
    useAuthStore.setState({ token: "negotiation-token" });
    useSyncStore.setState({ sucursalId: "branch-1" });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ configured: false, iceServers: [] }),
      }),
    );
    getWsTicket.mockResolvedValue({ ticket: "a".repeat(64) });

    const sockets: Array<{
      onopen: (() => void) | null;
      onmessage: ((event: { data: string }) => void) | null;
      onerror: (() => void) | null;
      onclose: (() => void) | null;
      send: ReturnType<typeof vi.fn>;
      close: ReturnType<typeof vi.fn>;
      readyState: number;
    }> = [];
    class FakeWebSocket {
      static readonly OPEN = 1;
      readonly send = vi.fn();
      readonly close = vi.fn();
      readonly readyState = FakeWebSocket.OPEN;
      onopen: (() => void) | null = null;
      onmessage: ((event: { data: string }) => void) | null = null;
      onerror: (() => void) | null = null;
      onclose: (() => void) | null = null;

      constructor() {
        sockets.push(this);
      }
    }

    const createOffer = vi
      .fn()
      .mockResolvedValue({ type: "offer", sdp: "offer-sdp" });
    const setLocalDescription = vi.fn().mockResolvedValue(undefined);
    const peerConnections: FakePeerConnection[] = [];
    class FakePeerConnection {
      readonly addTrack = vi.fn();
      readonly close = vi.fn();
      readonly createOffer = createOffer;
      readonly setLocalDescription = setLocalDescription;
      onicecandidate: ((event: { candidate: unknown }) => void) | null = null;
      ontrack: ((event: { streams: MediaStream[] }) => void) | null = null;
      onconnectionstatechange: (() => void) | null = null;
      connectionState = "new";

      constructor() {
        peerConnections.push(this);
      }
    }

    vi.stubGlobal("WebSocket", FakeWebSocket);
    vi.stubGlobal("RTCPeerConnection", FakePeerConnection);

    const stream = { getTracks: () => [] } as unknown as MediaStream;
    const { result, unmount } = renderHook(() =>
      useWebRTC({ salaId: "room-1", localStream: stream }),
    );

    await act(async () => {
      await result.current.startCall();
    });
    const socket = sockets[0]!;

    await act(async () => {
      socket.onmessage?.({
        data: JSON.stringify({
          type: "join-room",
          salaId: "room-1",
          payload: { peers: [{ userId: "existing", email: "" }] },
        }),
      });
      await Promise.resolve();
    });
    expect(peerConnections).toHaveLength(0);
    expect(createOffer).not.toHaveBeenCalled();

    await act(async () => {
      socket.onmessage?.({
        data: JSON.stringify({
          type: "peer-joined",
          salaId: "room-1",
          payload: { userId: "new-peer", email: "" },
        }),
      });
    });
    await waitFor(() => expect(createOffer).toHaveBeenCalledOnce());
    expect(setLocalDescription).toHaveBeenCalledOnce();
    expect(socket.send).toHaveBeenCalledWith(
      JSON.stringify({
        type: "offer",
        salaId: "room-1",
        payload: { sdp: { type: "offer", sdp: "offer-sdp" } },
      }),
    );

    unmount();
  });

  it("queues ICE candidates until the remote description is installed", async () => {
    process.env.VITE_API_URL = "https://api.example.test";
    useAuthStore.setState({ token: "ice-order-token" });
    useSyncStore.setState({ sucursalId: "branch-1" });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ configured: false, iceServers: [] }),
      }),
    );
    getWsTicket.mockResolvedValue({ ticket: "b".repeat(64) });

    const sockets: Array<{
      onmessage: ((event: { data: string }) => void) | null;
      send: ReturnType<typeof vi.fn>;
      close: ReturnType<typeof vi.fn>;
      readyState: number;
    }> = [];
    class FakeWebSocket {
      static readonly OPEN = 1;
      readonly send = vi.fn();
      readonly close = vi.fn();
      readonly readyState = FakeWebSocket.OPEN;
      onopen: (() => void) | null = null;
      onmessage: ((event: { data: string }) => void) | null = null;
      onerror: (() => void) | null = null;
      onclose: (() => void) | null = null;

      constructor() {
        sockets.push(this);
      }
    }

    let finishRemoteDescription: (() => void) | undefined;
    const remoteDescriptionPending = new Promise<void>((resolve) => {
      finishRemoteDescription = resolve;
    });
    const addIceCandidate = vi.fn().mockResolvedValue(undefined);
    class FakePeerConnection {
      readonly addTrack = vi.fn();
      readonly close = vi.fn();
      readonly createAnswer = vi
        .fn()
        .mockResolvedValue({ type: "answer", sdp: "answer-sdp" });
      readonly setLocalDescription = vi.fn().mockResolvedValue(undefined);
      readonly addIceCandidate = addIceCandidate;
      remoteDescription: unknown = null;
      onicecandidate: ((event: { candidate: unknown }) => void) | null = null;
      ontrack: ((event: { streams: MediaStream[] }) => void) | null = null;
      onconnectionstatechange: (() => void) | null = null;
      connectionState = "new";

      async setRemoteDescription(description: unknown) {
        await remoteDescriptionPending;
        this.remoteDescription = description;
      }
    }
    class FakeSessionDescription {
      constructor(init: object) {
        Object.assign(this, init);
      }
    }
    class FakeIceCandidate {
      constructor(init: object) {
        Object.assign(this, init);
      }
    }

    vi.stubGlobal("WebSocket", FakeWebSocket);
    vi.stubGlobal("RTCPeerConnection", FakePeerConnection);
    vi.stubGlobal("RTCSessionDescription", FakeSessionDescription);
    vi.stubGlobal("RTCIceCandidate", FakeIceCandidate);

    const stream = { getTracks: () => [] } as unknown as MediaStream;
    const { result, unmount } = renderHook(() =>
      useWebRTC({ salaId: "room-2", localStream: stream }),
    );

    await act(async () => {
      await result.current.startCall();
    });
    const socket = sockets[0]!;

    act(() => {
      socket.onmessage?.({
        data: JSON.stringify({
          type: "offer",
          salaId: "room-2",
          payload: { sdp: { type: "offer", sdp: "offer-sdp" } },
        }),
      });
      socket.onmessage?.({
        data: JSON.stringify({
          type: "ice-candidate",
          salaId: "room-2",
          payload: { candidate: { candidate: "candidate-1" } },
        }),
      });
    });

    expect(addIceCandidate).not.toHaveBeenCalled();
    await act(async () => {
      finishRemoteDescription?.();
      await remoteDescriptionPending;
    });
    await waitFor(() => expect(addIceCandidate).toHaveBeenCalledOnce());

    unmount();
  });
});
