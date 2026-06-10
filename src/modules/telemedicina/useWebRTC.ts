import * as React from "react";
import { useAuthStore } from "@store/authStore";

const DEFAULT_STUN_URLS = ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"];

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
  startCall: (stream?: MediaStream) => void;
  endCall: () => void;
  error: string | null;
}

function getWsUrl(): string {
  const apiUrl = (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_API_URL ?? "http://localhost:3000";
  const base = apiUrl.replace(/^http/, "ws");
  return `${base}/ws/telemedicina`;
}

function env(): Record<string, string | undefined> {
  return (import.meta as unknown as { env?: Record<string, string> }).env ?? {};
}

function csv(value: string | undefined): string[] {
  return value?.split(",").map((v) => v.trim()).filter(Boolean) ?? [];
}

function buildRtcConfig(): RTCConfiguration {
  const e = env();
  const stunUrls = csv(e.VITE_STUN_URLS);
  const turnUrls = csv(e.VITE_TURN_URLS);
  const iceServers: RTCIceServer[] = [{ urls: stunUrls.length > 0 ? stunUrls : DEFAULT_STUN_URLS }];

  if (turnUrls.length > 0) {
    iceServers.push({
      urls: turnUrls,
      username: e.VITE_TURN_USERNAME,
      credential: e.VITE_TURN_CREDENTIAL,
    });
  }

  return { iceServers };
}

export function useWebRTC({ salaId, localStream }: UseWebRtcOptions): UseWebRtcReturn {
  const token = useAuthStore((s) => s.token);
  const [remoteStream, setRemoteStream] = React.useState<MediaStream | null>(null);
  const [peers, setPeers] = React.useState<PeerInfo[]>([]);
  const [connected, setConnected] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const wsRef = React.useRef<WebSocket | null>(null);
  const pcRef = React.useRef<RTCPeerConnection | null>(null);
  const localStreamRef = React.useRef<MediaStream | null>(null);
  const remoteStreamRef = React.useRef<MediaStream | null>(null);

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

  React.useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  const handleSignalingMessage = React.useCallback(async (ws: WebSocket, data: string) => {
    const currentLocalStream = localStreamRef.current;
    if (!currentLocalStream) return;

    let msg: { type: string; salaId?: string; targetId?: string; payload?: unknown };
    try {
      msg = JSON.parse(data);
    } catch {
      return;
    }

    switch (msg.type) {
      case "join-room": {
        const existingPeers: PeerInfo[] = (msg.payload as { peers?: PeerInfo[] })?.peers ?? [];
        setPeers(existingPeers);
        setConnected(true);
        if (existingPeers.length > 0) {
          const pc = createPeerConnection(ws, salaId, currentLocalStream, assignRemoteStream);
          pcRef.current = pc;
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          ws.send(JSON.stringify({ type: "offer", salaId, payload: { sdp: offer } }));
        }
        break;
      }
      case "peer-joined": {
        const peer = msg.payload as PeerInfo;
        setPeers((prev) => (prev.some((p) => p.userId === peer.userId) ? prev : [...prev, peer]));
        if (!pcRef.current) {
          const pc = createPeerConnection(ws, salaId, currentLocalStream, assignRemoteStream);
          pcRef.current = pc;
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          ws.send(JSON.stringify({ type: "offer", salaId, payload: { sdp: offer } }));
        }
        break;
      }
      case "peer-left": {
        setPeers((prev) => prev.filter((p) => p.userId !== msg.targetId));
        if (pcRef.current) {
          pcRef.current.close();
          pcRef.current = null;
        }
        break;
      }
      case "offer": {
        const pc = createPeerConnection(ws, salaId, currentLocalStream, assignRemoteStream);
        pcRef.current = pc;
        await pc.setRemoteDescription(new RTCSessionDescription((msg.payload as { sdp: RTCSessionDescription }).sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        ws.send(JSON.stringify({ type: "answer", salaId, payload: { sdp: answer } }));
        break;
      }
      case "answer": {
        if (pcRef.current) {
          await pcRef.current.setRemoteDescription(new RTCSessionDescription((msg.payload as { sdp: RTCSessionDescription }).sdp));
        }
        break;
      }
      case "ice-candidate": {
        if (pcRef.current) {
          const candidate = (msg.payload as { candidate?: RTCIceCandidate })?.candidate;
          if (candidate) {
            try {
              await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
            } catch {
              // ignore invalid candidates
            }
          }
        }
        break;
      }
    }
  }, [salaId, assignRemoteStream]);

  const startCall = React.useCallback((stream?: MediaStream) => {
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
    const ws = new WebSocket(`${getWsUrl()}?token=${encodeURIComponent(token)}`);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: "join-room", salaId }));
    };

    ws.onmessage = (event) => {
      void handleSignalingMessage(ws, event.data);
    };

    ws.onerror = () => {
      setError("Error de conexi\u00f3n con el servidor de se\u00f1alizaci\u00f3n");
    };

    ws.onclose = () => {
      setConnected(false);
    };
  }, [token, salaId, handleSignalingMessage]);

  const endCall = React.useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "leave-room", salaId }));
    }
    cleanup();
  }, [salaId, cleanup]);

  return { remoteStream, peers, connected, startCall, endCall, error };
}

function createPeerConnection(
  ws: WebSocket,
  salaId: string,
  localStream: MediaStream,
  setRemoteStream: (stream: MediaStream | null) => void,
): RTCPeerConnection {
  const pc = new RTCPeerConnection(buildRtcConfig());

  localStream.getTracks().forEach((track) => {
    pc.addTrack(track, localStream);
  });

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      ws.send(JSON.stringify({ type: "ice-candidate", salaId, payload: { candidate: event.candidate } }));
    }
  };

  pc.ontrack = (event) => {
    if (event.streams[0]) {
      setRemoteStream(event.streams[0]);
    }
  };

  pc.onconnectionstatechange = () => {
    if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
      pc.close();
    }
  };

  return pc;
}
