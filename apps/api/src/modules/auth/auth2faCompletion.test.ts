import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';

const mocks = vi.hoisted(() => ({
  login: vi.fn(),
  register: vi.fn(),
  findProfesionalById: vi.fn(),
  listSucursalesForProfesional: vi.fn(),
  signToken: vi.fn(),
  signPending2faToken: vi.fn(),
  verifyPending2faToken: vi.fn(),
  isTotpEnabled: vi.fn(),
  verifyTotp: vi.fn(),
  findTotpSecret: vi.fn(),
}));

vi.mock('./application/authService.js', () => ({
  login: mocks.login,
  register: mocks.register,
  findProfesionalById: mocks.findProfesionalById,
  listSucursalesForProfesional: mocks.listSucursalesForProfesional,
  signToken: mocks.signToken,
  signPending2faToken: mocks.signPending2faToken,
  verifyPending2faToken: mocks.verifyPending2faToken,
}));

vi.mock('./application/twoFactorService.js', () => ({
  isTotpEnabled: mocks.isTotpEnabled,
  verifyTotp: mocks.verifyTotp,
  findTotpSecret: mocks.findTotpSecret,
}));

vi.mock('./middleware/requireAuth.js', () => ({
  requireAuth: vi.fn(),
  requireRole: vi.fn(() => vi.fn()),
}));

vi.mock('../../middleware/rateLimit.js', () => ({
  rateLimit: vi.fn(() => (_req: Request, _res: Response, next: NextFunction) => next()),
}));

vi.mock('../../db/connection.js', () => ({
  getPool: vi.fn(async () => ({
    request: () => ({ input: vi.fn().mockReturnThis(), query: vi.fn() }),
  })),
}));

import router from './authRoutes.js';

interface ExpressLayerLike {
  handle?: (req: Request, res: Response, next: NextFunction) => void | Promise<void>;
  route?: {
    path?: string;
    methods?: Record<string, boolean>;
    stack?: ExpressLayerLike[];
  };
}

function loginController() {
  const stack = (router as unknown as { stack: ExpressLayerLike[] }).stack;
  const handlers = stack
    .find((layer) => layer.route?.path === '/login' && layer.route.methods?.post)
    ?.route?.stack?.map((layer) => layer.handle)
    .filter((handler): handler is NonNullable<ExpressLayerLike['handle']> => Boolean(handler));
  if (!handlers?.length) throw new Error('Missing POST /login');
  return handlers.at(-1)!;
}

function response(): Response {
  const res = { status: vi.fn(), json: vi.fn() };
  res.status.mockReturnValue(res);
  return res as unknown as Response;
}

function request(): Request {
  return {
    body: {
      email: 'professional@example.com',
      password: 'valid-password',
      pending2faToken: 'token',
      totpCode: '123456',
    },
    ip: '127.0.0.1',
    socket: {},
    header: vi.fn(),
  } as unknown as Request;
}

describe('POST /auth/login 2FA completion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects an access token at the pending-token boundary', async () => {
    mocks.verifyPending2faToken.mockRejectedValueOnce(new Error('wrong token type'));
    const res = response();

    await loginController()(request(), res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(401);
    expect(mocks.findProfesionalById).not.toHaveBeenCalled();
    expect(mocks.signToken).not.toHaveBeenCalled();
  });

  it('does not issue an access token to an inactive professional', async () => {
    mocks.verifyPending2faToken.mockResolvedValueOnce({
      tokenType: 'pending_2fa',
      sub: '00000000-0000-4000-8000-000000000001',
      email: 'professional@example.com',
    });
    mocks.findProfesionalById.mockResolvedValueOnce({
      id: '00000000-0000-4000-8000-000000000001',
      email: 'professional@example.com',
      activo: false,
    });
    const res = response();

    await loginController()(request(), res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(401);
    expect(mocks.findTotpSecret).not.toHaveBeenCalled();
    expect(mocks.signToken).not.toHaveBeenCalled();
  });
});
