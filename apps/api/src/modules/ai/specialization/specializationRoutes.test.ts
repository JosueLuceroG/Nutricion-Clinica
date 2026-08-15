import { describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';
import { InMemorySpecializationLedger } from './specializationLedger.js';
import { createSpecializationRouter } from './specializationRoutes.js';
import { SpecializationService } from './specializationService.js';
import type { SpecializationCandidate } from './specializationTypes.js';

interface ExpressLayerLike {
  handle?: ((req: Request, res: Response, next: NextFunction) => void | Promise<void>) & { name?: string };
  route?: { path?: string; methods?: Record<string, boolean>; stack?: ExpressLayerLike[] };
}

function routeHandlers(router: ReturnType<typeof createSpecializationRouter>, path: string, method: string) {
  return ((router as unknown as { stack: ExpressLayerLike[] }).stack)
    .find((layer) => layer.route?.path === path && layer.route.methods?.[method])
    ?.route?.stack?.map((layer) => layer.handle)
    .filter((handler): handler is NonNullable<ExpressLayerLike['handle']> => Boolean(handler)) ?? [];
}

function makeResponse(): Response {
  return { status: vi.fn().mockReturnThis(), json: vi.fn() } as unknown as Response;
}

function baseReq(overrides: Record<string, unknown> = {}) {
  return {
    params: {},
    body: {},
    user: { sub: 'prof-1', rol: 'nutriologa' },
    sucursalId: 'suc-1',
    header: vi.fn(),
    get: vi.fn(),
    socket: { remoteAddress: '127.0.0.1' },
    ...overrides,
  } as unknown as Request;
}

function candidate(): SpecializationCandidate {
  return {
    id: 'test_specialization',
    name: 'Test',
    description: 'd',
    kind: 'fine_tuning',
    dataSource: 'synthetic',
    governance: {
      requiresPHI: false,
      legalReview: false,
      privacyReview: false,
      deidentification: false,
      retentionDays: null,
      professionalApproval: true,
    },
    evidenceCriteria: [{ kind: 'model_pass_rate', comparison: 'lt', value: 0.9, capability: 'nutrition_reasoning' }],
  };
}

function buildRouter(enabled = true) {
  const service = new SpecializationService({
    ledger: new InMemorySpecializationLedger(),
    candidates: [candidate()],
    config: () => ({ enabled, store: 'memory', passRates: { nutrition_reasoning: 0.5 } }),
  });
  return createSpecializationRouter({ service });
}

describe('specialization routes', () => {
  it('lists candidates with their latest decision', async () => {
    const router = buildRouter();
    const controller = routeHandlers(router, '/', 'get')[0]!;
    const res = makeResponse();

    await controller(baseReq(), res, vi.fn());

    const payload = vi.mocked(res.json).mock.calls[0]?.[0] as { candidates: Array<{ id: string; latestDecision: unknown }> };
    expect(payload.candidates).toHaveLength(1);
    expect(payload.candidates[0]?.id).toBe('test_specialization');
    expect(payload.candidates[0]?.latestDecision).toBeNull();
  });

  it('list fails closed when specialization is disabled', async () => {
    const router = buildRouter(false);
    const controller = routeHandlers(router, '/', 'get')[0]!;
    const res = makeResponse();

    await controller(baseReq(), res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(503);
  });

  it('evaluate rejects roles below admin', async () => {
    const router = buildRouter();
    const controller = routeHandlers(router, '/:candidateId/evaluate', 'post')[0]!;
    const res = makeResponse();

    await controller(baseReq({ params: { candidateId: 'test_specialization' } }), res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('evaluate returns the verdict for admins', async () => {
    const router = buildRouter();
    const controller = routeHandlers(router, '/:candidateId/evaluate', 'post')[0]!;
    const res = makeResponse();

    await controller(baseReq({ params: { candidateId: 'test_specialization' }, user: { sub: 'admin-1', rol: 'admin' } }), res, vi.fn());

    const payload = vi.mocked(res.json).mock.calls[0]?.[0] as { verdict: { status: string }; evidence: unknown };
    expect(payload.verdict.status).toBe('approved');
    expect(payload.evidence).toBeDefined();
  });

  it('evaluate rejects unknown candidates with 404', async () => {
    const router = buildRouter();
    const controller = routeHandlers(router, '/:candidateId/evaluate', 'post')[0]!;
    const res = makeResponse();

    await controller(baseReq({ params: { candidateId: 'unknown' }, user: { sub: 'admin-1', rol: 'admin' } }), res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('evaluate fails closed when specialization is disabled', async () => {
    const router = buildRouter(false);
    const controller = routeHandlers(router, '/:candidateId/evaluate', 'post')[0]!;
    const res = makeResponse();

    await controller(baseReq({ params: { candidateId: 'test_specialization' }, user: { sub: 'admin-1', rol: 'admin' } }), res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(503);
  });
});