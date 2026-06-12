import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'node:http';
import sql from 'mssql';
import { getPool } from '../../db/connection.js';
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
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

export async function canJoinSala(salaId: string, payload: JwtPayload): Promise<boolean> {
  if (!UUID_REGEX.test(salaId)) return false;
  const pool = await getPool();
  const result = await pool
    .request()
    .input('id', sql.UniqueIdentifier(), salaId)
    .query<{ sucursal_id: string }>(`SELECT TOP 1 sucursal_id FROM video_salas WHERE id = @id AND deleted_at IS NULL`);
  const sala = result.recordset[0];
  if (!sala) return false;
  return payload.rol === 'admin' || payload.sucursalIds.includes(sala.sucursal_id);
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
      void (async () => {
      let msg: SignalingMessage;
      try {
        msg = JSON.parse(raw.toString()) as SignalingMessage;
      } catch {
        return;
      }

      switch (msg.type) {
        case 'join-room': {
          if (!(await canJoinSala(msg.salaId, payload))) {
            ws.close(4003, 'Sin acceso a la sala');
            return;
          }
          clientInfo.salaId = msg.salaId;
          broadcastToRoom(msg.salaId, { type: 'peer-joined', salaId: msg.salaId, targetId: payload.sub, payload: { userId: payload.sub, email: payload.email } }, ws);
          const peers = getPeersInRoom(msg.salaId).filter((p) => p.userId !== payload.sub);
          send(ws, { type: 'join-room', salaId: msg.salaId, payload: { peers } });
          break;
        }
        case 'leave-room': {
          if (clientInfo.salaId !== msg.salaId) return;
          clientInfo.salaId = null;
          broadcastToRoom(msg.salaId, { type: 'peer-left', salaId: msg.salaId, targetId: payload.sub }, ws);
          break;
        }
        case 'offer':
        case 'answer':
        case 'ice-candidate': {
          if (clientInfo.salaId !== msg.salaId) return;
          broadcastToRoom(msg.salaId, { ...msg, targetId: payload.sub }, ws);
          break;
        }
      }
      })().catch(() => ws.close(1011, 'Error de señalización'));
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
