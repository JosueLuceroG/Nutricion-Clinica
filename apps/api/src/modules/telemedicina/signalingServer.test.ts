import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import { WebSocket } from 'ws';
import type { JwtPayload } from '@nutriclinica/shared';
import type { WsTicketInfo } from '../ws/websocketGateway.js';

const { mockRequestInput, mockRequestQuery, mockPoolRequest, mockGetPool } = vi.hoisted(() => {
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

vi.mock('mssql', () => {
  const UniqueIdentifier = () => ({ type: 'UniqueIdentifier' });
  return { default: { UniqueIdentifier } };
});

vi.mock('../../db/connection.js', () => ({
  getPool: mockGetPool,
}));

vi.mock('../auth/application/authService.js', () => ({
  verifyToken: vi.fn(),
}));

import { canJoinSala, registerTelemedicinaChannel } from './signalingServer.js';

const salaId = '00000000-0000-0000-0000-000000000111';

function payload(overrides: Partial<JwtPayload> = {}): JwtPayload {
  return {
    tokenType: 'access',
    sub: 'p1',
    email: 'p1@example.com',
    rol: 'nutriologa',
    sucursalIds: ['s1'],
    totpVerified: true,
    ver: 1,
    iat: 1,
    exp: 2,
    iss: 'nutriclinica-api',
    aud: 'nutriclinica-web',
    ...overrides,
  };
}

describe('canJoinSala', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequestInput.mockReturnThis();
    mockPoolRequest.mockImplementation(() => ({
      input: mockRequestInput,
      query: mockRequestQuery,
    }));
  });

  it('rejects invalid room ids before querying SQL Server', async () => {
    await expect(canJoinSala('not-a-uuid', payload())).resolves.toBe(false);

    expect(mockGetPool).not.toHaveBeenCalled();
  });

  it('rejects missing rooms', async () => {
    mockRequestQuery.mockResolvedValueOnce({ recordset: [] });

    await expect(canJoinSala(salaId, payload())).resolves.toBe(false);
  });

  it('allows admins for an existing room', async () => {
    mockRequestQuery.mockResolvedValueOnce({
      recordset: [{ sucursal_id: 'other' }],
    });

    await expect(
      canJoinSala(salaId, payload({ rol: 'admin', sucursalIds: [] })),
    ).resolves.toBe(true);
  });

  it('allows users assigned to the room branch', async () => {
    mockRequestQuery.mockResolvedValueOnce({
      recordset: [{ sucursal_id: 's1' }],
    });

    await expect(
      canJoinSala(salaId, payload({ sucursalIds: ['s1', 's2'] })),
    ).resolves.toBe(true);
  });

  it('rejects users from another branch', async () => {
    mockRequestQuery.mockResolvedValueOnce({
      recordset: [{ sucursal_id: 's2' }],
    });

    await expect(
      canJoinSala(salaId, payload({ sucursalIds: ['s1'] })),
    ).resolves.toBe(false);
  });
});

