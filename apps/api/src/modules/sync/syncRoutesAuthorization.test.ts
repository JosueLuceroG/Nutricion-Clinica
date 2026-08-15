import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';

const mocks = vi.hoisted(() => ({
  pushBatch: vi.fn(),
}));

vi.mock('./application/syncService.js', () => ({
  getManifest: vi.fn(),
  pullChanges: vi.fn(),
  pushBatch: mocks.pushBatch,
}));

vi.mock('../auth/middleware/requireAuth.js', () => ({
  requireAuth: vi.fn((_req: Request, _res: Response, next: NextFunction) => next()),
}));

vi.mock('../tenancy/middleware/requireSucursalAccess.js', () => ({
  requireSucursalAccess: vi.fn((_req: Request, _res: Response, next: NextFunction) => next()),
}));

vi.mock('../../middleware/auditMiddleware.js', () => ({
  auditLog: vi.fn(() => (_req: Request, _res: Response, next: NextFunction) => next()),
}));

import router from './syncRoutes.js';

interface ExpressLayerLike {
  handle?: (req: Request, res: Response, next: NextFunction) => void | Promise<void>;
  route?: {
    path?: string;
    methods?: Record<string, boolean>;
    stack?: ExpressLayerLike[];
  };
}

function pushController() {
  const stack = (router as unknown as { stack: ExpressLayerLike[] }).stack;
  const handlers = stack
    .find((layer) => layer.route?.path === '/push' && layer.route.methods?.post)
    ?.route?.stack?.map((layer) => layer.handle)
    .filter((handler): handler is NonNullable<ExpressLayerLike['handle']> => Boolean(handler));
  if (!handlers?.length) throw new Error('Missing POST /sync/push');
  return handlers.at(-1)!;
}

function response(): Response {
  const res = { status: vi.fn(), json: vi.fn() };
  res.status.mockReturnValue(res);
  return res as unknown as Response;
}

function request(body: unknown): Request {
  return {
    body,
    sucursalId: '00000000-0000-4000-8000-000000000001',
    user: {
      tokenType: 'access',
      sub: '00000000-0000-4000-8000-000000000002',
      email: 'billing@example.com',
      rol: 'facturacion',
      sucursalIds: ['00000000-0000-4000-8000-000000000001'],
      totpVerified: true,
      iat: 1,
      exp: 2,
      iss: 'nutriclinica-api',
      aud: 'nutriclinica-web',
    },
  } as unknown as Request;
}

describe('POST /sync/push actor context', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.pushBatch.mockResolvedValue({ results: [], serverTime: '2026-08-13T12:00:00.000Z' });
  });

  it('passes authenticated id and role to per-operation authorization', async () => {
    const body = {
      sucursalId: '00000000-0000-4000-8000-000000000001',
      operations: [
        {
          entity: 'consultas',
          id: '00000000-0000-4000-8000-000000000003',
          op: 'update',
          payload: { payment_status: 'paid' },
          clientUpdatedAt: '2026-08-13T12:00:00.000Z',
        },
      ],
    };
    const res = response();

    await pushController()(request(body), res, vi.fn());

    expect(mocks.pushBatch).toHaveBeenCalledWith(body, {
      id: '00000000-0000-4000-8000-000000000002',
      role: 'facturacion',
    });
  });

  it('rejects malformed operations before calling the service', async () => {
    const res = response();

    await pushController()(
      request({
        sucursalId: '00000000-0000-4000-8000-000000000001',
        operations: [{ entity: 'consultas', op: 'update' }],
      }),
      res,
      vi.fn(),
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(mocks.pushBatch).not.toHaveBeenCalled();
  });
});
