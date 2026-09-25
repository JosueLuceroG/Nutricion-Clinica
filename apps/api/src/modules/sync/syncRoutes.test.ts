import { describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import router, { requireSyncOperationContract } from './syncRoutes.js';

interface ExpressRouteLayerLike {
  route?: {
    path?: string;
    stack?: Array<{ handle?: { name?: string } }>;
  };
}

describe('syncRoutes', () => {
  it('/push exige requireSucursalAccess antes de procesar el batch', () => {
    const stack = (router as unknown as { stack: ExpressRouteLayerLike[] }).stack;
    const pushRoute = stack.find((layer) => layer.route?.path === '/push')?.route;
    const middlewareNames = pushRoute?.stack?.map((layer) => layer.handle?.name) ?? [];

    expect(pushRoute).toBeDefined();
    expect(middlewareNames).toContain('requireAuth');
    expect(middlewareNames).toContain('requireSyncOperationContract');
    expect(middlewareNames).toContain('requireSucursalAccess');
    expect(middlewareNames).toContain('auditMiddleware');
    expect(middlewareNames.indexOf('requireAuth')).toBeLessThan(middlewareNames.indexOf('requireSyncOperationContract'));
    expect(middlewareNames.indexOf('requireSyncOperationContract')).toBeLessThan(middlewareNames.indexOf('requireSucursalAccess'));
    expect(middlewareNames.indexOf('requireSucursalAccess')).toBeLessThan(middlewareNames.indexOf('auditMiddleware'));
  });

  it('rechaza clientes legacy antes de pull/push', () => {
    const status = { json: vi.fn() };
    const res = {
      status: vi.fn(() => status),
    } as unknown as Response;
    const next = vi.fn();
    const req = { get: vi.fn(() => undefined) } as unknown as Request;

    requireSyncOperationContract(req, res, next);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(status.json).toHaveBeenCalledWith({
      error: 'SYNC_OPERATION_CONTRACT_MISMATCH',
      required: 'durable-outbox-v1',
    });
    expect(next).not.toHaveBeenCalled();
  });
});
