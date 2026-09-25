import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { ActionRegistry } from './actionRegistry.js';
import { createActionRouter } from './actionRoutes.js';
import { ConfirmableActionsService } from './actionService.js';
import { InMemoryActionLedger } from './actionLedger.js';
import type { ConfirmableActionDefinition } from './actionTypes.js';

interface ExpressLayerLike {
  handle?: ((req: Request, res: Response, next: NextFunction) => void | Promise<void>) & { name?: string };
  route?: {
    path?: string;
    methods?: Record<string, boolean>;
    stack?: ExpressLayerLike[];
  };
}

function routeHandlers(router: ReturnType<typeof createActionRouter>, path: string, method: string) {
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
    body: {},
    user: { sub: 'prof-1', rol: 'nutriologa' },
    sucursalId: 'suc-1',
    header: vi.fn(),
    get: vi.fn(),
    socket: { remoteAddress: '127.0.0.1' },
    ...overrides,
  } as unknown as Request;
}

function fakeDefinition(): ConfirmableActionDefinition {
  return {
    id: 'create_memory_note',
    name: 'Nota de memoria',
    description: 'desc',
    riskLevel: 'low',
    requiredRole: 'nutriologa',
    requiredConsents: ['ai_memory'],
    inputSchema: z.object({ content: z.string() }),
    preview: async (input) => ({ summary: `Guardar: ${input.content}`, details: { content: input.content } }),
    execute: async () => ({ done: true }),
    compensate: async () => ({ deleted: true }),
  };
}

function buildRouter() {
  const registry = new ActionRegistry();
  registry.register(fakeDefinition());
  const service = new ConfirmableActionsService({
    registry,
    ledger: new InMemoryActionLedger(),
    consentChecker: async () => true,
    config: () => ({ enabled: true, store: 'memory', confirmationTtlMin: 10, maxPendingConfirmations: 5 }),
    now: () => new Date('2026-08-14T12:00:00.000Z'),
  });
  return { router: createActionRouter({ service }), service };
}

