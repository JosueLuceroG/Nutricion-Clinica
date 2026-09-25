import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';
import { signPending2faToken, signToken } from '../application/authService.js';
import { requireAuth } from './requireAuth.js';

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

vi.mock('../../../db/connection.js', () => ({
  getPool: mockGetPool,
}));

const userId = '00000000-0000-4000-8000-000000000001';
const sucursalId = '00000000-0000-4000-8000-000000000002';

function requestWithToken(token: string): Request {
  return {
    header: vi.fn((name: string) => (name.toLowerCase() === 'authorization' ? `Bearer ${token}` : undefined)),
  } as unknown as Request;
}

describe('requireAuth token purpose', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'require-auth-test-secret-with-sufficient-length';
    process.env.JWT_ISSUER = 'nutriclinica-api';
    process.env.JWT_AUDIENCE = 'nutriclinica-web';
    vi.clearAllMocks();
    mockRequestInput.mockReturnThis();
    mockPoolRequest.mockImplementation(() => ({
      input: mockRequestInput,
      query: mockRequestQuery,
    }));
    mockRequestQuery.mockResolvedValue({
      recordset: [{ token_version: 1, activo: true }],
    });
  });

  it('accepts access tokens with the strict contract', async () => {
    const token = await signToken({
      sub: userId,
      email: 'professional@example.com',
      rol: 'nutriologa',
      sucursalIds: [sucursalId],
      totpVerified: true,
      ver: 1,
    });
    const req = requestWithToken(token);
    const next = vi.fn() as NextFunction;

    await requireAuth(req, {} as Response, next);

    expect(next).toHaveBeenCalledWith();
    expect(req.user).toMatchObject({ tokenType: 'access', sub: userId });
  });

  it('rejects tokens whose version was revoked', async () => {
    const token = await signToken({
      sub: userId,
      email: 'professional@example.com',
      rol: 'nutriologa',
      sucursalIds: [sucursalId],
      totpVerified: true,
      ver: 1,
    });
    mockRequestQuery.mockResolvedValueOnce({
      recordset: [{ token_version: 2, activo: true }],
    });
    const req = requestWithToken(token);
    const next = vi.fn() as NextFunction;

    await requireAuth(req, {} as Response, next);

    expect(req.user).toBeUndefined();
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 401 }));
  });

  it('rejects pending 2FA tokens on protected routes', async () => {
    const token = await signPending2faToken({
      sub: userId,
      email: 'professional@example.com',
    });
    const req = requestWithToken(token);
    const next = vi.fn() as NextFunction;

    await requireAuth(req, {} as Response, next);

    expect(req.user).toBeUndefined();
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 401 }));
  });
});
