import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockHash, mockRequestInput, mockRequestQuery, mockRequestBatch, mockPoolRequest, mockGetPool, mockClosePool } = vi.hoisted(() => ({
  mockHash: vi.fn(async () => '$argon2id$v=19$m=19456,t=2,p=1$hash'),
  mockRequestInput: vi.fn().mockReturnThis(),
  mockRequestQuery: vi.fn(),
  mockRequestBatch: vi.fn(),
  mockPoolRequest: vi.fn(() => ({
    input: mockRequestInput,
    query: mockRequestQuery,
    batch: mockRequestBatch,
  })),
  mockGetPool: vi.fn(async () => ({
    request: mockPoolRequest,
  })),
  mockClosePool: vi.fn(async () => undefined),
}));

vi.mock('argon2', () => ({
  default: {
    hash: mockHash,
    argon2id: 2,
  },
  hash: mockHash,
  argon2id: 2,
}));

vi.mock('mssql', () => {
  const NVarChar = (n: number) => ({ type: 'NVarChar', length: n });
  const UniqueIdentifier = () => ({ type: 'UniqueIdentifier' });
  return {
    default: { NVarChar, UniqueIdentifier },
  };
});

vi.mock('./connection.js', () => ({
  getPool: mockGetPool,
  closePool: mockClosePool,
}));

import { runSeed } from './seed.js';

beforeEach(() => {
  vi.clearAllMocks();
  mockRequestInput.mockReturnThis();
  mockPoolRequest.mockImplementation(() => ({
    input: mockRequestInput,
    query: mockRequestQuery,
    batch: mockRequestBatch,
  }));
});

describe('seed — runSeed', () => {
  it('si admin ya existe, no crea y devuelve sus ids', async () => {
    mockRequestQuery
      .mockResolvedValueOnce({ recordset: [{ id: 'admin-uuid' }] })
      .mockResolvedValueOnce({ recordset: [{ sucursal_id: 'suc-uuid' }] });

    const result = await runSeed();
    expect(result).toEqual({ sucursalId: 'suc-uuid', profesionalId: 'admin-uuid' });
    expect(mockHash).not.toHaveBeenCalled();
  });

  it('si no existe admin, crea sucursal + profesional + asignaci\u00f3n', async () => {
    mockRequestQuery
      .mockResolvedValueOnce({ recordset: [] })
      .mockResolvedValueOnce({ recordset: [] })
      .mockResolvedValueOnce({ recordset: [{ id: 'new-suc' }] });

    const result = await runSeed();

    expect(mockHash).toHaveBeenCalledTimes(1);
    expect(result.profesionalId).toMatch(/^[0-9a-f-]{36}$/);
    expect(result.sucursalId).toBe('new-suc');
    expect(mockPoolRequest).toHaveBeenCalled();
  });

  it('usa configuraci\u00f3n desde env vars con defaults seguros', async () => {
    const origEmail = process.env.SEED_ADMIN_EMAIL;
    process.env.SEED_ADMIN_EMAIL = 'custom@test.local';
    try {
      mockRequestQuery
        .mockResolvedValueOnce({ recordset: [{ id: 'a' }] })
        .mockResolvedValueOnce({ recordset: [{ sucursal_id: 's' }] });

      await runSeed();
      expect(mockRequestInput).toHaveBeenCalledWith('email', expect.anything(), 'custom@test.local');
    } finally {
      if (origEmail === undefined) delete process.env.SEED_ADMIN_EMAIL;
      else process.env.SEED_ADMIN_EMAIL = origEmail;
    }
  });
});