describe('confirmable actions routes', () => {
  beforeEach(() => {
    vi.stubEnv('AI_ACTIONS_ENABLED', 'true');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('lists allowlisted actions with per-role availability', async () => {
    const { router } = buildRouter();
    const controller = routeHandlers(router, '/', 'get')[0]!;
    const res = makeResponse();

    await controller(baseReq(), res, vi.fn());

    const payload = vi.mocked(res.json).mock.calls[0]?.[0] as { actions: Array<{ id: string; availability: { available: boolean } }> };
    expect(payload.actions).toHaveLength(1);
    expect(payload.actions[0]?.id).toBe('create_memory_note');
    expect(payload.actions[0]?.availability.available).toBe(true);
  });

  it('shows actions as unavailable for roles without permission', async () => {
    const { router } = buildRouter();
    const controller = routeHandlers(router, '/', 'get')[0]!;
    const res = makeResponse();

    await controller(baseReq({ user: { sub: 'prof-2', rol: 'facturacion' } }), res, vi.fn());

    const payload = vi.mocked(res.json).mock.calls[0]?.[0] as { actions: Array<{ availability: { available: boolean } }> };
    expect(payload.actions[0]?.availability.available).toBe(false);
  });

  it('preview returns a confirmation id', async () => {
    const { router } = buildRouter();
    const controller = routeHandlers(router, '/:actionId/preview', 'post')[0]!;
    const res = makeResponse();

    await controller(
      baseReq({ params: { actionId: 'create_memory_note' }, body: { input: { content: 'tomar mas agua' }, pacienteId: '7f3f2d1a-6b2e-4a9c-9c5e-1a2b3c4d5e6f' } }),
      res,
      vi.fn(),
    );

    const payload = vi.mocked(res.json).mock.calls[0]?.[0] as { confirmationId: string; preview: { summary: string } };
    expect(payload.confirmationId).toBeTruthy();
    expect(payload.preview.summary).toContain('tomar mas agua');
  });

  it('preview rejects unknown actions with 404', async () => {
    const { router } = buildRouter();
    const controller = routeHandlers(router, '/:actionId/preview', 'post')[0]!;
    const res = makeResponse();

    await controller(baseReq({ params: { actionId: 'nope' }, body: { input: {} } }), res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('preview fails closed when actions are disabled', async () => {
    const registry = new ActionRegistry();
    registry.register(fakeDefinition());
    const disabledService = new ConfirmableActionsService({
      registry,
      ledger: new InMemoryActionLedger(),
      consentChecker: async () => true,
      config: () => ({ enabled: false, store: 'memory', confirmationTtlMin: 10, maxPendingConfirmations: 5 }),
      now: () => new Date('2026-08-14T12:00:00.000Z'),
    });
    const router = createActionRouter({ service: disabledService });
    const controller = routeHandlers(router, '/:actionId/preview', 'post')[0]!;
    const res = makeResponse();

    await controller(baseReq({ params: { actionId: 'create_memory_note' }, body: { input: { content: 'x' }, pacienteId: '7f3f2d1a-6b2e-4a9c-9c5e-1a2b3c4d5e6f' } }), res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(503);
  });

  it('confirm executes the action', async () => {
    const { router } = buildRouter();
    const previewController = routeHandlers(router, '/:actionId/preview', 'post')[0]!;
    const previewRes = makeResponse();
    await previewController(
      baseReq({ params: { actionId: 'create_memory_note' }, body: { input: { content: 'nota' }, pacienteId: '7f3f2d1a-6b2e-4a9c-9c5e-1a2b3c4d5e6f' } }),
      previewRes,
      vi.fn(),
    );
    const previewPayload = vi.mocked(previewRes.json).mock.calls[0]?.[0] as { confirmationId: string };
    expect(previewPayload.confirmationId).toBeTruthy();

    const confirmController = routeHandlers(router, '/:actionId/confirm', 'post')[0]!;
    const confirmRes = makeResponse();
    await confirmController(
      baseReq({ params: { actionId: 'create_memory_note' }, body: { confirmationId: previewPayload.confirmationId, input: { content: 'nota' } } }),
      confirmRes,
      vi.fn(),
    );

    const payload = vi.mocked(confirmRes.json).mock.calls[0]?.[0] as { execution: { status: string }; replayed: boolean };
    expect(payload.execution.status).toBe('executed');
    expect(payload.replayed).toBe(false);
  });

  it('confirm rejects a mismatch with the confirmed preview', async () => {
    const { router } = buildRouter();
    const previewController = routeHandlers(router, '/:actionId/preview', 'post')[0]!;
    const previewRes = makeResponse();
    await previewController(
      baseReq({ params: { actionId: 'create_memory_note' }, body: { input: { content: 'nota original' }, pacienteId: '7f3f2d1a-6b2e-4a9c-9c5e-1a2b3c4d5e6f' } }),
      previewRes,
      vi.fn(),
    );
    const previewPayload = vi.mocked(previewRes.json).mock.calls[0]?.[0] as { confirmationId: string };

    const confirmController = routeHandlers(router, '/:actionId/confirm', 'post')[0]!;
    const confirmRes = makeResponse();
    await confirmController(
      baseReq({ params: { actionId: 'create_memory_note' }, body: { confirmationId: previewPayload.confirmationId, input: { content: 'otra cosa' } } }),
      confirmRes,
      vi.fn(),
    );

    expect(confirmRes.status).toHaveBeenCalledWith(400);
  });

  it('rollback compensates an executed action', async () => {
    const { router } = buildRouter();
    const previewController = routeHandlers(router, '/:actionId/preview', 'post')[0]!;
    const previewRes = makeResponse();
    await previewController(
      baseReq({ params: { actionId: 'create_memory_note' }, body: { input: { content: 'nota' }, pacienteId: '7f3f2d1a-6b2e-4a9c-9c5e-1a2b3c4d5e6f' } }),
      previewRes,
      vi.fn(),
    );
    const previewPayload = vi.mocked(previewRes.json).mock.calls[0]?.[0] as { confirmationId: string };

    const confirmController = routeHandlers(router, '/:actionId/confirm', 'post')[0]!;
    const confirmRes = makeResponse();
    await confirmController(
      baseReq({ params: { actionId: 'create_memory_note' }, body: { confirmationId: previewPayload.confirmationId, input: { content: 'nota' } } }),
      confirmRes,
      vi.fn(),
    );
    const confirmPayload = vi.mocked(confirmRes.json).mock.calls[0]?.[0] as { execution: { id: string } };

    const rollbackController = routeHandlers(router, '/:actionId/rollback', 'post')[0]!;
    const rollbackRes = makeResponse();
    await rollbackController(
      baseReq({ params: { actionId: 'create_memory_note' }, body: { executionId: confirmPayload.execution.id, reason: 'fue un error' } }),
      rollbackRes,
      vi.fn(),
    );

    const payload = vi.mocked(rollbackRes.json).mock.calls[0]?.[0] as { execution: { status: string } };
    expect(payload.execution.status).toBe('rolled_back');
  });
});