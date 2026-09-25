import { describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';
import { createCopilotRouter } from './copilotRoutes.js';

interface ExpressLayerLike {
  handle?: ((req: Request, res: Response, next: NextFunction) => void | Promise<void>) & { name?: string };
  route?: {
    path?: string;
    methods?: Record<string, boolean>;
    stack?: ExpressLayerLike[];
  };
}

function routeHandlers(router: ReturnType<typeof createCopilotRouter>, path: string, method: string) {
  return ((router as unknown as { stack: ExpressLayerLike[] }).stack)
    .find((layer) => layer.route?.path === path && layer.route.methods?.[method])
    ?.route?.stack?.map((layer) => layer.handle)
    .filter((handler): handler is NonNullable<ExpressLayerLike['handle']> => Boolean(handler)) ?? [];
}

function makeResponse(): Response {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
  } as unknown as Response;
}

function baseReq(overrides: Record<string, unknown> = {}) {
  return {
    params: {},
    user: { sub: 'prof-1', rol: 'nutriologa' },
    sucursalId: 'suc-1',
    ...overrides,
  } as unknown as Request;
}

describe('copilot routes', () => {
  it('lists copilots with per-actor availability', async () => {
    const router = createCopilotRouter();
    const controller = routeHandlers(router, '/', 'get')[0]!;
    const res = makeResponse();

    await controller(baseReq(), res, vi.fn());

    const payload = vi.mocked(res.json).mock.calls[0]?.[0] as { copilots: Array<{ id: string; availability: { available: boolean } }> };
    expect(payload.copilots).toHaveLength(4);
    expect(payload.copilots.find((c) => c.id === 'nutrition')?.availability.available).toBe(true);
    expect(payload.copilots.find((c) => c.id === 'clinical')?.availability.available).toBe(false);
  });

  it('shows a role without permission as unavailable', async () => {
    const router = createCopilotRouter();
    const controller = routeHandlers(router, '/', 'get')[0]!;
    const res = makeResponse();

    await controller(baseReq({ user: { sub: 'prof-2', rol: 'asistente' } }), res, vi.fn());

    const payload = vi.mocked(res.json).mock.calls[0]?.[0] as { copilots: Array<{ id: string; availability: { available: boolean } }> };
    expect(payload.copilots.find((c) => c.id === 'nutrition')?.availability.available).toBe(false);
  });

  it('serves copilot details and rejects unknown ids with 404', async () => {
    const router = createCopilotRouter();
    const controller = routeHandlers(router, '/:copilotId', 'get')[0]!;

    const ok = makeResponse();
    await controller(baseReq({ params: { copilotId: 'nutrition' } }), ok, vi.fn());
    const payload = vi.mocked(ok.json).mock.calls[0]?.[0] as { copilot: { id: string; availability: { available: boolean } } };
    expect(payload.copilot.id).toBe('nutrition');
    expect(payload.copilot.availability.available).toBe(true);

    const missing = makeResponse();
    await controller(baseReq({ params: { copilotId: 'no_existe' } }), missing, vi.fn());
    expect(missing.status).toHaveBeenCalledWith(404);
  });
});