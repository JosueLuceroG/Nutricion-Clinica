import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'node:http';
import { verifyToken } from '../auth/application/authService.js';
import type { JwtPayload } from '@nutriclinica/shared';

interface SignalingMessage {
  type: 'join-room' | 'leave-room' | 'offer' | 'answer' | 'ice-candidate' | 'peer-joined' | 'peer-left';
  salaId: string;
  targetId?: string;
  payload?: unknown;
}

interface ClientInfo {
  ws: WebSocket;
  userId: string;
  email: string;
  salaId: string | null;
}

const clients = new Map<WebSocket, ClientInfo>();

function send(ws: WebSocket, message: SignalingMessage): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

function broadcastToRoom(salaId: string, message: SignalingMessage, exclude?: WebSocket): void {
  for (const [ws, info] of clients) {
    if (info.salaId === salaId && ws !== exclude) {
      send(ws, message);
    }
  }
}

function getPeersInRoom(salaId: string): { userId: string; email: string }[] {
  const peers: { userId: string; email: string }[] = [];
  for (const [, info] of clients) {
    if (info.salaId === salaId) {
      peers.push({ userId: info.userId, email: info.email });
    }
  }
  return peers;
}

export function createSignalingServer(httpServer: Server): WebSocketServer {
  const wss = new WebSocketServer({ server: httpServer, path: '/ws/telemedicina' });

  wss.on('connection', async (ws, req) => {
    const url = new URL(req.url ?? '', 'http://localhost');
    const token = url.searchParams.get('token');

    if (!token) {
      ws.close(4001, 'Token requerido');
      return;
    }

    let payload: JwtPayload;
    try {
      payload = await verifyToken(token);
    } catch {
      ws.close(4001, 'Token inválido');
      return;
    }

    const clientInfo: ClientInfo = {
      ws,
      userId: payload.sub,
      email: payload.email,
      salaId: null,
    };
    clients.set(ws, clientInfo);

    ws.on('message', (raw) => {
      let msg: SignalingMessage;
      try {
        msg = JSON.parse(raw.toString()) as SignalingMessage;
      } catch {
        return;
      }

      switch (msg.type) {
        case 'join-room': {
          clientInfo.salaId = msg.salaId;
          broadcastToRoom(msg.salaId, { type: 'peer-joined', salaId: msg.salaId, targetId: payload.sub, payload: { userId: payload.sub, email: payload.email } }, ws);
          const peers = getPeersInRoom(msg.salaId).filter((p) => p.userId !== payload.sub);
          send(ws, { type: 'join-room', salaId: msg.salaId, payload: { peers } });
          break;
        }
        case 'leave-room': {
          clientInfo.salaId = null;
          broadcastToRoom(msg.salaId, { type: 'peer-left', salaId: msg.salaId, targetId: payload.sub }, ws);
          break;
        }
        case 'offer':
        case 'answer':
        case 'ice-candidate': {
          broadcastToRoom(msg.salaId, { ...msg, targetId: payload.sub }, ws);
          break;
        }
      }
    });

    ws.on('close', () => {
      if (clientInfo.salaId) {
        broadcastToRoom(clientInfo.salaId, { type: 'peer-left', salaId: clientInfo.salaId, targetId: payload.sub }, ws);
      }
      clients.delete(ws);
    });

    ws.on('error', () => {
      clients.delete(ws);
    });
  });

  return wss;
}
