import { afterEach, describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';
import { createRagRouter } from './ragRoutes.js';
import { InMemoryKnowledgeDocStore } from './knowledgeGovernance.js';

interface ExpressLayerLike {
  handle?: ((req: Request, res: Response, next: NextFunction) => void | Promise<void>) & { name?: string };
  route?: {
    path?: string;
    methods?: Record<string, boolean>;
    stack?: ExpressLayerLike[];
  };
}

function routeHandlers(router: ReturnType<typeof createRagRouter>, path: string, method: string) {
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

const docBody = {
  title: 'Guia de hidratacion',
  category: 'hidratacion',
  tier: 'clinical_guideline',
  content: 'La hidratacion diaria recomendada es de 30 ml por kilogramo de peso.',
  allowedRoles: ['nutriologa'],
};

function makeEnv() {
  const store = new InMemoryKnowledgeDocStore();
  const router = createRagRouter({ store, now: () => new Date('2026-08-14T00:00:00.000Z') });
  return { store, router };
}

describe('rag routes', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('registers a draft document', async () => {
    const { store, router } = makeEnv();
    const controller = routeHandlers(router, '/documents', 'post')[0]!;
    const res = makeResponse();
    const next = vi.fn();

    await controller({ body: docBody, user: { sub: ADMIN, rol: 'nutriologa' }, sucursalId: SUCURSAL } as unknown as Request, res, next);

    expect(res.status).not.toHaveBeenCalled();
    const payload = vi.mocked(res.json).mock.calls[0]?.[0] as { id: string; status: string };
    expect(payload.status).toBe('draft');
    const saved = await store.get(payload.id);
    expect(saved?.title).toBe('Guia de hidratacion');
    expect(saved?.sucursalId).toBe(SUCURSAL);
  });

  it('rejects documents with invalid tiers or roles', async () => {
    const { router } = makeEnv();
    const controller = routeHandlers(router, '/documents', 'post')[0]!;
    const res = makeResponse();
    const next = vi.fn();

    await controller({ body: { ...docBody, tier: 'rumor' }, user: { sub: ADMIN, rol: 'nutriologa' }, sucursalId: SUCURSAL } as unknown as Request, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('only admin can approve documents', async () => {
    const { router } = makeEnv();
    const controller = routeHandlers(router, '/documents/:id/approve', 'post')[0]!;
    const res = makeResponse();
    const next = vi.fn();

    await controller({ params: { id: 'x' }, user: { sub: ADMIN, rol: 'nutriologa' }, sucursalId: SUCURSAL } as unknown as Request, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('approves an existing draft and returns 404 for unknown docs', async () => {
    const { store, router } = makeEnv();
    const register = routeHandlers(router, '/documents', 'post')[0]!;
    const approve = routeHandlers(router, '/documents/:id/approve', 'post')[0]!;
    const registerRes = makeResponse();

    await register({ body: docBody, user: { sub: ADMIN, rol: 'nutriologa' }, sucursalId: SUCURSAL } as unknown as Request, registerRes, vi.fn());
    const { id } = vi.mocked(registerRes.json).mock.calls[0]?.[0] as { id: string };

    const res = makeResponse();
    await approve({ params: { id }, user: { sub: ADMIN, rol: 'admin' }, sucursalId: SUCURSAL } as unknown as Request, res, vi.fn());
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 'approved' }));
    expect((await store.get(id))?.status).toBe('approved');

    const missingRes = makeResponse();
    await approve({ params: { id: '00000000-0000-4000-8000-000000000aaa' }, user: { sub: ADMIN, rol: 'admin' }, sucursalId: SUCURSAL } as unknown as Request, missingRes, vi.fn());
    expect(missingRes.status).toHaveBeenCalledWith(404);
  });

  it('rejects approving a doc that is not a draft', async () => {
    const { store, router } = makeEnv();
    const approve = routeHandlers(router, '/documents/:id/approve', 'post')[0]!;
    await store.save({
      id: '00000000-0000-4000-8000-000000000bbb',
      sucursalId: SUCURSAL,
      title: 't',
      category: 'c',
      tier: 'educational',
      content: 'contenido',
      status: 'revoked',
      allowedRoles: ['nutriologa'],
      createdAt: '2026-08-01T00:00:00.000Z',
    });
    const res = makeResponse();
    await approve({ params: { id: '00000000-0000-4000-8000-000000000bbb' }, user: { sub: ADMIN, rol: 'admin' }, sucursalId: SUCURSAL } as unknown as Request, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(409);
  });

  it('retrieves only usable docs with source metadata', async () => {
    const { store, router } = makeEnv();
    const id1 = '00000000-0000-4000-8000-000000000ccc';
    await store.save({
      id: id1,
      sucursalId: SUCURSAL,
      title: 'Guia de hidratacion',
      category: 'hidratacion',
      tier: 'clinical_guideline',
      content: '30 ml por kilogramo de agua.',
      status: 'approved',
      approvedBy: ADMIN,
      approvedAt: '2026-08-01T00:00:00.000Z',
      allowedRoles: ['nutriologa', 'admin'],
      createdAt: '2026-08-01T00:00:00.000Z',
    });
    const controller = routeHandlers(router, '/retrieve', 'post')[0]!;
    const res = makeResponse();
    const next = vi.fn();

    await controller(
      { body: { query: 'hidratacion agua', topK: 4 }, user: { sub: ADMIN, rol: 'nutriologa' }, sucursalId: SUCURSAL } as unknown as Request,
      res,
      next,
    );

    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ query: 'hidratacion agua' }));
    const payload = vi.mocked(res.json).mock.calls[0]?.[0] as { sources: Array<{ docId: string; title: string; tier: string }> };
    expect(payload.sources).toEqual([expect.objectContaining({ docId: id1, title: 'Guia de hidratacion', tier: 'clinical_guideline' })]);
  });

  it('denies retrieval to roles below nutriologa', async () => {
    const { router } = makeEnv();
    const controller = routeHandlers(router, '/retrieve', 'post')[0]!;
    const res = makeResponse();
    const next = vi.fn();

    await controller(
      { body: { query: 'hidratacion' }, user: { sub: ADMIN, rol: 'asistente' }, sucursalId: SUCURSAL } as unknown as Request,
      res,
      next,
    );

    expect(res.status).toHaveBeenCalledWith(403);
  });
});