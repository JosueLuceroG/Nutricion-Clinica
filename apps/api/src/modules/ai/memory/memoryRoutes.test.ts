import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';
import { createMemoryRouter } from './memoryRoutes.js';
import { InMemoryMemoryStore } from './memoryStore.js';

interface ExpressLayerLike {
  handle?: ((req: Request, res: Response, next: NextFunction) => void | Promise<void>) & { name?: string };
  route?: {
    path?: string;
    methods?: Record<string, boolean>;
    stack?: ExpressLayerLike[];
  };
}

function routeHandlers(router: ReturnType<typeof createMemoryRouter>, path: string, method: string) {
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

const PROF = '00000000-0000-4000-8000-000000000011';
const ADMIN = '00000000-0000-4000-8000-000000000001';
const SUCURSAL = '00000000-0000-4000-8000-000000000002';
const PACIENTE = '00000000-0000-4000-8000-000000000003';

function makeEnv() {
  const store = new InMemoryMemoryStore();
  const router = createMemoryRouter({
    store,
    consentChecker: async () => true,
    now: () => new Date('2026-08-14T00:00:00.000Z'),
  });
  return { store, router };
}

function baseReq(overrides: Record<string, unknown> = {}) {
  return {
    body: {},
    params: {},
    user: { sub: PROF, rol: 'nutriologa' },
    sucursalId: SUCURSAL,
    ip: '127.0.0.1',
    socket: { remoteAddress: '127.0.0.1' },
    header: () => 'test',
    ...overrides,
  } as unknown as Request;
}

describe('memory routes', () => {
  beforeEach(() => {
    vi.stubEnv('AI_MEMORY_ENABLED', 'true');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('saves a memory entry with expiry and provenance', async () => {
    const { store, router } = makeEnv();
    const controller = routeHandlers(router, '/', 'post')[0]!;
    const res = makeResponse();
    const next = vi.fn();

    await controller(
      baseReq({ body: { pacienteId: PACIENTE, content: 'Prefiere consultas en la tarde', source: 'professional_note' } }),
      res,
      next,
    );

    expect(res.status).not.toHaveBeenCalled();
    const payload = vi.mocked(res.json).mock.calls[0]?.[0] as { entry: { id: string; content: string; actorId: string; sucursalId: string } };
    expect(payload.entry.content).toBe('Prefiere consultas en la tarde');
    expect(payload.entry.actorId).toBe(PROF);
    expect(payload.entry.sucursalId).toBe(SUCURSAL);
    expect(await store.get(payload.entry.id)).toBeDefined();
  });

  it('rejects invalid entries with 400', async () => {
    const { router } = makeEnv();
    const controller = routeHandlers(router, '/', 'post')[0]!;
    const res = makeResponse();

    await controller(baseReq({ body: { pacienteId: 'no-uuid', content: '' } }), res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('denies roles below nutriologa', async () => {
    const { router } = makeEnv();
    const controller = routeHandlers(router, '/', 'post')[0]!;
    const res = makeResponse();

    await controller(
      baseReq({ user: { sub: PROF, rol: 'asistente' }, body: { pacienteId: PACIENTE, content: 'x' } }),
      res,
      vi.fn(),
    );
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('fail-closes without ai_memory consent', async () => {
    const router = createMemoryRouter({
      store: new InMemoryMemoryStore(),
      consentChecker: async () => false,
      now: () => new Date('2026-08-14T00:00:00.000Z'),
    });
    const controller = routeHandlers(router, '/', 'post')[0]!;
    const res = makeResponse();

    await controller(baseReq({ body: { pacienteId: PACIENTE, content: 'x' } }), res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(403);
    expect(vi.mocked(res.json).mock.calls[0]?.[0]).toEqual({ error: "Consentimiento 'ai_memory' no otorgado" });
  });

  it('fail-closes when the feature is disabled', async () => {
    vi.stubEnv('AI_MEMORY_ENABLED', 'false');
    const { router } = makeEnv();
    const controller = routeHandlers(router, '/', 'post')[0]!;
    const res = makeResponse();

    await controller(baseReq({ body: { pacienteId: PACIENTE, content: 'x' } }), res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(503);
  });

  it('lists memory for a patient honoring isolation', async () => {
    const { store, router } = makeEnv();
    await store.save({
      id: '00000000-0000-4000-8000-000000000021',
      pacienteId: PACIENTE,
      sucursalId: SUCURSAL,
      actorId: PROF,
      content: 'nota compartida',
      visibility: 'shared',
      source: 'professional_note',
      createdAt: '2026-08-01T00:00:00.000Z',
      expiresAt: '2026-12-31T00:00:00.000Z',
    });
    const controller = routeHandlers(router, '/:pacienteId', 'get')[0]!;
    const res = makeResponse();

    await controller(baseReq({ params: { pacienteId: PACIENTE } }), res, vi.fn());
    const payload = vi.mocked(res.json).mock.calls[0]?.[0] as { entries: Array<{ content: string }> };
    expect(payload.entries).toEqual([expect.objectContaining({ content: 'nota compartida' })]);
  });

  it('deletes only own entries unless admin', async () => {
    const { store, router } = makeEnv();
    const id = '00000000-0000-4000-8000-000000000031';
    await store.save({
      id,
      pacienteId: PACIENTE,
      sucursalId: SUCURSAL,
      actorId: '00000000-0000-4000-8000-000000000099',
      content: 'de otro autor',
      visibility: 'shared',
      source: 'professional_note',
      createdAt: '2026-08-01T00:00:00.000Z',
      expiresAt: '2026-12-31T00:00:00.000Z',
    });
    const controller = routeHandlers(router, '/:id', 'delete')[0]!;

    const forbidden = makeResponse();
    await controller(baseReq({ params: { id } }), forbidden, vi.fn());
    expect(forbidden.status).toHaveBeenCalledWith(403);

    const asAdmin = makeResponse();
    await controller(baseReq({ params: { id }, user: { sub: ADMIN, rol: 'admin' } }), asAdmin, vi.fn());
    expect(asAdmin.json).toHaveBeenCalledWith({ deleted: true });
    expect(await store.get(id)).toBeUndefined();

    const missing = makeResponse();
    await controller(baseReq({ params: { id: '00000000-0000-4000-8000-000000000aaa' }, user: { sub: ADMIN, rol: 'admin' } }), missing, vi.fn());
    expect(missing.status).toHaveBeenCalledWith(404);
  });
});