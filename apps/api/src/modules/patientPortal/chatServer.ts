import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'node:http';
import sql from 'mssql';
import { getPool } from '../../db/connection.js';
import { verifyToken } from '../auth/application/authService.js';
import type { JwtPayload } from '@nutriclinica/shared';

interface ChatMessage {
  type: 'message:new' | 'message:read';
  pacienteId: string;
  message?: Record<string, unknown>;
  messageId?: string;
  readAt?: string | null;
}

interface ClientInfo {
  ws: WebSocket;
  userId: string;
  pacienteId: string | null;
}

const clients = new Map<WebSocket, ClientInfo>();

function send(ws: WebSocket, message: ChatMessage): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

export function broadcastMessageNew(pacienteId: string, message: Record<string, unknown>): void {
  for (const [ws, info] of clients) {
    if (info.pacienteId === pacienteId) {
      send(ws, { type: 'message:new', pacienteId, message });
    }
  }
}

export function broadcastMessageRead(pacienteId: string, messageId: string, readAt: string | null): void {
  for (const [ws, info] of clients) {
    if (info.pacienteId === pacienteId) {
      send(ws, { type: 'message:read', pacienteId, messageId, readAt });
    }
  }
}

function isConnectedPacienteId(pacienteId: string): boolean {
  for (const [, info] of clients) {
    if (info.pacienteId === pacienteId) return true;
  }
  return false;
}

export function createChatServer(httpServer: Server): WebSocketServer {
  const wss = new WebSocketServer({ server: httpServer, path: '/ws/chat' });

  wss.on('connection', async (ws, req) => {
    const url = new URL(req.url ?? '', 'http://localhost');
    const token = url.searchParams.get('token');
    const portalToken = url.searchParams.get('portalToken');

    let userId: string;
    let pacienteId: string | null = null;

    if (token) {
      let payload: JwtPayload;
      try {
        payload = await verifyToken(token);
      } catch {
        ws.close(4001, 'Token inválido');
        return;
      }
      userId = payload.sub;

      const pId = url.searchParams.get('pacienteId');
      if (pId) {
        const isValid = typeof pId === 'string' && /^[0-9a-f-]{36}$/i.test(pId);
        if (isValid) {
          pacienteId = pId;
        }
      }
    } else if (portalToken) {
      const pool = await getPool();
      const result = await pool
        .request()
        .input('token', sql.NVarChar(512), portalToken)
        .query<{ paciente_id: string; expires_at: Date; revoked_at: Date | null }>(
          `SELECT paciente_id, expires_at, revoked_at
             FROM patient_portal_tokens
            WHERE token_hash = CONVERT(NVARCHAR(64), HASHBYTES('SHA2_256', @token), 2)
              AND revoked_at IS NULL
              AND expires_at > SYSUTCDATETIME()`,
        );
      const row = result.recordset[0];
      if (!row) {
        ws.close(4001, 'Token de portal inválido o expirado');
        return;
      }
      userId = row.paciente_id;
      pacienteId = row.paciente_id;
    } else {
      ws.close(4001, 'Token requerido');
      return;
    }

    const clientInfo: ClientInfo = { ws, userId, pacienteId };
    clients.set(ws, clientInfo);

    ws.on('close', () => {
      clients.delete(ws);
    });

    ws.on('error', () => {
      clients.delete(ws);
    });
  });

  return wss;
}

export { isConnectedPacienteId };
