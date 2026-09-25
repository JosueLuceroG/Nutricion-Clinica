import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { Server, IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";
import { WebSocketServer, type WebSocket } from "ws";
import sql from "mssql";
import { WS_TICKET_PROTOCOL } from "@nutriclinica/shared";
import { getPool } from "../../db/connection.js";

export const WS_TICKET_TTL_SECONDS = 60;
export { WS_TICKET_PROTOCOL };
export const WS_EXPIRED_TICKET_CLEANUP_BATCH_SIZE = 100;
export const WS_MAX_PAYLOAD_BYTES = 64 * 1024;
const WS_TICKET_HEX_LENGTH = 64;
const WS_TICKET_REGEX = /^[0-9a-f]{64}$/;

export type WsChannel = "telemedicina" | "chat";

export interface WsTicketRequest {
  channel: WsChannel;
  sub: string;
  sucursalId: string | null;
  resourceId: string | null;
  pacienteId: string | null;
  origin: string;
}

export interface WsTicketInfo extends WsTicketRequest {
  ticketId: string;
}

interface WsTicketRow {
  id: string;
  channel: WsChannel;
  sub: string;
  sucursal_id: string | null;
  resource_id: string | null;
  paciente_id: string | null;
  origin: string;
}

export type WsChannelHandler = (ws: WebSocket, info: WsTicketInfo) => void;

const channelHandlers = new Map<WsChannel, WsChannelHandler>();

function normalizeOrigin(origin: string | null | undefined): string {
  return origin?.trim().replace(/\/$/, "") ?? "";
}

export function registerWsChannelHandler(
  channel: WsChannel,
  handler: WsChannelHandler,
): void {
  channelHandlers.set(channel, handler);
}

export function unregisterWsChannelHandler(channel: WsChannel): void {
  channelHandlers.delete(channel);
}

export function hashWsTicket(ticket: string): string {
  return createHash("sha256").update(ticket, "utf8").digest("hex");
}

export function generateWsTicket(): string {
  return randomBytes(WS_TICKET_HEX_LENGTH / 2).toString("hex");
}

export function ticketFromWebSocketProtocols(
  header: string | string[] | undefined,
): string | null {
  const protocols = (Array.isArray(header) ? header.join(",") : (header ?? ""))
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (
    protocols.length !== 2 ||
    protocols[0] !== WS_TICKET_PROTOCOL ||
    !WS_TICKET_REGEX.test(protocols[1] ?? "")
  ) {
    return null;
  }
  return protocols[1]!;
}

export function isWsOriginAllowed(origin: string | null | undefined): boolean {
  if (!origin) return true;
  const allowed = (
    process.env.CORS_ORIGIN ??
    "http://localhost:1420,http://127.0.0.1:1420,tauri://localhost"
  )
    .split(",")
    .map((value) => normalizeOrigin(value))
    .filter(Boolean);
  return allowed.includes(normalizeOrigin(origin));
}

export async function issueWsTicket(
  input: WsTicketRequest,
): Promise<{ ticket: string; expiresAt: string }> {
  const ticket = generateWsTicket();
  const pool = await getPool();
  const result = await pool
    .request()
    .input("id", sql.UniqueIdentifier(), randomUUID())
    .input("ticket_hash", sql.NVarChar(64), hashWsTicket(ticket))
    .input("channel", sql.NVarChar(40), input.channel)
    .input("sub", sql.NVarChar(64), input.sub)
    .input("sucursal_id", sql.UniqueIdentifier(), input.sucursalId)
    .input("resource_id", sql.UniqueIdentifier(), input.resourceId)
    .input("paciente_id", sql.UniqueIdentifier(), input.pacienteId)
    .input("origin", sql.NVarChar(255), normalizeOrigin(input.origin))
    .input("ttl_seconds", sql.Int, WS_TICKET_TTL_SECONDS)
    .input("cleanup_batch_size", sql.Int, WS_EXPIRED_TICKET_CLEANUP_BATCH_SIZE)
    .query<{ expires_at: Date }>(
      `DELETE TOP (@cleanup_batch_size) FROM websocket_tickets
         WHERE expires_at <= SYSUTCDATETIME();

       INSERT INTO websocket_tickets
         (id, ticket_hash, channel, sub, sucursal_id, resource_id, paciente_id, origin, expires_at)
        OUTPUT INSERTED.expires_at
        VALUES
         (@id, @ticket_hash, @channel, @sub, @sucursal_id, @resource_id, @paciente_id, @origin,
          DATEADD(SECOND, @ttl_seconds, SYSUTCDATETIME()))`,
    );
  const expiresAt = result.recordset[0]?.expires_at;
  if (!(expiresAt instanceof Date)) {
    throw new Error("websocket ticket expiry was not returned by SQL Server");
  }
  return { ticket, expiresAt: expiresAt.toISOString() };
}

export async function consumeWsTicket(
  ticket: string,
  expected?: { channel: WsChannel; origin: string },
): Promise<WsTicketInfo | null> {
  if (!WS_TICKET_REGEX.test(ticket)) return null;
  const pool = await getPool();
  const result = await pool
    .request()
    .input("ticket_hash", sql.NVarChar(64), hashWsTicket(ticket))
    .input("expected_channel", sql.NVarChar(40), expected?.channel ?? null)
    .input(
      "expected_origin",
      sql.NVarChar(255),
      expected ? normalizeOrigin(expected.origin) : null,
    )
    .query<WsTicketRow>(
      `DELETE FROM websocket_tickets WITH (ROWLOCK)
       OUTPUT DELETED.id, DELETED.channel, DELETED.sub,
              DELETED.sucursal_id, DELETED.resource_id,
              DELETED.paciente_id, DELETED.origin
         WHERE ticket_hash = @ticket_hash
           AND (@expected_channel IS NULL OR channel = @expected_channel)
           AND (@expected_origin IS NULL OR origin = @expected_origin)
          AND consumed_at IS NULL
          AND revoked_at IS NULL
          AND expires_at > SYSUTCDATETIME()`,
    );
  const row = result.recordset[0];
  if (!row) return null;
  return {
    ticketId: row.id,
    channel: row.channel,
    sub: row.sub,
    sucursalId: row.sucursal_id,
    resourceId: row.resource_id,
    pacienteId: row.paciente_id,
    origin: row.origin,
  };
}

function rejectUpgrade(socket: Duplex, status: number): void {
  const reason =
    status === 400
      ? "Bad Request"
      : status === 404
        ? "Not Found"
        : status === 403
          ? "Forbidden"
          : status === 503
            ? "Service Unavailable"
            : "Unauthorized";
  socket.write(`HTTP/1.1 ${status} ${reason}\r\nConnection: close\r\n\r\n`);
  socket.destroy();
}

export function setupWebsocketGateway(
  httpServer: Server,
  handlers?: Partial<Record<WsChannel, WsChannelHandler>>,
): WebSocketServer {
  if (handlers) {
    for (const [channel, handler] of Object.entries(handlers)) {
      if (handler) registerWsChannelHandler(channel as WsChannel, handler);
    }
  }

  const wss = new WebSocketServer({
    noServer: true,
    maxPayload: WS_MAX_PAYLOAD_BYTES,
    handleProtocols(protocols) {
      return protocols.has(WS_TICKET_PROTOCOL) ? WS_TICKET_PROTOCOL : false;
    },
  });

  httpServer.on(
    "upgrade",
    (req: IncomingMessage, socket: Duplex, head: Buffer) => {
      void (async () => {
        let url: URL;
        try {
          url = new URL(req.url ?? "", "http://localhost");
        } catch {
          rejectUpgrade(socket, 400);
          return;
        }

        const pathname = url.pathname.replace(/^\/api(?=\/)/, "");
        let channel: WsChannel | null = null;
        if (pathname === "/ws/telemedicina") channel = "telemedicina";
        else if (pathname === "/ws/chat") channel = "chat";
        if (!channel) {
          rejectUpgrade(socket, 404);
          return;
        }

        if (!isWsOriginAllowed(req.headers.origin)) {
          rejectUpgrade(socket, 403);
          return;
        }

        if (url.search.length > 0) {
          rejectUpgrade(socket, 400);
          return;
        }

        const ticket = ticketFromWebSocketProtocols(
          req.headers["sec-websocket-protocol"],
        );
        if (!ticket) {
          rejectUpgrade(socket, 401);
          return;
        }

        const handler = channelHandlers.get(channel);
        if (!handler) {
          rejectUpgrade(socket, 503);
          return;
        }

        const requestOrigin = normalizeOrigin(req.headers.origin);
        const info = await consumeWsTicket(ticket, {
          channel,
          origin: requestOrigin,
        });
        if (!info || info.channel !== channel) {
          rejectUpgrade(socket, 401);
          return;
        }

        if (normalizeOrigin(info.origin) !== requestOrigin) {
          rejectUpgrade(socket, 403);
          return;
        }

        wss.handleUpgrade(req, socket, head, (ws) => {
          handler(ws, info);
        });
      })().catch(() => {
        rejectUpgrade(socket, 500);
      });
    },
  );

  return wss;
}