describe('registerTelemedicinaChannel', () => {
  function fakeWs() {
    const emitter = new EventEmitter();
    return Object.assign(emitter, {
      readyState: WebSocket.OPEN,
      send: vi.fn(),
      close: vi.fn(),
    }) as unknown as WebSocket & {
      send: ReturnType<typeof vi.fn>;
      close: ReturnType<typeof vi.fn>;
    };
  }

  function ticketInfo(overrides: Partial<WsTicketInfo> = {}): WsTicketInfo {
    return {
      ticketId: 't-1',
      channel: 'telemedicina',
      sub: 'p1',
      sucursalId: 's1',
      resourceId: salaId,
      pacienteId: null,
      origin: 'http://localhost:1420',
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

  it('rejects join-room on a sala different from the ticket binding', async () => {
    const ws = fakeWs();
    registerTelemedicinaChannel(ws, ticketInfo());

    ws.emit(
      'message',
      JSON.stringify({
        type: 'join-room',
        salaId: '00000000-0000-0000-0000-000000000999',
      }),
    );
    await vi.waitFor(() =>
      expect(ws.close).toHaveBeenCalledWith(4003, 'Sin acceso a la sala'),
    );
    expect(ws.send).not.toHaveBeenCalled();
  });

  it('rejects join-room to a non-uuid sala even if it matches nothing', async () => {
    const ws = fakeWs();
    registerTelemedicinaChannel(ws, ticketInfo());

    ws.emit(
      'message',
      JSON.stringify({ type: 'join-room', salaId: 'not-a-uuid' }),
    );
    await vi.waitFor(() =>
      expect(ws.close).toHaveBeenCalledWith(4003, 'Sin acceso a la sala'),
    );
  });

  it('joins the ticket-bound sala and relays signaling only within the room', async () => {
    const wsA = fakeWs();
    const wsB = fakeWs();
    registerTelemedicinaChannel(wsA, ticketInfo({ sub: 'p1' }));
    registerTelemedicinaChannel(wsB, ticketInfo({ sub: 'p2' }));

    wsA.emit('message', JSON.stringify({ type: 'join-room', salaId }));
    await vi.waitFor(() => expect(wsA.send).toHaveBeenCalled());
    const joinResponse = JSON.parse(wsA.send.mock.calls[0][0] as string) as {
      type: string;
      payload: { peers: unknown[] };
    };
    expect(joinResponse.type).toBe('join-room');
    expect(joinResponse.payload.peers).toEqual([]);

    wsB.emit('message', JSON.stringify({ type: 'join-room', salaId }));
    await vi.waitFor(() =>
      expect(
        wsA.send.mock.calls.some(
          (call) => JSON.parse(call[0] as string).type === 'peer-joined',
        ),
      ).toBe(true),
    );

    wsA.emit(
      'message',
      JSON.stringify({ type: 'offer', salaId, payload: { sdp: 'x' } }),
    );
    await vi.waitFor(() =>
      expect(
        wsB.send.mock.calls.some((call) => {
          const msg = JSON.parse(call[0] as string) as {
            type: string;
            targetId?: string;
          };
          return msg.type === 'offer' && msg.targetId === 'p1';
        }),
      ).toBe(true),
    );
  });

  it('does not relay offers when the sender left the room', async () => {
    const wsA = fakeWs();
    const wsB = fakeWs();
    registerTelemedicinaChannel(wsA, ticketInfo({ sub: 'p1' }));
    registerTelemedicinaChannel(wsB, ticketInfo({ sub: 'p2' }));

    wsA.emit('message', JSON.stringify({ type: 'join-room', salaId }));
    wsB.emit('message', JSON.stringify({ type: 'join-room', salaId }));
    await vi.waitFor(() => expect(wsA.send).toHaveBeenCalled());

    wsA.emit('message', JSON.stringify({ type: 'leave-room', salaId }));
    wsA.emit(
      'message',
      JSON.stringify({ type: 'offer', salaId, payload: { sdp: 'x' } }),
    );
    await new Promise((resolve) => setTimeout(resolve, 20));

    const offersToB = wsB.send.mock.calls.filter(
      (call) => JSON.parse(call[0] as string).type === 'offer',
    );
    expect(offersToB).toHaveLength(0);
  });

  it('cleans up the room when the socket closes', async () => {
    const wsA = fakeWs();
    const wsB = fakeWs();
    registerTelemedicinaChannel(wsA, ticketInfo({ sub: 'p1' }));
    registerTelemedicinaChannel(wsB, ticketInfo({ sub: 'p2' }));

    wsA.emit('message', JSON.stringify({ type: 'join-room', salaId }));
    wsB.emit('message', JSON.stringify({ type: 'join-room', salaId }));
    await vi.waitFor(() => expect(wsA.send).toHaveBeenCalled());

    wsA.emit('close');
    await vi.waitFor(() =>
      expect(
        wsB.send.mock.calls.some((call) => {
          const msg = JSON.parse(call[0] as string) as {
            type: string;
            targetId?: string;
          };
          return msg.type === 'peer-left' && msg.targetId === 'p1';
        }),
      ).toBe(true),
    );
  });
});