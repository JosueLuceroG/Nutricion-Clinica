import { afterEach, describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';
import { createExpertRouter } from './expertRoutes.js';
import type { NutritionWorkflow } from './nutritionWorkflow.js';

interface ExpressLayerLike {
  handle?: ((req: Request, res: Response, next: NextFunction) => void | Promise<void>) & { name?: string };
  route?: {
    path?: string;
    methods?: Record<string, boolean>;
    stack?: ExpressLayerLike[];
  };
}

function routeHandlers(router: ReturnType<typeof createExpertRouter>, path: string, method: string) {
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
const PACIENTE = '00000000-0000-4000-8000-000000000003';

function fakeWorkflow(status: 'advice' | 'abstained' | 'referral' | 'ai_unavailable') {
  return {
    run: vi.fn().mockResolvedValue({
      status,
      envelope: {
        version: '1.0',
        generatedAt: '2026-08-14T00:00:00.000Z',
        patient: { pacienteId: PACIENTE, sucursalId: SUCURSAL },
        sources: [],
        calculators: [],
        safetyFlags: [],
        reviewRequired: true,
      },
      ...(status === 'advice' ? { advice: { content: 'consejo de prueba' } } : {}),
    }),
  } as unknown as NutritionWorkflow;
}

describe('ai expert routes', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('fails closed with 503 when the expert is not enabled', async () => {
    const router = createExpertRouter({ workflow: fakeWorkflow('advice') });
    const controller = routeHandlers(router, '/advice', 'post')[0]!;
    const res = makeResponse();
    const next = vi.fn();

    await controller(
      { body: { pacienteId: PACIENTE }, user: { sub: ADMIN, rol: 'asistente' }, sucursalId: SUCURSAL } as unknown as Request,
      res,
      next,
    );

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Expert deshabilitado' }));
  });

  it('rejects invalid bodies with 400', async () => {
    vi.stubEnv('AI_EXPERT_ENABLED', 'true');
    const router = createExpertRouter({ workflow: fakeWorkflow('advice') });
    const controller = routeHandlers(router, '/advice', 'post')[0]!;
    const res = makeResponse();
    const next = vi.fn();

    await controller({ body: { goal: 'sin paciente' } } as Request, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('denies with 403 when consent is not accepted', async () => {
    vi.stubEnv('AI_EXPERT_ENABLED', 'true');
    const router = createExpertRouter({
      workflow: fakeWorkflow('advice'),
      consentChecker: async () => false,
    });
    const controller = routeHandlers(router, '/advice', 'post')[0]!;
    const res = makeResponse();
    const next = vi.fn();

    await controller(
      {
        body: { pacienteId: PACIENTE },
        user: { sub: ADMIN, rol: 'asistente' },
        sucursalId: SUCURSAL,
      } as unknown as Request,
      res,
      next,
    );

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: "Consentimiento 'ai_opt_in' no otorgado" }));
  });

  it('returns the advice envelope when consent is granted', async () => {
    vi.stubEnv('AI_EXPERT_ENABLED', 'true');
    const workflow = fakeWorkflow('advice');
    const router = createExpertRouter({
      workflow,
      consentChecker: async () => true,
    });
    const controller = routeHandlers(router, '/advice', 'post')[0]!;
    const res = makeResponse();
    const next = vi.fn();

    await controller(
      {
        body: { pacienteId: PACIENTE, goal: 'mantener peso' },
        user: { sub: ADMIN, rol: 'asistente' },
        sucursalId: SUCURSAL,
      } as unknown as Request,
      res,
      next,
    );

    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'advice', advice: { content: 'consejo de prueba' } }),
    );
    expect(workflow.run).toHaveBeenCalledWith(
      expect.objectContaining({ pacienteId: PACIENTE, sucursalId: SUCURSAL, goal: 'mantener peso' }),
      expect.objectContaining({ profesionalId: ADMIN }),
    );
  });

  it('maps abstention and referral to 200 responses', async () => {
    vi.stubEnv('AI_EXPERT_ENABLED', 'true');
    for (const status of ['abstained', 'referral'] as const) {
      const router = createExpertRouter({
        workflow: fakeWorkflow(status),
        consentChecker: async () => true,
      });
      const controller = routeHandlers(router, '/advice', 'post')[0]!;
      const res = makeResponse();
      const next = vi.fn();

      await controller(
        {
          body: { pacienteId: PACIENTE },
          user: { sub: ADMIN, rol: 'asistente' },
          sucursalId: SUCURSAL,
        } as unknown as Request,
        res,
        next,
      );

      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status, advice: null }));
    }
  });

  it('returns 503 when the AI is unavailable', async () => {
    vi.stubEnv('AI_EXPERT_ENABLED', 'true');
    const router = createExpertRouter({
      workflow: fakeWorkflow('ai_unavailable'),
      consentChecker: async () => true,
    });
    const controller = routeHandlers(router, '/advice', 'post')[0]!;
    const res = makeResponse();
    const next = vi.fn();

    await controller(
      {
        body: { pacienteId: PACIENTE },
        user: { sub: ADMIN, rol: 'asistente' },
        sucursalId: SUCURSAL,
      } as unknown as Request,
      res,
      next,
    );

    expect(res.status).toHaveBeenCalledWith(503);
  });
});