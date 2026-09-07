import * as React from "react";
import { WS_TICKET_PROTOCOL } from "@nutriclinica/shared";
import { useAuthStore } from "@store/authStore";
import { useSyncStore } from "@store/syncStore";
import { telemedicinaApi } from "@services/api/telemedicinaApi";
import { getApiBaseUrl } from "@services/api/apiBaseUrl";

// Stay below the server-enforced 60-second minimum credential lifetime.
const TURN_CONFIG_CACHE_TTL = 30_000;
const MAX_PENDING_ICE_CANDIDATES = 256;

interface TurnIceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

interface TurnConfigDTO {
  iceServers: TurnIceServer[];
  configured: boolean;
}

let turnConfigCache: {
  data: TurnConfigDTO;
  timestamp: number;
  token: string;
  sucursalId: string | null;
} | null = null;

interface PeerInfo {
  userId: string;
  email: string;
}

interface UseWebRtcOptions {
  salaId: string;
  localStream: MediaStream | null;
}

interface UseWebRtcReturn {
  remoteStream: MediaStream | null;
  peers: PeerInfo[];
  connected: boolean;
  startCall: (stream?: MediaStream) => Promise<void>;
  endCall: () => void;
  error: string | null;
}

function getWsUrl(): string {
  const base = getApiBaseUrl().replace(/^http/, "ws");
  return `${base}/ws/telemedicina`;
}

async function fetchTurnConfig(): Promise<TurnConfigDTO> {
  const now = Date.now();
  const token = useAuthStore.getState().token;
  const sucursalId = useSyncStore.getState().sucursalId;
  if (!token) throw new Error("TURN configuration requires authentication");
  if (
    turnConfigCache &&
    turnConfigCache.token === token &&
    turnConfigCache.sucursalId === sucursalId &&
    now - turnConfigCache.timestamp < TURN_CONFIG_CACHE_TTL
  ) {
    return turnConfigCache.data;
  }

  const apiUrl = getApiBaseUrl();
  const res = await fetch(`${apiUrl}/telemedicina/turn-config`, {
    headers: {
      Authorization: `Bearer ${token}`,
      ...(sucursalId ? { "X-Sucursal-Id": sucursalId } : {}),
    },
  });
  if (!res.ok) {
    throw new Error(`TURN configuration request failed (${res.status})`);
  }
  const data: unknown = await res.json();
  if (!isTurnConfig(data))
    throw new Error("Invalid TURN configuration response");
  turnConfigCache = {
    data,
    timestamp: Date.now(),
    token,
    sucursalId,
  };
  return data;
}

export async function buildRtcConfig(): Promise<RTCConfiguration> {
  const serverConfig = await fetchTurnConfig();
  return { iceServers: serverConfig.iceServers };
}

function isTurnConfig(value: unknown): value is TurnConfigDTO {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<TurnConfigDTO>;
  return (
    typeof candidate.configured === "boolean" &&
    Array.isArray(candidate.iceServers) &&
    candidate.iceServers.every(
      (server) =>
        server !== null &&
        typeof server === "object" &&
        (typeof server.urls === "string" ||
          (Array.isArray(server.urls) &&
            server.urls.every((url) => typeof url === "string"))) &&
        (server.username === undefined ||
          typeof server.username === "string") &&
        (server.credential === undefined ||
          typeof server.credential === "string"),
    )
  );
}

