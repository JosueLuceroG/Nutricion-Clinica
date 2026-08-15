import { WebSocket } from 'ws';
import sql from 'mssql';
import { getPool } from '../../db/connection.js';
import type { JwtPayload } from '@nutriclinica/shared';
import type { WsTicketInfo } from '../ws/websocketGateway.js';

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

export function registerTelemedicinaChannel(ws: WebSocket, info: WsTicketInfo): void {
  const clientInfo: ClientInfo = {
    ws,
    userId: info.sub,
    email: '',
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
          if (!UUID_REGEX.test(msg.salaId) || msg.salaId !== info.resourceId) {
            ws.close(4003, 'Sin acceso a la sala');
            return;
          }
          const pool = await getPool();
          const emailResult = await pool
            .request()
            .input('userId', sql.UniqueIdentifier(), info.sub)
            .query<{ email: string }>(`SELECT TOP 1 email FROM usuarios WHERE id = @userId AND deleted_at IS NULL`);
          const row = emailResult.recordset[0];
          clientInfo.email = row?.email ?? '';
          clientInfo.salaId = msg.salaId;
          broadcastToRoom(msg.salaId, { type: 'peer-joined', salaId: msg.salaId, targetId: info.sub, payload: { userId: info.sub, email: clientInfo.email } }, ws);
          const peers = getPeersInRoom(msg.salaId).filter((p) => p.userId !== info.sub);
          send(ws, { type: 'join-room', salaId: msg.salaId, payload: { peers } });
          break;
        }
        case 'leave-room': {
          if (clientInfo.salaId !== msg.salaId) return;
          clientInfo.salaId = null;
          broadcastToRoom(msg.salaId, { type: 'peer-left', salaId: msg.salaId, targetId: info.sub }, ws);
          break;
        }
        case 'offer':
        case 'answer':
        case 'ice-candidate': {
          if (clientInfo.salaId !== msg.salaId) return;
          broadcastToRoom(msg.salaId, { ...msg, targetId: info.sub }, ws);
          break;
        }
      }
    })().catch(() => ws.close(1011, 'Error de señalización'));
  });

  ws.on('close', () => {
    if (clientInfo.salaId) {
      broadcastToRoom(clientInfo.salaId, { type: 'peer-left', salaId: clientInfo.salaId, targetId: info.sub }, ws);
    }
    clients.delete(ws);
  });

  ws.on('error', () => {
    clients.delete(ws);
  });
}