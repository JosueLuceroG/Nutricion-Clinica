import { afterEach, describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';
import { createExpertRouter } from './expertRoutes.js';
import { ClinicalAutoDisable } from '../clinicalGate/autoDisable.js';
import { InMemoryClinicalReviewStore } from '../clinicalGate/reviewStore.js';
import { ShadowMode } from '../clinicalGate/shadowMode.js';
import type { NutritionAdviceResult, NutritionWorkflow } from './nutritionWorkflow.js';

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
const RUN_ID = '00000000-0000-4000-8000-000000000004';

const result: NutritionAdviceResult = {
  status: 'advice',
  envelope: {
    version: '1.0',
    generatedAt: '2026-08-14T00:00:00.000Z',
    patient: { pacienteId: PACIENTE, sucursalId: SUCURSAL },
    sources: [],
    calculators: [],
    safetyFlags: [],
    reviewRequired: true,
  },
  advice: { content: 'consejo de prueba' },
};

function makeEnv() {
  const store = new InMemoryClinicalReviewStore();
  const autoDisable = new ClinicalAutoDisable(store);
  const shadow = new ShadowMode({
    workflow: { run: async () => result } as unknown as NutritionWorkflow,
    id: () => RUN_ID,
    now: () => new Date('2026-08-14T00:00:00.000Z'),
  });
  return { store, autoDisable, shadow };
}

describe('clinical gate routes', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('runs a shadow run and stores it', async () => {
    vi.stubEnv('AI_EXPERT_ENABLED', 'true');
    const env = makeEnv();
    const router = createExpertRouter({
      consentChecker: async () => true,
      store: env.store,
      autoDisable: env.autoDisable,
      shadowModeRunner: env.shadow,
    });
    const controller = routeHandlers(router, '/shadow', 'post')[0]!;
    const res = makeResponse();
    const next = vi.fn();

    await controller(
      {
        body: { pacienteId: PACIENTE, goal: 'mantener' },
        user: { sub: ADMIN, rol: 'nutriologa' },
        sucursalId: SUCURSAL,
      } as unknown as Request,
      res,
      next,
    );

    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 'shadow', runId: RUN_ID }));
    expect(await env.store.getShadowRun(RUN_ID)).toBeDefined();
  });

  it('denies shadow runs to roles below nutriologa', async () => {
    vi.stubEnv('AI_EXPERT_ENABLED', 'true');
    const env = makeEnv();
    const router = createExpertRouter({
      consentChecker: async () => true,
      store: env.store,
      autoDisable: env.autoDisable,
      shadowModeRunner: env.shadow,
    });
    const controller = routeHandlers(router, '/shadow', 'post')[0]!;
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
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Rol sin permiso para shadow mode' }));
  });

  it('rejects invalid review bodies with 400', async () => {
    vi.stubEnv('AI_EXPERT_ENABLED', 'true');
    const env = makeEnv();
    const router = createExpertRouter({ store: env.store, autoDisable: env.autoDisable });
    const controller = routeHandlers(router, '/review', 'post')[0]!;
    const res = makeResponse();
    const next = vi.fn();

    await controller(
      {
        body: { verdict: 'no_valido' },
        user: { sub: ADMIN, rol: 'nutriologa' },
        sucursalId: SUCURSAL,
      } as unknown as Request,
      res,
      next,
    );

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 404 for a review of an unknown shadow run', async () => {
    vi.stubEnv('AI_EXPERT_ENABLED', 'true');
    const env = makeEnv();
    const router = createExpertRouter({ store: env.store, autoDisable: env.autoDisable });
    const controller = routeHandlers(router, '/review', 'post')[0]!;
    const res = makeResponse();
    const next = vi.fn();

    await controller(
      {
        body: { shadowRunId: RUN_ID, verdict: 'aligned' },
        user: { sub: ADMIN, rol: 'nutriologa' },
        sucursalId: SUCURSAL,
      } as unknown as Request,
      res,
      next,
    );

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('records a critical disagreement and reports auto-disable state', async () => {
    vi.stubEnv('AI_EXPERT_ENABLED', 'true');
    vi.stubEnv('AI_CLINICAL_DISAGREEMENT_THRESHOLD', '1');
    const env = makeEnv();
    await env.store.saveShadowRun({
      id: RUN_ID,
      requestId: 'req',
      pacienteId: PACIENTE,
      sucursalId: SUCURSAL,
      actor: ADMIN,
      runAt: '2026-08-14T00:00:00.000Z',
      served: true,
      result,
    });
    const router = createExpertRouter({ store: env.store, autoDisable: env.autoDisable });
    const controller = routeHandlers(router, '/review', 'post')[0]!;
    const res = makeResponse();
    const next = vi.fn();

    await controller(
      {
        body: { shadowRunId: RUN_ID, verdict: 'critical_disagreement', notes: 'mal' },
        user: { sub: ADMIN, rol: 'nutriologa' },
        sucursalId: SUCURSAL,
      } as unknown as Request,
      res,
      next,
    );

    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ critical: true, autoDisabled: true }));
    expect(await env.store.countCriticalDisagreements({ sucursalId: SUCURSAL, since: new Date(0) })).toBe(1);
  });

  it('records an aligned verdict without auto-disabling', async () => {
    vi.stubEnv('AI_EXPERT_ENABLED', 'true');
    vi.stubEnv('AI_CLINICAL_DISAGREEMENT_THRESHOLD', '1');
    const env = makeEnv();
    await env.store.saveShadowRun({
      id: RUN_ID,
      requestId: 'req',
      pacienteId: PACIENTE,
      sucursalId: SUCURSAL,
      actor: ADMIN,
      runAt: '2026-08-14T00:00:00.000Z',
      served: true,
      result,
    });
    const router = createExpertRouter({ store: env.store, autoDisable: env.autoDisable });
    const controller = routeHandlers(router, '/review', 'post')[0]!;
    const res = makeResponse();
    const next = vi.fn();

    await controller(
      {
        body: { shadowRunId: RUN_ID, verdict: 'aligned' },
        user: { sub: ADMIN, rol: 'nutriologa' },
        sucursalId: SUCURSAL,
      } as unknown as Request,
      res,
      next,
    );

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ critical: false, autoDisabled: false }));
  });

  it('returns 503 when auto-disabled by critical disagreements', async () => {
    vi.stubEnv('AI_EXPERT_ENABLED', 'true');
    vi.stubEnv('AI_CLINICAL_DISAGREEMENT_THRESHOLD', '1');
    const env = makeEnv();
    await env.store.saveShadowRun({
      id: RUN_ID,
      requestId: 'req',
      pacienteId: PACIENTE,
      sucursalId: SUCURSAL,
      actor: ADMIN,
      runAt: '2026-08-14T00:00:00.000Z',
      served: true,
      result,
    });
    await env.store.saveComparison({
      id: 'c1',
      shadowRunId: RUN_ID,
      professionalId: ADMIN,
      sucursalId: SUCURSAL,
      reviewedAt: '2026-08-14T00:00:00.000Z',
      verdict: 'critical_disagreement',
    });
    const router = createExpertRouter({
      consentChecker: async () => true,
      store: env.store,
      autoDisable: env.autoDisable,
    });
    const controller = routeHandlers(router, '/advice', 'post')[0]!;
    const res = makeResponse();
    const next = vi.fn();

    await controller(
      {
        body: { pacienteId: PACIENTE },
        user: { sub: ADMIN, rol: 'nutriologa' },
        sucursalId: SUCURSAL,
      } as unknown as Request,
      res,
      next,
    );

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Expert deshabilitado por revision clinica' }));
  });

  it('stores a served shadow run when shadow mode is enabled', async () => {
    vi.stubEnv('AI_EXPERT_ENABLED', 'true');
    vi.stubEnv('AI_SHADOW_MODE_ENABLED', 'true');
    vi.stubEnv('AI_SHADOW_SAMPLE_RATE', '1');
    const env = makeEnv();
    const router = createExpertRouter({
      workflow: { run: async () => result } as unknown as NutritionWorkflow,
      consentChecker: async () => true,
      store: env.store,
      autoDisable: env.autoDisable,
      shadowModeRunner: env.shadow,
    });
    const controller = routeHandlers(router, '/advice', 'post')[0]!;
    const res = makeResponse();
    const next = vi.fn();

    await controller(
      {
        body: { pacienteId: PACIENTE },
        user: { sub: ADMIN, rol: 'nutriologa' },
        sucursalId: SUCURSAL,
      } as unknown as Request,
      res,
      next,
    );

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 'advice' }));
    const run = await env.store.getShadowRun(RUN_ID);
    expect(run?.served).toBe(true);
  });
});