export function useWebRTC({
  salaId,
  localStream,
}: UseWebRtcOptions): UseWebRtcReturn {
  const token = useAuthStore((s) => s.token);
  const [remoteStream, setRemoteStream] = React.useState<MediaStream | null>(
    null,
  );
  const [peers, setPeers] = React.useState<PeerInfo[]>([]);
  const [connected, setConnected] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const wsRef = React.useRef<WebSocket | null>(null);
  const pcRef = React.useRef<RTCPeerConnection | null>(null);
  const rtcConfigRef = React.useRef<RTCConfiguration | null>(null);
  const localStreamRef = React.useRef<MediaStream | null>(null);
  const remoteStreamRef = React.useRef<MediaStream | null>(null);
  const pendingIceCandidatesRef = React.useRef<RTCIceCandidate[]>([]);

  React.useEffect(() => {
    localStreamRef.current = localStream;
  }, [localStream]);

  const assignRemoteStream = React.useCallback((stream: MediaStream | null) => {
    remoteStreamRef.current = stream;
    setRemoteStream(stream);
  }, []);

  const cleanup = React.useCallback(() => {
    pcRef.current?.close();
    pcRef.current = null;
    rtcConfigRef.current = null;
    pendingIceCandidatesRef.current = [];
    wsRef.current?.close();
    wsRef.current = null;
    setPeers([]);
    setConnected(false);
    if (remoteStreamRef.current) {
      remoteStreamRef.current.getTracks().forEach((t) => t.stop());
      remoteStreamRef.current = null;
      setRemoteStream(null);
    }
  }, []);

  const flushPendingIceCandidates = React.useCallback(
    async (pc: RTCPeerConnection) => {
      const candidates = pendingIceCandidatesRef.current.splice(0);
      for (const candidate of candidates) {
        try {
          await pc.addIceCandidate(candidate);
        } catch {
          // Ignore candidates rejected by the browser after SDP validation.
        }
      }
    },
    [],
  );

  React.useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  const handleSignalingMessage = React.useCallback(
    async (ws: WebSocket, data: string) => {
      const currentLocalStream = localStreamRef.current;
      if (!currentLocalStream) return;

      let msg: {
        type: string;
        salaId?: string;
        targetId?: string;
        payload?: unknown;
      };
      try {
        msg = JSON.parse(data);
      } catch {
        return;
      }

      const rtcConfig = rtcConfigRef.current ?? (await buildRtcConfig());
      rtcConfigRef.current = rtcConfig;

      const ensurePeerConnection = async (): Promise<RTCPeerConnection> => {
        if (pcRef.current) return pcRef.current;
        const pc = createPeerConnection(
          rtcConfig,
          ws,
          salaId,
          currentLocalStream,
          assignRemoteStream,
          (failedPeer) => {
            if (pcRef.current !== failedPeer) return;
            pcRef.current = null;
            pendingIceCandidatesRef.current = [];
            if (remoteStreamRef.current) {
              remoteStreamRef.current
                .getTracks()
                .forEach((track) => track.stop());
              assignRemoteStream(null);
            }
          },
        );
        pcRef.current = pc;
        return pc;
      };

      switch (msg.type) {
        case "join-room": {
          const existingPeers: PeerInfo[] =
            (msg.payload as { peers?: PeerInfo[] })?.peers ?? [];
          setPeers(existingPeers);
          setConnected(true);
          break;
        }
        case "peer-joined": {
          const peer = msg.payload as PeerInfo;
          setPeers((prev) =>
            prev.some((p) => p.userId === peer.userId) ? prev : [...prev, peer],
          );
          if (!pcRef.current) {
            const pc = await ensurePeerConnection();
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            ws.send(
              JSON.stringify({
                type: "offer",
                salaId,
                payload: { sdp: offer },
              }),
            );
          }
          break;
        }
        case "peer-left": {
          setPeers((prev) => prev.filter((p) => p.userId !== msg.targetId));
          if (pcRef.current) {
            pcRef.current.close();
            pcRef.current = null;
          }
          pendingIceCandidatesRef.current = [];
          if (remoteStreamRef.current) {
            remoteStreamRef.current
              .getTracks()
              .forEach((track) => track.stop());
            assignRemoteStream(null);
          }
          break;
        }
        case "offer": {
          const pc = await ensurePeerConnection();
          await pc.setRemoteDescription(
            new RTCSessionDescription(
              (msg.payload as { sdp: RTCSessionDescription }).sdp,
            ),
          );
          await flushPendingIceCandidates(pc);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          ws.send(
            JSON.stringify({
              type: "answer",
              salaId,
              payload: { sdp: answer },
            }),
          );
          break;
        }
        case "answer": {
          if (pcRef.current) {
            await pcRef.current.setRemoteDescription(
              new RTCSessionDescription(
                (msg.payload as { sdp: RTCSessionDescription }).sdp,
              ),
            );
            await flushPendingIceCandidates(pcRef.current);
          }
          break;
        }
        case "ice-candidate": {
          if (pcRef.current) {
            const candidate = (msg.payload as { candidate?: RTCIceCandidate })
              ?.candidate;
            if (candidate) {
              try {
                const iceCandidate = new RTCIceCandidate(candidate);
                if (!pcRef.current.remoteDescription) {
                  if (
                    pendingIceCandidatesRef.current.length <
                    MAX_PENDING_ICE_CANDIDATES
                  ) {
                    pendingIceCandidatesRef.current.push(iceCandidate);
                  }
                } else {
                  await pcRef.current.addIceCandidate(iceCandidate);
                }
              } catch {
                // ignore invalid candidates
              }
            }
          } else {
            const candidate = (msg.payload as { candidate?: RTCIceCandidate })
              ?.candidate;
            if (candidate) {
              try {
                if (
                  pendingIceCandidatesRef.current.length <
                  MAX_PENDING_ICE_CANDIDATES
                ) {
                  pendingIceCandidatesRef.current.push(
                    new RTCIceCandidate(candidate),
                  );
                }
              } catch {
                // ignore invalid candidates
              }
            }
          }
          break;
        }
      }
    },
    [salaId, assignRemoteStream, flushPendingIceCandidates],
  );

  const startCall = React.useCallback(
    async (stream?: MediaStream) => {
      if (!token) {
        setError("No autenticado");
        return;
      }
      const currentLocalStream = stream ?? localStreamRef.current;
      if (!currentLocalStream) {
        setError("C\u00e1mara no disponible");
        return;
      }

      localStreamRef.current = currentLocalStream;
      setError(null);
      try {
        rtcConfigRef.current = await buildRtcConfig();
      } catch {
        setError("No se pudo obtener la configuracion de red para la llamada");
        return;
      }
      let wsTicket: string;
      try {
        const { ticket } = await telemedicinaApi.getWsTicket(salaId);
        wsTicket = ticket;
      } catch {
        setError("No se pudo obtener el ticket de conexi\u00f3n");
        return;
      }
      const ws = new WebSocket(getWsUrl(), [WS_TICKET_PROTOCOL, wsTicket]);
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(JSON.stringify({ type: "join-room", salaId }));
      };

      ws.onmessage = (event) => {
        void handleSignalingMessage(ws, event.data).catch(() => {
          setError("No se pudo establecer la conexion de llamada");
          cleanup();
        });
      };

      ws.onerror = () => {
        setError(
          "Error de conexi\u00f3n con el servidor de se\u00f1alizaci\u00f3n",
        );
      };

      ws.onclose = () => {
        setConnected(false);
      };
    },
    [token, salaId, handleSignalingMessage, cleanup],
  );

  const endCall = React.useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "leave-room", salaId }));
    }
    cleanup();
  }, [salaId, cleanup]);

  return { remoteStream, peers, connected, startCall, endCall, error };
}

function createPeerConnection(
  rtcConfig: RTCConfiguration,
  ws: WebSocket,
  salaId: string,
  localStream: MediaStream,
  setRemoteStream: (stream: MediaStream | null) => void,
  onFailed: (pc: RTCPeerConnection) => void,
): RTCPeerConnection {
  const pc = new RTCPeerConnection(rtcConfig);

  localStream.getTracks().forEach((track) => {
    pc.addTrack(track, localStream);
  });

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      ws.send(
        JSON.stringify({
          type: "ice-candidate",
          salaId,
          payload: { candidate: event.candidate },
        }),
      );
    }
  };

  pc.ontrack = (event) => {
    if (event.streams[0]) {
      setRemoteStream(event.streams[0]);
    }
  };

  pc.onconnectionstatechange = () => {
    if (pc.connectionState === "failed") {
      pc.close();
      onFailed(pc);
    }
  };

  return pc;
}
