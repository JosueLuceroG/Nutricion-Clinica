import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import type { NextFunction, Request, Response } from 'express';
import router from './toolRoutes.js';
import { aiToolRegistry } from './toolRegistry.js';

interface ExpressLayerLike {
  handle?: ((req: Request, res: Response, next: NextFunction) => void | Promise<void>) & { name?: string };
  route?: {
    path?: string;
    methods?: Record<string, boolean>;
    stack?: ExpressLayerLike[];
  };
}

function routeHandlers(path: string, method: string) {
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

const ADMIN = '00000000-0000-4000-8000-000000000001';
const SUCURSAL = '00000000-0000-4000-8000-000000000002';

beforeAll(() => {
  aiToolRegistry.register({
    id: 'route_fake_tool',
    name: 'route fake',
    description: 'fake sin DB ni consentimiento',
    readOnly: true,
    riskLevel: 'low',
    dataCategories: ['operational'],
    maxAgeMs: 60_000,
    minRole: 'asistente',
    schema: z.object({ q: z.string().min(1) }).strict(),
    execute: async () => ({ echo: 'ok' }),
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('ai tool routes', () => {
  it('fails closed with 503 when tools are disabled', async () => {
    const controller = routeHandlers('/invoke', 'post')[0]!;
    const res = makeResponse();
    const next = vi.fn();

    await controller(
      { body: { toolId: 'route_fake_tool', args: { q: 'x' } }, user: { sub: ADMIN, rol: 'asistente' }, sucursalId: SUCURSAL } as unknown as Request,
      res,
      next,
    );

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Herramientas IA deshabilitadas' }));
  });

  it('rejects invalid bodies with 400', async () => {
    vi.stubEnv('AI_TOOLS_ENABLED', 'true');
    const controller = routeHandlers('/invoke', 'post')[0]!;
    const res = makeResponse();
    const next = vi.fn();

    await controller({ body: { args: { q: 'x' } } } as Request, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 403 when the tool is not allowlisted', async () => {
    vi.stubEnv('AI_TOOLS_ENABLED', 'true');
    vi.stubEnv('AI_TOOLS_ALLOWLIST', 'patient_profile');
    const controller = routeHandlers('/invoke', 'post')[0]!;
    const res = makeResponse();
    const next = vi.fn();

    await controller(
      { body: { toolId: 'route_fake_tool', args: { q: 'x' } }, user: { sub: ADMIN, rol: 'asistente' }, sucursalId: SUCURSAL } as unknown as Request,
      res,
      next,
    );

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Herramienta no permitida' }));
  });

  it('invokes an allowlisted read-only tool and returns the envelope', async () => {
    vi.stubEnv('AI_TOOLS_ENABLED', 'true');
    vi.stubEnv('AI_TOOLS_ALLOWLIST', 'route_fake_tool');
    const controller = routeHandlers('/invoke', 'post')[0]!;
    const res = makeResponse();
    const next = vi.fn();

    await controller(
      {
        body: { toolId: 'route_fake_tool', args: { q: 'hola' } },
        user: { sub: ADMIN, rol: 'asistente' },
        sucursalId: SUCURSAL,
      } as unknown as Request,
      res,
      next,
    );

    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ toolId: 'route_fake_tool', ok: true, data: { echo: 'ok' } }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('denies with 403 when the role is below the minimum', async () => {
    vi.stubEnv('AI_TOOLS_ENABLED', 'true');
    vi.stubEnv('AI_TOOLS_ALLOWLIST', 'route_fake_tool');
    aiToolRegistry.get('route_fake_tool')!.minRole = 'admin';
    const controller = routeHandlers('/invoke', 'post')[0]!;
    const res = makeResponse();
    const next = vi.fn();

    await controller(
      {
        body: { toolId: 'route_fake_tool', args: { q: 'hola' } },
        user: { sub: ADMIN, rol: 'asistente' },
        sucursalId: SUCURSAL,
      } as unknown as Request,
      res,
      next,
    );

    expect(res.status).toHaveBeenCalledWith(403);
  });
});