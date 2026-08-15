import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { WebSocket } from "ws";
import {
  consumeWsTicket,
  generateWsTicket,
  hashWsTicket,
  isWsOriginAllowed,
  issueWsTicket,
  registerWsChannelHandler,
  setupWebsocketGateway,
  unregisterWsChannelHandler,
  WS_TICKET_TTL_SECONDS,
  type WsTicketInfo,
} from "./websocketGateway.js";

const { mockRequestInput, mockRequestQuery, mockPoolRequest, mockGetPool } =
  vi.hoisted(() => {
    const mockRequestInput = vi.fn().mockReturnThis();
    const mockRequestQuery = vi.fn();
    const mockPoolRequest = vi.fn(() => ({
      input: mockRequestInput,
      query: mockRequestQuery,
    }));
    return {
      mockRequestInput,
      mockRequestQuery,
      mockPoolRequest,
      mockGetPool: vi.fn(async () => ({ request: mockPoolRequest })),
    };
  });

vi.mock("mssql", () => {
  const type = () => ({ type: "mock-type" });
  return {
    default: { UniqueIdentifier: type, NVarChar: type, DateTime2: type },
  };
});

vi.mock("../../db/connection.js", () => ({
  getPool: mockGetPool,
}));

const ORIGIN_ALLOWED = "http://localhost:1420";
const TICKET_HEX = "a".repeat(64);

function ticketRow(
  overrides: Partial<Record<string, unknown>> = {},
): Record<string, unknown> {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    channel: "chat",
    sub: "prof-1",
    sucursal_id: "s1",
    resource_id: null,
    paciente_id: "pat-1",
    origin: ORIGIN_ALLOWED,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequestInput.mockReturnThis();
  mockPoolRequest.mockImplementation(() => ({
    input: mockRequestInput,
    query: mockRequestQuery,
  }));
  mockRequestQuery.mockResolvedValue({ recordset: [] });
});

afterEach(() => {
  unregisterWsChannelHandler("telemedicina");
  unregisterWsChannelHandler("chat");
});

describe("ticket primitives", () => {
  it("generateWsTicket produces opaque 64-char hex values", () => {
    const ticket = generateWsTicket();
    expect(ticket).toMatch(/^[0-9a-f]{64}$/);
    expect(generateWsTicket()).not.toBe(ticket);
  });

  it("hashWsTicket is a deterministic SHA-256 that never exposes the ticket", () => {
    const hash = hashWsTicket("secret-ticket");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).toBe(hashWsTicket("secret-ticket"));
    expect(hash).not.toContain("secret-ticket");
  });

  it("consumeWsTicket rejects malformed tickets before touching the database", async () => {
    await expect(consumeWsTicket("not-a-hex-ticket")).resolves.toBeNull();
    await expect(consumeWsTicket("abc")).resolves.toBeNull();
    expect(mockGetPool).not.toHaveBeenCalled();
  });

  it("consumeWsTicket returns null when the ticket is missing, expired or already used", async () => {
    mockRequestQuery.mockResolvedValueOnce({ recordset: [] });
    await expect(consumeWsTicket(TICKET_HEX)).resolves.toBeNull();
  });

  it("consumeWsTicket atomically maps the consumed row to ticket info", async () => {
    mockRequestQuery.mockResolvedValueOnce({ recordset: [ticketRow()] });
    const info = await consumeWsTicket(TICKET_HEX);
    expect(info).toEqual<WsTicketInfo>({
      ticketId: "11111111-1111-1111-1111-111111111111",
      channel: "chat",
      sub: "prof-1",
      sucursalId: "s1",
      resourceId: null,
      pacienteId: "pat-1",
      origin: ORIGIN_ALLOWED,
    });
    const query = String(mockRequestQuery.mock.calls[0]?.[0]);
    expect(query).toContain("UPDATE websocket_tickets");
    expect(query).toContain("consumed_at IS NULL");
    expect(query).toContain("expires_at > SYSUTCDATETIME()");
  });

  it("issueWsTicket stores only the hash and returns the plain ticket once", async () => {
    const issued = await issueWsTicket({
      channel: "telemedicina",
      sub: "prof-1",
      sucursalId: "s1",
      resourceId: "11111111-1111-1111-1111-111111111222",
      pacienteId: null,
      origin: ORIGIN_ALLOWED,
    });
    expect(issued.ticket).toMatch(/^[0-9a-f]{64}$/);
    expect(new Date(issued.expiresAt).getTime()).toBeGreaterThan(Date.now());
    const hashCall = mockRequestInput.mock.calls.find(
      ([name]) => name === "ticket_hash",
    );
    expect(hashCall?.[2]).toBe(hashWsTicket(issued.ticket));
    expect(
      mockRequestInput.mock.calls.find(([name]) => name === "channel")?.[2],
    ).toBe("telemedicina");
  });

  it("tickets expire shortly after issuance", () => {
    expect(WS_TICKET_TTL_SECONDS).toBeGreaterThanOrEqual(30);
    expect(WS_TICKET_TTL_SECONDS).toBeLessThanOrEqual(60);
  });
});

