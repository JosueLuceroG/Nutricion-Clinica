import { WebSocket } from 'ws';
import type { WsTicketInfo } from '../ws/websocketGateway.js';

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

export function registerChatChannel(ws: WebSocket, info: WsTicketInfo): void {
  const clientInfo: ClientInfo = {
    ws,
    userId: info.sub,
    pacienteId: info.pacienteId,
  };
  clients.set(ws, clientInfo);

  ws.on('close', () => {
    clients.delete(ws);
  });

  ws.on('error', () => {
    clients.delete(ws);
  });
}

export { isConnectedPacienteId };