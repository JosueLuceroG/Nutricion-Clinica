import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { JwtPayload } from '@nutriclinica/shared';

const { mockRequestInput, mockRequestQuery, mockPoolRequest, mockGetPool } = vi.hoisted(() => {
  const mockRequestInput = vi.fn().mockReturnThis();
  const mockRequestQuery = vi.fn();
  const mockPoolRequest = vi.fn(() => ({ input: mockRequestInput, query: mockRequestQuery }));
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

import { canJoinSala } from './signalingServer.js';

const salaId = '00000000-0000-0000-0000-000000000111';

function payload(overrides: Partial<JwtPayload> = {}): JwtPayload {
  return {
    sub: 'p1',
    email: 'p1@example.com',
    rol: 'nutriologa',
    sucursalIds: ['s1'],
    iat: 1,
    exp: 2,
    ...overrides,
  };
}

describe('canJoinSala', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequestInput.mockReturnThis();
    mockPoolRequest.mockImplementation(() => ({ input: mockRequestInput, query: mockRequestQuery }));
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
    mockRequestQuery.mockResolvedValueOnce({ recordset: [{ sucursal_id: 'other' }] });

    await expect(canJoinSala(salaId, payload({ rol: 'admin', sucursalIds: [] }))).resolves.toBe(true);
  });

  it('allows users assigned to the room branch', async () => {
    mockRequestQuery.mockResolvedValueOnce({ recordset: [{ sucursal_id: 's1' }] });

    await expect(canJoinSala(salaId, payload({ sucursalIds: ['s1', 's2'] }))).resolves.toBe(true);
  });

  it('rejects users from another branch', async () => {
    mockRequestQuery.mockResolvedValueOnce({ recordset: [{ sucursal_id: 's2' }] });

    await expect(canJoinSala(salaId, payload({ sucursalIds: ['s1'] }))).resolves.toBe(false);
  });
});