describe("isWsOriginAllowed", () => {
  const originalOrigin = process.env.CORS_ORIGIN;

  afterEach(() => {
    if (originalOrigin === undefined) delete process.env.CORS_ORIGIN;
    else process.env.CORS_ORIGIN = originalOrigin;
  });

  it("allows the default local origins and missing origin (native clients)", () => {
    delete process.env.CORS_ORIGIN;
    expect(isWsOriginAllowed("http://localhost:1420")).toBe(true);
    expect(isWsOriginAllowed("http://127.0.0.1:1420")).toBe(true);
    expect(isWsOriginAllowed("tauri://localhost")).toBe(true);
    expect(isWsOriginAllowed(undefined)).toBe(true);
    expect(isWsOriginAllowed(null)).toBe(true);
    expect(isWsOriginAllowed("https://evil.example")).toBe(false);
  });

  it("respects a custom CORS_ORIGIN allowlist", () => {
    process.env.CORS_ORIGIN = "https://app.example.com";
    expect(isWsOriginAllowed("https://app.example.com")).toBe(true);
    expect(isWsOriginAllowed("http://localhost:1420")).toBe(false);
  });
});

describe("setupWebsocketGateway upgrade flow", () => {
  function expectRejected(
    port: number,
    path: string,
    expectedStatus: number,
    origin?: string,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const client = new WebSocket(
        `ws://127.0.0.1:${port}${path}`,
        origin ? { origin } : undefined,
      );
      const timer = setTimeout(() => {
        client.terminate();
        reject(new Error("timeout waiting for upgrade rejection"));
      }, 4000);
      client.on("unexpected-response", (_req, res) => {
        clearTimeout(timer);
        client.terminate();
        try {
          expect(res.statusCode).toBe(expectedStatus);
          resolve();
        } catch (err) {
          reject(err);
        }
      });
      client.on("error", () => {
        // unexpected-response is the authoritative signal
      });
    });
  }

  it("rejects unknown ws paths without touching the database", async () => {
    const httpServer = createServer();
    setupWebsocketGateway(httpServer);
    await new Promise<void>((resolve) => httpServer.listen(0, resolve));
    const port = (httpServer.address() as AddressInfo).port;
    try {
      await expectRejected(port, "/ws/nope?ticket=abc", 404, ORIGIN_ALLOWED);
      expect(mockGetPool).not.toHaveBeenCalled();
    } finally {
      await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    }
  });

  it("rejects disallowed origins before ticket validation", async () => {
    const httpServer = createServer();
    setupWebsocketGateway(httpServer);
    await new Promise<void>((resolve) => httpServer.listen(0, resolve));
    const port = (httpServer.address() as AddressInfo).port;
    try {
      await expectRejected(
        port,
        "/ws/chat?ticket=abc",
        403,
        "https://evil.example",
      );
      expect(mockGetPool).not.toHaveBeenCalled();
    } finally {
      await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    }
  });

  it("rejects upgrades without a ticket before consuming", async () => {
    const httpServer = createServer();
    setupWebsocketGateway(httpServer);
    await new Promise<void>((resolve) => httpServer.listen(0, resolve));
    const port = (httpServer.address() as AddressInfo).port;
    try {
      await expectRejected(port, "/ws/chat", 401, ORIGIN_ALLOWED);
      expect(mockGetPool).not.toHaveBeenCalled();
    } finally {
      await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    }
  });

  it("rejects a ticket bound to a different channel", async () => {
    const httpServer = createServer();
    setupWebsocketGateway(httpServer);
    await new Promise<void>((resolve) => httpServer.listen(0, resolve));
    const port = (httpServer.address() as AddressInfo).port;
    try {
      mockRequestQuery.mockResolvedValueOnce({
        recordset: [ticketRow({ channel: "telemedicina" })],
      });
      await expectRejected(
        port,
        `/ws/chat?ticket=${TICKET_HEX}`,
        401,
        ORIGIN_ALLOWED,
      );
    } finally {
      await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    }
  });

  it("rejects a missing/expired/already-consumed ticket", async () => {
    const httpServer = createServer();
    setupWebsocketGateway(httpServer);
    await new Promise<void>((resolve) => httpServer.listen(0, resolve));
    const port = (httpServer.address() as AddressInfo).port;
    try {
      await expectRejected(
        port,
        `/ws/chat?ticket=${TICKET_HEX}`,
        401,
        ORIGIN_ALLOWED,
      );
    } finally {
      await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    }
  });

  it("accepts a valid one-time ticket, dispatches the channel handler and blocks replay", async () => {
    const httpServer = createServer();
    const gateway = setupWebsocketGateway(httpServer);
    const handler = vi.fn();
    registerWsChannelHandler("chat", handler);
    await new Promise<void>((resolve) => httpServer.listen(0, resolve));
    const port = (httpServer.address() as AddressInfo).port;
    try {
      mockRequestQuery.mockResolvedValueOnce({ recordset: [ticketRow()] });

      const client = new WebSocket(
        `ws://127.0.0.1:${port}/ws/chat?ticket=${TICKET_HEX}`,
        { origin: ORIGIN_ALLOWED },
      );
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error("timeout waiting for ws open")),
          4000,
        );
        client.on("open", () => {
          clearTimeout(timer);
          resolve();
        });
        client.on("error", () => {});
      });

      expect(handler).toHaveBeenCalledTimes(1);
      const [ws, info] = handler.mock.calls[0] as [WebSocket, WsTicketInfo];
      expect(ws).toBeDefined();
      expect(info.channel).toBe("chat");
      expect(info.sub).toBe("prof-1");
      expect(info.pacienteId).toBe("pat-1");

      client.close();
      await new Promise<void>((resolve) => setTimeout(resolve, 50));

      await expectRejected(
        port,
        `/ws/chat?ticket=${TICKET_HEX}`,
        401,
        ORIGIN_ALLOWED,
      );
    } finally {
      await new Promise<void>((resolve) => gateway.close(() => resolve()));
      await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    }
  });

  it("rejects a ticket issued for a different origin", async () => {
    const httpServer = createServer();
    const gateway = setupWebsocketGateway(httpServer);
    const handler = vi.fn();
    registerWsChannelHandler("chat", handler);
    await new Promise<void>((resolve) => httpServer.listen(0, resolve));
    const port = (httpServer.address() as AddressInfo).port;
    try {
      mockRequestQuery.mockResolvedValueOnce({
        recordset: [ticketRow({ origin: "http://evil.example" })],
      });

      await expectRejected(
        port,
        `/ws/chat?ticket=${TICKET_HEX}`,
        403,
        ORIGIN_ALLOWED,
      );
      expect(handler).not.toHaveBeenCalled();
    } finally {
      await new Promise<void>((resolve) => gateway.close(() => resolve()));
      await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    }
  });

  it("accepts a ticket without stored origin from a native client (no Origin header)", async () => {
    const httpServer = createServer();
    const gateway = setupWebsocketGateway(httpServer);
    const handler = vi.fn();
    registerWsChannelHandler("chat", handler);
    await new Promise<void>((resolve) => httpServer.listen(0, resolve));
    const port = (httpServer.address() as AddressInfo).port;
    try {
      mockRequestQuery.mockResolvedValueOnce({
        recordset: [ticketRow({ origin: "" })],
      });

      const client = new WebSocket(
        `ws://127.0.0.1:${port}/ws/chat?ticket=${TICKET_HEX}`,
      );
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error("timeout waiting for ws open")),
          4000,
        );
        client.on("open", () => {
          clearTimeout(timer);
          resolve();
        });
        client.on("error", () => {});
      });

      expect(handler).toHaveBeenCalledTimes(1);
      client.close();
      await new Promise<void>((resolve) => setTimeout(resolve, 50));
    } finally {
      await new Promise<void>((resolve) => gateway.close(() => resolve()));
      await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    }
  });

  it("returns 503 when no channel handler is registered", async () => {
    const httpServer = createServer();
    const gateway = setupWebsocketGateway(httpServer);
    await new Promise<void>((resolve) => httpServer.listen(0, resolve));
    const port = (httpServer.address() as AddressInfo).port;
    try {
      mockRequestQuery.mockResolvedValueOnce({
        recordset: [
          ticketRow({
            channel: "telemedicina",
            resource_id: "11111111-1111-1111-1111-111111111222",
          }),
        ],
      });
      await expectRejected(
        port,
        `/ws/telemedicina?ticket=${TICKET_HEX}`,
        503,
        ORIGIN_ALLOWED,
      );
    } finally {
      await new Promise<void>((resolve) => gateway.close(() => resolve()));
      await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    }
  });
});
